/**
 * Space discovery over a StorageBackend (REQ-WS-002, REQ-WS-021, D-3).
 *
 * Walks a backend tree depth-first and finds every folder holding a
 * `space.cept.yaml` / `space.cept.yml` marker. A found space is a leaf of the
 * walk: discovery does not look for further spaces inside it (nested spaces are
 * deferred, REQ-WS-005), though it can report nested markers as warnings. For
 * each space it finds the git repository root by walking up to the nearest
 * folder holding `.git` (a directory, or a file as in worktrees and submodules).
 *
 * Read-only: only `listDirectory` and `readFile` are called, so opening a
 * folder never changes it (REQ-WS-019). Dot folders (`.git/`, `.cept/`, ...)
 * are never walked. Paths follow the contract in `space/path.ts`.
 */

import type { DirEntry, StorageBackend } from '../storage/backend.js';
import { parseSpaceConfig, pickSpaceMarker, type SpaceConfig } from './config.js';
import { joinPath, normalizeFolder, parentFolder, toBackendPath } from './path.js';

/** The read-only part of a backend that discovery uses. */
export type DiscoveryBackend = Pick<StorageBackend, 'listDirectory' | 'readFile'>;

export interface DiscoveredSpace {
  /** Space root, relative to the backend root (`''` is the backend root). */
  path: string;
  /** The marker file used: `space.cept.yaml` or `space.cept.yml`. */
  marker: string;
  /** The parsed marker, or `null` when it could not be read or is invalid. */
  config: SpaceConfig | null;
  /** Why the space cannot be opened as is (invalid marker, duplicate slug). */
  errors: string[];
  /** Problems that do not block opening it (both marker extensions present). */
  warnings: string[];
  /** The folder holding `.git` at or above the space, or `null` when there is none. */
  gitRoot: string | null;
}

/** A marker found inside an already discovered space. It is not a space. */
export interface NestedMarker {
  path: string;
  marker: string;
  /** The enclosing space's path. */
  space: string;
}

export interface DiscoverOptions {
  /** Folder to start from, relative to the backend root. Defaults to the root. */
  root?: string;
  /**
   * Also walk inside each found space and report markers there as nested.
   * Off by default, because it reads the whole content of every space; the
   * page-tree loader walks a space anyway once it is opened.
   */
  reportNested?: boolean;
  /** How many folders deep below `root` to look. Defaults to {@link DEFAULT_MAX_DEPTH}. */
  maxDepth?: number;
}

export const DEFAULT_MAX_DEPTH = 32;

export type DiscoveryEvent =
  | { kind: 'space'; space: DiscoveredSpace }
  | { kind: 'nested'; nested: NestedMarker }
  /** A folder with subfolders that were not walked because of `maxDepth`. */
  | { kind: 'depthLimit'; path: string };

export interface DiscoveryResult {
  spaces: DiscoveredSpace[];
  nested: NestedMarker[];
  warnings: string[];
}

interface Listing {
  files: string[];
  dirs: string[];
  hasGit: boolean;
}

async function list(backend: DiscoveryBackend, dir: string): Promise<Listing> {
  let entries: DirEntry[];
  try {
    entries = await backend.listDirectory(toBackendPath(dir));
  } catch {
    // Discovery is best-effort and read-only (REQ-WS-019): an unreadable folder
    // is treated as empty. Callers that must tell "missing" from "unreadable"
    // probe the folder themselves.
    entries = [];
  }
  const files: string[] = [];
  const dirs: string[] = [];
  let hasGit = false;
  for (const entry of entries) {
    if (entry.name === '.git') hasGit = true;
    if (entry.isFile) files.push(entry.name);
    else if (entry.isDirectory && !entry.name.startsWith('.')) dirs.push(entry.name);
  }
  dirs.sort();
  return { files, dirs, hasGit };
}

async function gitRootFrom(
  backend: DiscoveryBackend,
  start: string,
  cache: Map<string, boolean>,
): Promise<string | null> {
  for (let dir: string | null = normalizeFolder(start); dir !== null; dir = parentFolder(dir)) {
    let hasGit = cache.get(dir);
    if (hasGit === undefined) {
      hasGit = (await list(backend, dir)).hasGit;
      cache.set(dir, hasGit);
    }
    if (hasGit) return dir;
  }
  return null;
}

/**
 * The nearest folder at or above `path` that holds `.git`, or `null`.
 * Covers a space root that is a subfolder of a repo (REQ-WS-021). Read-only.
 */
