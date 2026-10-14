/**
 * Comment markers as editor nodes (REQ-NTN-005; phase-1 plan PR 62b).
 *
 * The page pipeline loads a `<!-- cept:comment ... -->` line as a `rawBlock`.
 * `claimComments` turns each one that reads as a comment into a `comment` node
 * for the editor, so the editor can keep it out of the way and put highlights
 * on its anchor. `releaseComments` turns the nodes back before
 * `serializeMarkdownDocument`. A node whose comment is unchanged is released
 * with the marker text it was loaded with, so the page is saved byte for byte;
 * a changed or new comment is written with `formatCommentMarker`. A marker that
 * does not read stays a `rawBlock` and is saved as it is.
 *
 * Only top-level blocks count, as in `readPageComments`.
 */

import { formatCommentMarker, isCommentMarker, parseCommentMarker } from './comments.js';
import type { PageComment } from './comments.js';
import type { PmNode } from './prosemirror.js';

/** The editor node type of a comment. */
export const COMMENT_NODE = 'comment';

/** A `comment` node: the comment, and the marker text it was loaded from (empty for a new one). */
export function commentNode(comment: PageComment, markdown = ''): PmNode {
  return { type: COMMENT_NODE, attrs: { comment, markdown } };
}

/** The comment a `comment` node holds, or null for any other node. */
export function commentOf(node: PmNode): PageComment | null {
  if (node.type !== COMMENT_NODE) return null;
  const comment = node.attrs?.comment;
  return typeof comment === 'object' && comment !== null ? (comment as PageComment) : null;
}

/** Turn every top-level readable comment marker into a `comment` node. */
export function claimComments(doc: PmNode): PmNode {
  if (!doc.content) return doc;
  let changed = false;
  const content = doc.content.map((node) => {
    if (node.type !== 'rawBlock') return node;
    const markdown = node.attrs?.markdown;
    if (typeof markdown !== 'string' || !isCommentMarker(markdown)) return node;
    const parsed = parseCommentMarker(markdown);
    if (!parsed.ok) return node;
    changed = true;
    return commentNode(parsed.comment, markdown);
  });
  return changed ? { ...doc, content } : doc;
}

/** Turn every `comment` node back into the `rawBlock` it is saved as. */
export function releaseComments(doc: PmNode): PmNode {
  if (!doc.content) return doc;
  let changed = false;
  const content = doc.content.map((node) => {
    const comment = commentOf(node);
    if (!comment) return node;
    changed = true;
    const loaded = typeof node.attrs?.markdown === 'string' ? node.attrs.markdown : '';
    return {
      type: 'rawBlock',
      attrs: { markdown: unchanged(loaded, comment) ?? formatCommentMarker(comment) },
    };
  });
  return changed ? { ...doc, content } : doc;
}

/** The loaded marker text when it still reads as exactly this comment. */
function unchanged(loaded: string, comment: PageComment): string | null {
  if (loaded === '') return null;
  const parsed = parseCommentMarker(loaded);
  if (!parsed.ok) return null;
  return formatCommentMarker(parsed.comment) === formatCommentMarker(comment) ? loaded : null;
}
