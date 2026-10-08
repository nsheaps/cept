/**
 * git-space — Utilities for cloning a remote Git repository into a Cept space.
 *
 * Handles the full flow: clone or fetch → read files → build page tree → save
 * as space. Each remote space keeps its clone (under `/.cept/git-repos/`), so a
 * refresh fetches only what changed. The git work (transport, isomorphic-git)
 * lives in `@cept/core`; this module turns the cloned Markdown into pages.
 */

import {
  countUnpushedCommits,
  findSpaceMarker,
  GitAuthRequiredError,
  openLocalRepository,
  openRemoteClone,
  GitSpaceSession,
  createGitHttp,
  remoteCloneDir,
  ScopedBackend,
  syncRemoteClone,
} from '@cept/core';
import type {
  CommitIdentity,
  GitAuth,
  GitBackend,
  GitFs,
  GitHttp,
  GitSpaceSyncResult,
  StorageBackend,
} from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import { folderPageFile, initFolderSpace } from './folder-space.js';

/**
 * A backend that can hand isomorphic-git its raw filesystem, which a clone
 * needs (today: the IndexedDB-backed browser backend).
 */
export interface GitCloneHost extends StorageBackend {
  getRawFs(): unknown;
}

/** Whether `backend` can host a Git clone. */
export function canHostGitClone(backend: StorageBackend): backend is GitCloneHost {
  return typeof (backend as Partial<GitCloneHost>).getRawFs === 'function';
}

/** Result of cloning a remote repo into a space */
export interface ClonedSpaceData {
  pages: PageTreeNode[];
  pageContents: Record<string, string>;
  /** `token` when the clone used the GitHub sign-in, which makes the space writable-capable (D-42). */
  access: 'anonymous' | 'token';
  /**
   * Whether the space can be edited: cloned with the GitHub sign-in, and its
   * root in the clone holds `space.cept.yaml` (see {@link isWritableClone}).
   */
  writable: boolean;
}

export interface CloneRemoteOptions {
  /** The space the clone belongs to; its clone is kept and fetched into on refresh. */
  spaceId: string;
  /** Repository URL (e.g., "github.com/user/repo"). */
  url: string;
  /** Branch to track (default: "main"). */
  branch?: string;
  /** Optional sub-path to scope the space to (e.g., "docs/"). */
  subPath?: string;
  /** Optional CORS proxy URL for browser environments. */
  corsProxy?: string;
  /** The GitHub sign-in; sent only to github.com. */
  auth?: GitAuth;
  /** HTTP client; the browser client when omitted. */
  http?: GitHttp;
}

/**
 * Normalize a repository URL to a full HTTPS URL.
 * Handles shorthand like "github.com/user/repo" → "https://github.com/user/repo"
 */
export function normalizeRepoUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  // Remove trailing .git if present
  normalized = normalized.replace(/\.git$/, '');
  return normalized;
}

/** Whether `url` (already normalized) is a repository on github.com. */
export function isGitHubUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'github.com';
  } catch {
    return false;
  }
}

/** Where a remote space lives, as `remoteWebUrl` needs it. */
export interface RemoteLocation {
  remoteUrl: string;
  branch?: string;
  subPath?: string;
}

/**
 * The page on github.com for a remote space, or for one of its pages (a file
 * id opens the file, a folder id the folder). Null for hosts other than
 * github.com, whose web URLs Cept cannot know.
 */
export function remoteWebUrl(space: RemoteLocation, pageId?: string): string | null {
  const repo = normalizeRepoUrl(space.remoteUrl);
  if (!isGitHubUrl(repo)) return null;
  const path = [space.subPath, pageId].flatMap((part) => (part ?? '').split('/')).filter(Boolean);
  if (path.length === 0 && !space.branch) return repo;
  const kind = pageId && /\.(md|markdown)$/i.test(pageId) ? 'blob' : 'tree';
  return [repo, kind, space.branch ?? 'main', ...path.map(encodeURIComponent)].join('/');
}

/**
 * Clone a remote Git repository, or fetch into the space's kept clone, and
 * extract its Markdown files as Cept pages. The token in `auth` is only sent
 * to github.com. A repository that needs a (different) sign-in rejects with
 * core's `GitAuthRequiredError`; see {@link cloneErrorMessage}.
 *
 * @param backend - A backend that can host the clone (see canHostGitClone)
 */