export function findGitRoot(backend: DiscoveryBackend, path: string): Promise<string | null> {
  return gitRootFrom(backend, path, new Map());
}

async function readSpace(
  backend: DiscoveryBackend,
  path: string,
  marker: string,
  warnings: string[],
): Promise<Omit<DiscoveredSpace, 'gitRoot'>> {
  const file = joinPath(path, marker);
  let data: Uint8Array | null;
  let cause = '';
  try {
    data = await backend.readFile(toBackendPath(file));
  } catch (err) {
    data = null;
    cause = `: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (data === null) {
    return { path, marker, config: null, errors: [`could not read ${file}${cause}`], warnings };
  }
  const parsed = parseSpaceConfig(new TextDecoder().decode(data));
  return parsed.ok
    ? { path, marker, config: parsed.config, errors: [], warnings }
    : { path, marker, config: null, errors: parsed.errors, warnings };
}

/**
 * Walk `backend` lazily, yielding each space as it is found. Stop iterating to
 * stop the walk. Duplicate slugs are only checked by {@link discoverSpaces},
 * which sees the whole listing.
 */
export async function* walkSpaces(
  backend: DiscoveryBackend,
  options: DiscoverOptions = {},
): AsyncGenerator<DiscoveryEvent> {
  const root = normalizeFolder(options.root ?? '');
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const gitCache = new Map<string, boolean>();

  async function* nestedIn(
    space: string,
    dir: string,
    depth: number,
  ): AsyncGenerator<DiscoveryEvent> {
    const listing = await list(backend, dir);
    gitCache.set(dir, listing.hasGit);
    if (dir !== space) {
      const picked = pickSpaceMarker(listing.files);
      if (picked) {
        yield { kind: 'nested', nested: { path: dir, marker: picked.name, space } };
        return;
      }
    }
    if (listing.dirs.length > 0 && depth >= maxDepth) {
      yield { kind: 'depthLimit', path: dir };
      return;
    }
    for (const name of listing.dirs) yield* nestedIn(space, joinPath(dir, name), depth + 1);
  }

  async function* walk(dir: string, depth: number): AsyncGenerator<DiscoveryEvent> {
    const listing = await list(backend, dir);
    gitCache.set(dir, listing.hasGit);
    const picked = pickSpaceMarker(listing.files);
    if (picked) {
      const space = await readSpace(backend, dir, picked.name, picked.warnings);
      const gitRoot = await gitRootFrom(backend, dir, gitCache);
      yield { kind: 'space', space: { ...space, gitRoot } };
      if (options.reportNested) yield* nestedIn(dir, dir, depth);
      return;
    }
    if (listing.dirs.length > 0 && depth >= maxDepth) {
      yield { kind: 'depthLimit', path: dir };
      return;
    }
    for (const name of listing.dirs) yield* walk(joinPath(dir, name), depth + 1);
  }

  yield* walk(root, 0);
}

function displayPath(path: string): string {
  return path === '' ? '/' : path;
}

/**
 * Find every space under `options.root` (default: the backend root).
 * Spaces come back in depth-first, name-sorted order. Spaces sharing a slug
 * within this one discovery each get an error naming the others (WS open
 * question 12: a listing is one discovery over one backend).
 */
export async function discoverSpaces(
  backend: DiscoveryBackend,
  options: DiscoverOptions = {},
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = { spaces: [], nested: [], warnings: [] };
  for await (const event of walkSpaces(backend, options)) {
    if (event.kind === 'space') {
      result.spaces.push(event.space);
    } else if (event.kind === 'nested') {
      const { path, marker, space } = event.nested;
      result.nested.push(event.nested);
      result.warnings.push(
        `${marker} at "${displayPath(path)}" is inside the space at "${displayPath(space)}"; nested spaces are not supported, so it is ignored`,
      );
    } else {
      result.warnings.push(
        `stopped at maxDepth below "${displayPath(event.path)}"; spaces deeper than that were not looked for`,
      );
    }
  }

  const bySlug = new Map<string, DiscoveredSpace[]>();
  for (const space of result.spaces) {
    if (!space.config) continue;
    const group = bySlug.get(space.config.slug) ?? [];
    group.push(space);
    bySlug.set(space.config.slug, group);
  }
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue;
    for (const space of group) {
      const others = group.filter((s) => s !== space).map((s) => `"${displayPath(s.path)}"`);
      space.errors.push(`duplicate slug "${slug}": also used by the space at ${others.join(', ')}`);
    }
  }
  return result;
}
