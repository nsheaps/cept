/**
 * Space autodiscovery from account access (REQ-WS-023, D-3, D-30).
 *
 * Lists every repository a GitHub personal access token can read
 * (`GET /user/repos`, all pages), skips forks and archived repositories, reads
 * each default branch's tree through the recursive REST Git Trees API and finds
 * every `space.cept.yaml` / `space.cept.yml`. Nothing is cloned: only the
 * markers' blobs are read. Responses are cached with ETags (and blobs by their
 * sha), requests run with capped concurrency, and discovery stops early, keeping
 * what it found, when `X-RateLimit-Remaining` runs out.
 *
 * As in {@link discoverSpaces}, a space is a leaf (D-3): a marker inside a found
 * space is reported as a warning, dot folders are ignored, and spaces sharing a
 * slug within one repository each get an error. The GitHub App installation
 * path is Phase 2.
 */

import type { FetchFn } from '../auth/github.js';
import { redactTokens } from '../auth/pat.js';
import {
  parseSpaceConfig,
  pickSpaceMarker,
  SPACE_MARKER_YAML,
  SPACE_MARKER_YML,
} from './config.js';

/** A space found in a repository on GitHub. */
export interface RemoteSpace {
  /** `owner/name`. */
  repo: string;
  /** The repository's web URL, e.g. `https://github.com/owner/name`. */
  url: string;
  /** Space root in the repository (`''` is the repository root). */
  path: string;
  /** The marker file used: `space.cept.yaml` or `space.cept.yml`. */
  marker: string;
  /** The marker's `name`, else the folder (or repository) name. */
  name: string;
  /** The marker's `slug`, or `null` when the marker is invalid. */
  slug: string | null;
  /** The branch the space lives on: the marker's `branch:`, else the default branch. */
  branch: string;
  /** The repository's default branch, where the marker was read. */
  defaultBranch: string;
  private: boolean;
  /** Why the space cannot be opened as is (invalid marker, duplicate slug). */
  errors: string[];
  /** Problems that do not block opening it (both marker extensions present). */
  warnings: string[];
}

export type AutodiscoveryWarningKind =
  /** A marker inside an already found space; it is not a space (D-3). */
  | 'nested-marker'
  /** The repository answered 403 or 404 and was skipped. */
  | 'access'
  /** GitHub truncated the tree, so spaces may be missing. */
  | 'truncated'
  /** Another HTTP or network failure; the repository was skipped. */
  | 'http'
  /** The rate limit ran out; the rest was not looked at. */
  | 'rate-limited';

export interface AutodiscoveryWarning {
  kind: AutodiscoveryWarningKind;
  repo?: string;
  path?: string;
  message: string;
}

/** A space found by an earlier discovery that this one did not find again. */
export interface LostSpace {
  space: RemoteSpace;
  /**
   * `access`: the repository is no longer readable. `removed`: it is, but the
   * marker is gone. `excluded`: the repository is now a fork or archived, so
   * discovery no longer looks in it.
   */
  reason: 'access' | 'removed' | 'excluded';
}

export interface AutodiscoveryResult {
  /** Found spaces, in repository listing order, then by path. */
  spaces: RemoteSpace[];
  /** Spaces from `previous` that are gone; flag them, do not delete local copies. */
  lost: LostSpace[];
  warnings: AutodiscoveryWarning[];
  /**
   * False when discovery stopped before trying every repository (the rate limit
   * ran out). A repository that failed with another error counts as tried and
   * is named in `warnings` (`access` or `http`).
   */
  complete: boolean;
  /** The last rate-limit headers seen; `resetAt` is in milliseconds since the epoch. */
  rateLimit?: { remaining: number; resetAt: number | null };
}

/** A cached GET: the ETag GitHub sent and the parsed body (plus the next-page link). */
export interface CachedResponse {
  etag: string;
  body: unknown;
  next?: string | null;
}

/**
 * Where ETags and bodies are kept between discoveries. Keep one per account:
 * keys are request URLs (and `blob:<sha>`), not account-specific.
 */
export interface EtagCache {
  get(key: string): CachedResponse | undefined | Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse): void | Promise<void>;
}