export async function cloneRemoteRepo(
  backend: GitCloneHost,
  options: CloneRemoteOptions,
): Promise<ClonedSpaceData> {
  const url = normalizeRepoUrl(options.url);
  const auth = options.auth && isGitHubUrl(url) ? options.auth : undefined;
  const prefix = options.subPath ? options.subPath.replace(/^\//, '').replace(/\/$/, '') : '';
  const { dir } = await syncRemoteClone({
    host: backend,
    fs: backend.getRawFs() as GitFs,
    dir: remoteCloneDir(options.spaceId),
    url,
    ref: options.branch ?? 'main',
    corsProxy: options.corsProxy,
    auth,
    http: options.http,
    // Only read-only spaces come through here (writable ones sync through their
    // session), so a rewritten branch just replaces the files.
    resetOnDivergence: true,
  });
  const pages: PageTreeNode[] = [];
  const pageContents: Record<string, string> = {};
  const scanDir = prefix ? `${dir}/${prefix}` : dir;
  await walkMarkdownFiles(backend, scanDir, '', pages, pageContents);
  const access = auth ? 'token' : 'anonymous';
  const writable = access === 'token' && (await hasCloneMarker(backend, options.spaceId, prefix));
  return { pages, pageContents, access, writable };
}

/** Where a remote space's files are: its folder in the space's kept clone. */
export function cloneSpaceRoot(spaceId: string, subPath?: string): string {
  const inner = (subPath ?? '').split('/').filter(Boolean).join('/');
  return inner ? `${remoteCloneDir(spaceId)}/${inner}` : remoteCloneDir(spaceId);
}

/**
 * Whether a remote space is edited in place: it was cloned with the GitHub
 * sign-in and has a `space.cept.yaml` (REQ-WS-027). Its pages are then the
 * files of its kept clone, and edits are committed and pushed. Every other
 * remote space (anonymous clones above all) is read-only.
 */
export function isWritableRemote(space: { remoteUrl?: string; readOnly?: boolean }): boolean {
  return Boolean(space.remoteUrl) && space.readOnly === false;
}

/** Whether the space's folder in its kept clone holds a space marker. */
export async function hasCloneMarker(
  host: StorageBackend,
  spaceId: string,
  subPath?: string,
): Promise<boolean> {
  const root = new ScopedBackend(host, cloneSpaceRoot(spaceId, subPath));
  return (await findSpaceMarker(root, '').catch(() => null)) !== null;
}

/**
 * Whether a remote space synced with `access` can be edited: only with the
 * GitHub sign-in, and only when its root in the clone holds a space marker.
 */
export async function isWritableClone(
  host: StorageBackend,
  space: { id: string; subPath?: string; access?: 'anonymous' | 'token' },
): Promise<boolean> {
  return space.access === 'token' && hasCloneMarker(host, space.id, space.subPath);
}

export interface GitSpaceSessionRequest {
  spaceId: string;
  subPath?: string;
  /** The GitHub sign-in. */
  auth?: GitAuth;
  /** Who commits are attributed to (`commitIdentityFor` of the signed-in account). */
  identity: CommitIdentity;
  /** The signed-in login, which names a "push to a new branch" fallback branch. */
  login?: string;
  corsProxy?: string;
  /** HTTP client; the browser client when omitted. */
  http?: GitHttp;
}

/** Open the editing session of a writable remote space over its kept clone. */
export async function openGitSpaceSession(
  host: GitCloneHost,
  request: GitSpaceSessionRequest,
): Promise<GitSpaceSession> {
  return GitSpaceSession.open({
    host,
    fs: host.getRawFs() as GitFs,
    dir: remoteCloneDir(request.spaceId),
    subPath: request.subPath,
    http: request.http ?? (await createGitHttp()),
    corsProxy: request.corsProxy,
    auth: request.auth,
    identity: request.identity,
    login: request.login,
  });
}

/** Commits in a remote space's kept clone that are not pushed yet (0 without a clone). */
export function unpushedCommitsOf(host: GitCloneHost, spaceId: string): Promise<number> {
  return countUnpushedCommits({
    host,
    fs: host.getRawFs() as GitFs,
    dir: remoteCloneDir(spaceId),
  }).catch(() => 0);
}

/**
 * What page history (REQ-NTN-016) offers for the open page: nothing outside
 * remote spaces (on a host that can keep a clone) and folders in a Git
 * repository, the list and diffs for read-only spaces, and restoring too when
 * the space is open for editing.
 */
export type PageHistoryAccess = 'none' | 'view' | 'restore';

export function pageHistoryAccess(options: {
  space: { remoteUrl?: string } | undefined;
  hostCanClone: boolean;
  /** The space is a folder on this device inside a Git repository (REQ-WS-021). */
  localRepo?: boolean;
  /** The space can be edited now: an open editing session, or a folder, and not locked. */
  editable: boolean;
}): PageHistoryAccess {
  const remote = !!options.space?.remoteUrl && options.hostCanClone;
  if (!remote && !(options.space && options.localRepo)) return 'none';
  return options.editable ? 'restore' : 'view';
}

/** Where a page's history is read: the clone, and the page's path in it. */
export interface PageHistorySource {
  git: GitBackend;
  /** The page's file, relative to the clone's root. */
  path: string;
  /** The branch the clone tracks, which older versions are fetched for. */
  ref: string;
  /** Whether older versions can be downloaded (false for a folder's own repository). */
  canFetchOlder?: boolean;
}

/**
 * The history source of page `pageId` in a remote space: the editing
 * session's repository when one is open, otherwise the kept clone, read-only.
 * Null when the page has no file (a folder without an index page).
 */
export async function pageHistorySource(
  host: GitCloneHost,
  space: { id: string; remoteUrl?: string; subPath?: string; branch?: string },
  pageId: string,
  options: { sessionGit?: GitBackend; auth?: GitAuth; corsProxy?: string; http?: GitHttp } = {},
): Promise<PageHistorySource | null> {
  const root = new ScopedBackend(host, cloneSpaceRoot(space.id, space.subPath));
  const file = await folderPageFile(root, pageId).catch(() => null);
  if (!file) return null;
  const path = [...(space.subPath ?? '').split('/'), file].filter(Boolean).join('/');
  const ref = space.branch ?? 'main';
  if (options.sessionGit) return { git: options.sessionGit, path, ref };
  const github = space.remoteUrl ? isGitHubUrl(normalizeRepoUrl(space.remoteUrl)) : false;
  const git = await openRemoteClone({
    host,
    fs: host.getRawFs() as GitFs,
    dir: remoteCloneDir(space.id),
    http: options.http,
    corsProxy: options.corsProxy,
    auth: github ? options.auth : undefined,
  });
  return { git, path, ref };
}

/** Whether a folder space's folder is (or sits in) a Git repository the browser can read. */
export async function hasLocalRepository(
  folder: StorageBackend,
  space: { subPath?: string },
): Promise<boolean> {
  return (await openLocalRepository(folder, space.subPath ?? '').catch(() => null)) !== null;
}

/**
 * The history source of page `pageId` in a folder space whose folder is (or
 * sits in) a Git repository (REQ-WS-021): the repository read in place, which
 * Cept never writes to. Null when there is no repository the browser can read
 * or the page has no file.
 */
export async function localPageHistorySource(
  folder: StorageBackend,
  space: { subPath?: string },
  pageId: string,
): Promise<PageHistorySource | null> {
  const repo = await openLocalRepository(folder, space.subPath ?? '');
  if (!repo) return null;
  const root = space.subPath ? new ScopedBackend(folder, space.subPath) : folder;
  const file = await folderPageFile(root, pageId).catch(() => null);
  if (!file) return null;
  const path = [...repo.prefix.split('/'), file].filter(Boolean).join('/');
  const ref = await repo.git.branch.current().catch(() => 'HEAD');
  return { git: repo.git, path, ref, canFetchOlder: false };
}

/** Starting a space in a repository: where, and as whom. */
export interface StartRepoSpaceRequest extends GitSpaceSessionRequest {
  /** Repository URL. */
  url: string;
  branch: string;
  /** The new space's name, written to its `space.cept.yaml`. */
  name: string;
}

/**
 * Start a space in a repository that has none at `subPath`: clone it with the
 * GitHub sign-in, write `space.cept.yaml` there through an editing session (so
 * it is committed), and push. When the folder already holds a space, nothing
 * is written. Rejects when the push does not go through, leaving the commit in
 * the clone; starting again pushes that commit instead of skipping it.
 */
export async function startSpaceInRepo(
  host: GitCloneHost,
  request: StartRepoSpaceRequest,
): Promise<{ created: boolean }> {
  const url = normalizeRepoUrl(request.url);
  // Like cloneRemoteRepo: the token only goes to github.com, and without it nothing is writable.
  if (!request.auth || !isGitHubUrl(url)) {
    throw new Error(
      'Starting a space in a repository needs the GitHub sign-in and a github.com repository.',
    );
  }
  // Commits of an earlier start whose push failed are pushed by the session,
  // which pulls first; refreshing the clone would take them for a rewrite.
  const unpushed = await unpushedCommitsOf(host, request.spaceId);
  if (unpushed === 0) {
    await syncRemoteClone({
      host,
      fs: host.getRawFs() as GitFs,
      dir: remoteCloneDir(request.spaceId),
      url,
      ref: request.branch,
      corsProxy: request.corsProxy,
      auth: request.auth,
      http: request.http,
    });
  }
  const marked = await hasCloneMarker(host, request.spaceId, request.subPath);
  // A folder that is already a space is opened as it is.
  if (marked && unpushed === 0) return { created: false };
  const session = await openGitSpaceSession(host, request);
  let result: GitSpaceSyncResult;
  try {
    if (!marked) await initFolderSpace(session.backend, request.name);
    result = await session.pushNow();
  } finally {
    await session.dispose();
  }
  if (result.status.state !== 'synced') {
    throw new Error(
      `The space was created on this device but could not be pushed: ${
        result.status.lastError ?? result.status.state
      }`,
    );
  }
  return { created: true };
}

/** What to tell the user when cloning or refreshing a remote space failed. */
export function cloneErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof GitAuthRequiredError) {
    return err.status === 401
      ? `GitHub asked for a sign-in to read ${err.url}. Sign in with a personal access token under Settings → GitHub, then try again.`
      : `Your GitHub token cannot read ${err.url}. Sign in with a token that has access under Settings → GitHub, then try again.`;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * Recursively walk a directory and collect markdown files as pages.
 */
async function walkMarkdownFiles(
  backend: StorageBackend,
  baseDir: string,
  relativePath: string,
  pages: PageTreeNode[],
  pageContents: Record<string, string>,
): Promise<void> {
  const currentDir = relativePath ? `${baseDir}/${relativePath}` : baseDir;

  let entries;
  try {
    entries = await backend.listDirectory(currentDir);
  } catch {
    return; // Directory doesn't exist or can't be read
  }

  // Sort: directories first, then files alphabetically
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith('.'));
  const files = entries.filter(
    (e) => e.isFile && (e.name.endsWith('.md') || e.name.endsWith('.markdown')),
  );

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  // Process markdown files
  for (const file of files) {
    const filePath = relativePath ? `${relativePath}/${file.name}` : file.name;
    // Page ids are paths in the space, as in folder spaces.
    const pageId = filePath;
    const title = extractTitleFromFilename(file.name);

    // Read the file content
    const fullPath = `${baseDir}/${filePath}`;
    const data = await backend.readFile(fullPath);
    if (data) {
      // Keep the file as it is, front matter included (PR 46 parses it).
      const content = new TextDecoder().decode(data);
      const headingTitle = extractTitleFromContent(content);

      pageContents[pageId] = content;
      pages.push({
        id: pageId,
        title: headingTitle ?? title,
        children: [],
      });
    }
  }

  // Process subdirectories (creating folder-style parent pages)
  for (const dir of dirs) {
    const dirPath = relativePath ? `${relativePath}/${dir.name}` : dir.name;
    const folderId = dirPath;
    const folderTitle = dir.name.charAt(0).toUpperCase() + dir.name.slice(1).replace(/-/g, ' ');

    const children: PageTreeNode[] = [];
    const folderNode: PageTreeNode = {
      id: folderId,
      title: folderTitle,
      isExpanded: false,
      children,
    };

    await walkMarkdownFiles(backend, baseDir, dirPath, children, pageContents);

    // Only add the folder if it has content
    if (children.length > 0) {
      // Generate a simple index page for the folder
      const childLinks = children.map((c) => `- **${c.title}**`).join('\n');
      pageContents[folderId] = `# ${folderTitle}\n\n${childLinks}`;
      pages.push(folderNode);
    }
  }
}

/** Markdown without a leading YAML front matter block, so its `#` comments are not headings. */
function withoutFrontMatter(md: string): string {
  return md.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '');
}

/** Extract a human-readable title from a markdown filename */
function extractTitleFromFilename(filename: string): string {
  const name = filename.replace(/\.(md|markdown)$/, '');
  if (name === 'index' || name === 'README') return 'Index';
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract title from the first H1 heading in markdown content */
function extractTitleFromContent(content: string): string | undefined {
  const match = withoutFrontMatter(content).match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
