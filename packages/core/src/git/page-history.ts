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
  const shallow = more ? new Set<string>() : await git.shallowCommits();
  return { commits, more, truncated: commits.some((commit) => shallow.has(commit.hash)) };
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
