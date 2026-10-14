import type { ListedComment } from '../editor/extensions/comment.js';

/**
 * "New since last visit" (REQ-NTN-008, D-34): the only notification Phase 1 has.
 * When each page was last opened is kept on this device, not in the space.
 */

const key = (spaceId: string) => `cept:comment-visits:${spaceId}`;

function readAll(spaceId: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(spaceId)) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** When `pageId` was last opened on this device, or null if it never was. */
export function lastVisit(spaceId: string, pageId: string): string | null {
  const at = readAll(spaceId)[pageId];
  return typeof at === 'string' ? at : null;
}

/** Record that `pageId` was opened at `at` (an ISO time). */
export function markVisited(spaceId: string, pageId: string, at: string): void {
  try {
    localStorage.setItem(key(spaceId), JSON.stringify({ ...readAll(spaceId), [pageId]: at }));
  } catch {
    // Storage blocked or full: the badge just stays off.
  }
}

/**
 * Comments by other people created after `visit`. A page never opened here has
 * no badge, and `meId` keeps your own comments from counting.
 */
export function countNewComments(
  comments: readonly ListedComment[],
  visit: string | null,
  meId: string | null,
): number {
  if (visit === null) return 0;
  const since = Date.parse(visit);
  return comments.filter(
    ({ comment }) => comment.author.id !== meId && Date.parse(comment.created) > since,
  ).length;
}
