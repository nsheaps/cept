/**
 * Page history (REQ-NTN-016): the commits that changed one page's file, what
 * each changed, and the page's text at any of them. Restoring a version is an
 * ordinary edit that writes the old text back, so it becomes a new commit.
 */
import type { CommitInfo, DiffResult } from '../storage/backend.js';
import type { GitBackend } from '../storage/git-backend.js';

/** How many versions a history list shows at a time. */
export const PAGE_HISTORY_PAGE_SIZE = 20;

export interface PageHistory {
  /** Newest first. */
  commits: CommitInfo[];
  /** Older versions exist beyond the ones listed; ask again with a larger limit. */
  more: boolean;
  /** The list ends at a shallow clone's boundary: older versions are not downloaded yet. */
  truncated: boolean;
}

/** Up to `limit` of the newest commits that changed `path`. */
export async function listPageHistory(
  git: GitBackend,
  path: string,
  limit = PAGE_HISTORY_PAGE_SIZE,
): Promise<PageHistory> {
  const found = await git.log(path, { limit: limit + 1 });
  const commits = found.slice(0, limit);
  const more = found.length > limit;
  return { commits, more, truncated: !more && (await endsAtShallowBoundary(git, path, commits)) };
}

/**
 * Whether the page's history goes on past a shallow clone's boundary. That is
 * so when the oldest listed version is itself a boundary commit, or when the
 * page already existed in its parent (which the log could not reach). The
 * check does not assume a clone depth: the boundary commit need not have
 * changed this page.
 */
async function endsAtShallowBoundary(
  git: GitBackend,
  path: string,
  commits: readonly CommitInfo[],
): Promise<boolean> {
  const oldest = commits.at(-1);
  if (!oldest) return false;
  const shallow = await git.shallowCommits();
  if (shallow.size === 0) return false;
  if (shallow.has(oldest.hash)) return true;
  const parent = oldest.parent[0];
  if (!parent) return false;
  try {
    // Null: the oldest version created the page, so nothing older is missing.
    return (await git.readFileAt(parent, path)) !== null;
  } catch {
    // The parent is not downloaded.
    return true;
  }
}

/**
 * What `commit` changed in `path`, compared with its first parent (or with
 * nothing for the first commit). Null when the parent is beyond a shallow
 * clone's boundary, so the change cannot be shown.
 */
export async function pageVersionDiff(
  git: GitBackend,
  path: string,
  commit: CommitInfo,
): Promise<DiffResult | null> {
  const parent = commit.parent[0] ?? '';
  if (parent && (await git.shallowCommits()).has(commit.hash)) return null;
  return git.diff(parent, commit.hash, path);
}

/** The text of `path` at `hash`, or null when the page did not exist then. */
export function pageVersionContent(
  git: GitBackend,
  path: string,
  hash: string,
): Promise<string | null> {
  return git.readFileAt(hash, path);
}