/** An {@link EtagCache} in memory. */
export class MemoryEtagCache implements EtagCache {
  private readonly entries = new Map<string, CachedResponse>();

  get(key: string): CachedResponse | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: CachedResponse): void {
    this.entries.set(key, value);
  }
}

export interface AutodiscoveryOptions {
  /** The personal access token. Only ever sent to `apiBase`. */
  token: string;
  fetch?: FetchFn;
  /** REST API root (default `https://api.github.com`). */
  apiBase?: string;
  /** Repositories read at once (default 4). */
  concurrency?: number;
  cache?: EtagCache;
  /** The spaces an earlier discovery found, to report the ones now lost. */
  previous?: readonly RemoteSpace[];
  signal?: AbortSignal;
}

/** Discovery could not list the account's repositories. Its message never contains a token. */
export class AutodiscoveryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(redactTokens(message));
    this.name = 'AutodiscoveryError';
  }
}

const DEFAULT_API_BASE = 'https://api.github.com';
const DEFAULT_CONCURRENCY = 4;

interface ApiRepo {
  full_name: string;
  name: string;
  html_url: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  default_branch: string;
}

interface ApiTree {
  tree: { path: string; type: string; sha: string }[];
  truncated: boolean;
}

interface ApiBlob {
  content: string;
  encoding: string;
}

type Got =
  | { ok: true; body: unknown; next: string | null }
  | { ok: false; status: number | null; rateLimited: boolean; message: string };

/** Find the spaces in every repository `options.token` can read (REQ-WS-023). */
export async function autodiscoverSpaces(
  options: AutodiscoveryOptions,
): Promise<AutodiscoveryResult> {
  options.signal?.throwIfAborted();
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, '');
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const cache = options.cache;
  const warnings: AutodiscoveryWarning[] = [];
  let rateLimit: AutodiscoveryResult['rateLimit'];
  let exhausted = false;

  function noteRate(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    if (remaining === null) return;
    const reset = headers.get('X-RateLimit-Reset');
    rateLimit = {
      remaining: Number(remaining),
      resetAt: reset === null ? null : Number(reset) * 1000,
    };
    if (rateLimit.remaining <= 0) exhausted = true;
  }

  async function get(url: string): Promise<Got> {
    const cached = await cache?.get(url);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (cached) headers['If-None-Match'] = cached.etag;
    let response: Response;
    try {
      response = await fetchFn(url, { method: 'GET', headers, signal: options.signal });
    } catch (err) {
      // A cancelled discovery rejects; it does not carry on with failed requests.
      if (options.signal?.aborted) throw options.signal.reason ?? err;
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: null, rateLimited: false, message: redactTokens(message) };
    }
    noteRate(response.headers);
    if (response.status === 304 && cached) {
      return { ok: true, body: cached.body, next: cached.next ?? null };
    }
    if (!response.ok) {
      // The primary limit (403 with nothing remaining), or a secondary limit (429, or 403 with Retry-After).
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 &&
          (response.headers.get('X-RateLimit-Remaining') === '0' ||
            response.headers.get('Retry-After') !== null));
      if (rateLimited) exhausted = true;
      return {
        ok: false,
        status: response.status,
        rateLimited,
        // No URL: an `apiBase` with userinfo would put credentials in the warning.
        message: `GitHub answered ${response.status}`,
      };
    }
    const body: unknown = await response.json();
    const next = nextLink(response.headers.get('Link'));
    const etag = response.headers.get('ETag');
    if (cache && etag) await cache.set(url, { etag, body, next });
    return { ok: true, body, next };
  }

  // 1. Every repository, all pages.
  const repos: ApiRepo[] = [];
  let listed = true;
  for (let url: string | null = `${apiBase}/user/repos?per_page=100`; url;) {
    const got = await get(url);
    if (!got.ok) {
      if (got.rateLimited) {
        listed = false;
        warnings.push({ kind: 'rate-limited', message: rateLimitMessage(rateLimit) });
        break;
      }
      throw new AutodiscoveryError(
        got.status === 401
          ? 'GitHub rejected the token while listing repositories'
          : `Could not list repositories: ${got.message}`,
        got.status ?? undefined,
      );
    }
    repos.push(...(got.body as ApiRepo[]));
    url = got.next;
  }
  const eligible = repos.filter((repo) => !repo.fork && !repo.archived);

  // 2. Each repository's markers, a few repositories at a time.
  type RepoOutcome = { spaces: RemoteSpace[]; status: 'read' | 'denied' | 'failed' } | undefined;
  const outcomes: RepoOutcome[] = eligible.map((): RepoOutcome => undefined);
  let nextIndex = 0;
  let stopped = !listed;

  async function readRepo(repo: ApiRepo): Promise<RepoOutcome> {
    const branchPath = repo.default_branch.split('/').map(encodeURIComponent).join('/');
    const treeUrl = `${apiBase}/repos/${repo.full_name}/git/trees/${branchPath}?recursive=1`;
    const tree = await get(treeUrl);
    if (!tree.ok) {
      if (tree.rateLimited) return undefined;
      // An empty repository has no default-branch tree (409).
      if (tree.status === 409) return { spaces: [], status: 'read' };
      if (tree.status === 403 || tree.status === 404) {
        warnings.push({
          kind: 'access',
          repo: repo.full_name,
          message: `${repo.full_name} could not be read (${tree.status}); skipped`,
        });
        return { spaces: [], status: 'denied' };
      }
      warnings.push({
        kind: 'http',
        repo: repo.full_name,
        message: `${repo.full_name}: ${tree.message}; skipped`,
      });
      return { spaces: [], status: 'failed' };
    }
    const { tree: entries, truncated } = tree.body as ApiTree;
    if (truncated) {
      warnings.push({
        kind: 'truncated',
        repo: repo.full_name,
        message: `GitHub truncated the tree of ${repo.full_name}; some spaces may be missing`,
      });
    }

    // Marker files by folder, outside dot folders.
    const byDir = new Map<string, Map<string, string>>();
    for (const entry of entries) {
      if (entry.type !== 'blob') continue;
      const slash = entry.path.lastIndexOf('/');
      const file = entry.path.slice(slash + 1);
      if (file !== SPACE_MARKER_YAML && file !== SPACE_MARKER_YML) continue;
      const dir = slash < 0 ? '' : entry.path.slice(0, slash);
      if (dir.split('/').some((part) => part.startsWith('.'))) continue;
      const files = byDir.get(dir) ?? new Map<string, string>();
      files.set(file, entry.sha);
      byDir.set(dir, files);
    }

    // D-3: outermost markers are spaces; the ones inside them are nested.
    const dirs = [...byDir.keys()].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
    const roots: string[] = [];
    const spaces: RemoteSpace[] = [];
    for (const dir of dirs) {
      const outer = roots.find((root) => contains(root, dir));
      const files = byDir.get(dir) as Map<string, string>;
      const picked = pickSpaceMarker(files.keys()) as NonNullable<
        ReturnType<typeof pickSpaceMarker>
      >;
      if (outer !== undefined) {
        warnings.push({
          kind: 'nested-marker',
          repo: repo.full_name,
          path: dir,
          message: `${picked.name} at "${display(dir)}" in ${repo.full_name} is inside the space at "${display(outer)}"; nested spaces are not supported, so it is ignored`,
        });
        continue;
      }
      roots.push(dir);
      spaces.push(
        await readSpace(repo, dir, picked.name, files.get(picked.name) as string, picked.warnings),
      );
    }
    markDuplicateSlugs(spaces);
    spaces.sort((a, b) => a.path.localeCompare(b.path));
    return { spaces, status: 'read' };
  }

  async function readSpace(
    repo: ApiRepo,
    dir: string,
    marker: string,
    sha: string,
    markerWarnings: string[],
  ): Promise<RemoteSpace> {
    const fallbackName = dir === '' ? repo.name : dir.slice(dir.lastIndexOf('/') + 1);
    const space: RemoteSpace = {
      repo: repo.full_name,
      url: repo.html_url,
      path: dir,
      marker,
      name: fallbackName,
      slug: null,
      branch: repo.default_branch,
      defaultBranch: repo.default_branch,
      private: repo.private,
      errors: [],
      warnings: [...markerWarnings],
    };
    const file = dir === '' ? marker : `${dir}/${marker}`;
    const text = await readBlob(repo, sha);
    if (text === null) {
      space.errors.push(`could not read ${file}`);
      return space;
    }
    const parsed = parseSpaceConfig(text);
    if (!parsed.ok) {
      space.errors.push(...parsed.errors);
      return space;
    }
    space.name = parsed.config.name ?? fallbackName;
    space.slug = parsed.config.slug;
    if (parsed.config.branch) space.branch = parsed.config.branch;
    return space;
  }

  async function readBlob(repo: ApiRepo, sha: string): Promise<string | null> {
    const key = `blob:${sha}`;
    const cached = await cache?.get(key);
    if (cached && typeof cached.body === 'string') return cached.body;
    const got = await get(`${apiBase}/repos/${repo.full_name}/git/blobs/${sha}`);
    if (!got.ok) return null;
    const blob = got.body as ApiBlob;
    const text =
      blob.encoding === 'base64' ? decodeBase64(blob.content) : String(blob.content ?? '');
    // A blob never changes, so its sha is enough of a key.
    await cache?.set(key, { etag: sha, body: text });
    return text;
  }

  async function worker(): Promise<void> {
    while (!stopped) {
      options.signal?.throwIfAborted();
      if (exhausted) {
        stopped = true;
        break;
      }
      const index = nextIndex++;
      if (index >= eligible.length) break;
      outcomes[index] = await readRepo(eligible[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, eligible.length) }, worker));

  const complete = listed && outcomes.every((outcome) => outcome !== undefined);
  if (!complete && !warnings.some((w) => w.kind === 'rate-limited')) {
    warnings.push({ kind: 'rate-limited', message: rateLimitMessage(rateLimit) });
  }
  const spaces = outcomes.flatMap((outcome) => outcome?.spaces ?? []);

  // 3. Earlier spaces that are gone.
  const lost: LostSpace[] = [];
  const statusByRepo = new Map<string, NonNullable<RepoOutcome>['status'] | 'unread' | 'skipped'>();
  for (const repo of repos) statusByRepo.set(repo.full_name, 'skipped');
  eligible.forEach((repo, i) => statusByRepo.set(repo.full_name, outcomes[i]?.status ?? 'unread'));
  const found = new Set(spaces.map((s) => `${s.repo}\n${s.path}`));
  for (const space of options.previous ?? []) {
    const status = statusByRepo.get(space.repo);
    if (status === undefined) {
      if (listed) lost.push({ space, reason: 'access' });
    } else if (status === 'skipped') {
      lost.push({ space, reason: 'excluded' });
    } else if (status === 'denied') {
      lost.push({ space, reason: 'access' });
    } else if (status === 'read' && !found.has(`${space.repo}\n${space.path}`)) {
      lost.push({ space, reason: 'removed' });
    }
  }

  return { spaces, lost, warnings, complete, ...(rateLimit ? { rateLimit } : {}) };
}

function depth(dir: string): number {
  return dir === '' ? 0 : dir.split('/').length;
}

/** Whether `dir` is strictly inside `root`. */
function contains(root: string, dir: string): boolean {
  return root === '' ? dir !== '' : dir.startsWith(`${root}/`);
}

function display(path: string): string {
  return path === '' ? '/' : path;
}

function markDuplicateSlugs(spaces: RemoteSpace[]): void {
  const bySlug = new Map<string, RemoteSpace[]>();
  for (const space of spaces) {
    if (space.slug === null) continue;
    const group = bySlug.get(space.slug) ?? [];
    group.push(space);
    bySlug.set(space.slug, group);
  }
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue;
    for (const space of group) {
      const others = group.filter((s) => s !== space).map((s) => `"${display(s.path)}"`);
      space.errors.push(`duplicate slug "${slug}": also used by the space at ${others.join(', ')}`);
    }
  }
}

function rateLimitMessage(rate: AutodiscoveryResult['rateLimit']): string {
  const when = rate?.resetAt ? ` It resets at ${new Date(rate.resetAt).toISOString()}.` : '';
  return `GitHub's rate limit ran out, so some repositories were not looked at.${when}`;
}

function decodeBase64(content: string): string {
  const binary = atob(content.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}
