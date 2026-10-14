import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PmModelNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { commentOf, createAnchor, newCommentId, resolveAnchor } from '@cept/core';
import type { CommentAuthor, PageComment, PmNode } from '@cept/core';

/**
 * Inline comments (REQ-NTN-002, REQ-NTN-005; phase-1 plan PR 62b).
 *
 * A comment is a `<!-- cept:comment ... -->` line in the page. The editor
 * holds it as a hidden `comment` node placed after the top-level block it is
 * about (at the end of the page for a page-level comment) and highlights the
 * quoted text in the page. The marker's position is the durable anchor: the
 * quote is looked up in the block before the marker first and in the whole
 * page after that, so the highlight follows the text through edits and a
 * comment whose text is gone is detached (no highlight, still saved).
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Comment on the current selection (a page-level comment when nothing is
       * selected). The marker goes after the top-level block holding the end of
       * the selection.
       */
      addComment: (input: { author: CommentAuthor; body: string; created?: string }) => ReturnType;
    };
  }
}

/** The text of a document as the anchors see it, and where each character is. */
export interface PageText {
  text: string;
  /** `positions[i]` is the document position of `text[i]`; `-1` for a block separator. */
  positions: number[];
}

/** The text of `node` (a block, or the document), with a newline between text blocks. */
export function pageText(node: PmModelNode, base = 0): PageText {
  let text = '';
  const positions: number[] = [];
  let blocks = 0;
  node.descendants((child, pos) => {
    if (child.isTextblock) {
      if (blocks++ > 0) {
        text += '\n';
        positions.push(-1);
      }
      return true;
    }
    if (child.type.name === 'hardBreak') {
      // A line break inside a paragraph reads as a newline, so quotes and context keep it.
      text += '\n';
      positions.push(-1);
      return true;
    }
    if (child.isText) {
      for (let i = 0; i < (child.text ?? '').length; i++) {
        text += child.text![i];
        positions.push(base + pos + i);
      }
    }
    return true;
  });
  return { text, positions };
}

/** A comment's anchor found in the page. */
export interface CommentRange {
  id: string;
  from: number;
  to: number;
  exact: boolean;
}

/** Where each anchored comment's quote is in the page; detached comments are left out. */
export function commentRanges(doc: PmModelNode): CommentRange[] {
  const ranges: CommentRange[] = [];
  let whole: PageText | null = null;
  const last: { block: { node: PmModelNode; pos: number } | null } = { block: null };
  doc.forEach((child, offset) => {
    if (child.type.name !== 'comment') {
      last.block = { node: child, pos: offset };
      return;
    }
    const comment = commentOf(child.toJSON() as PmNode);
    if (!comment?.anchor) return;
    // The block before the marker (skipping other markers) holds the quote first.
    if (last.block) {
      const local = pageText(last.block.node, last.block.pos + 1);
      const range = rangeOf(local, comment);
      if (range?.exact) {
        ranges.push(range);
        return;
      }
    }
    whole ??= pageText(doc);
    const range = rangeOf(whole, comment);
    if (range) ranges.push(range);
  });
  return ranges;
}

function rangeOf(page: PageText, comment: PageComment): CommentRange | null {
  const match = resolveAnchor(page.text, comment.anchor!);
  if (!match) return null;
  const covered = page.positions.slice(match.from, match.to).filter((pos) => pos >= 0);
  if (covered.length === 0) return null;
  return {
    id: comment.id,
    from: covered[0]!,
    to: covered[covered.length - 1]! + 1,
    exact: match.exact,
  };
}

const highlightKey = new PluginKey<DecorationSet>('ceptCommentHighlights');

export const Comment = Node.create({
  name: 'comment',
  group: 'block',
  atom: true,
  // Never a node selection: arrow keys would stop on an invisible node.
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          try {
            return JSON.parse(element.getAttribute('data-comment') ?? 'null');
          } catch {
            return null;
          }
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-comment': JSON.stringify(attributes.comment ?? null),
        }),
      },
      markdown: { default: '', rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="comment"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const comment = node.attrs.comment as PageComment | null;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'comment',
        'data-comment-id': comment?.id ?? '',
        class: 'cept-comment-marker',
        hidden: 'hidden',
      }),
    ];
  },

  addCommands() {
    return {
      addComment:
        ({ author, body, created }) =>
        ({ state, tr, dispatch }) => {
          const { doc, selection } = state;
          const page = pageText(doc);
          let anchor: PageComment['anchor'];
          if (!selection.empty) {
            const first = page.positions.findIndex((pos) => pos >= selection.from);
            let last = -1;
            page.positions.forEach((pos, index) => {
              if (pos >= 0 && pos < selection.to) last = index;
            });
            if (first !== -1 && last >= first) anchor = createAnchor(page.text, first, last + 1);
          }

          // After the top-level block holding the end of the selection (page end if none).
          let at = doc.content.size;
          if (anchor) {
            const $to = doc.resolve(selection.to);
            at = $to.depth >= 1 ? $to.after(1) : selection.to;
          }
          // Keep markers in the order they were written: go past markers already there.
          let next = doc.nodeAt(at);
          while (next?.type.name === 'comment') {
            at += next.nodeSize;
            next = doc.nodeAt(at);
          }

          const comment: PageComment = {
            id: newCommentId(),
            author,
            // Whole seconds, the form the format spec shows; the reader also accepts milliseconds.
            created: created ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            body,
            ...(anchor ? { anchor } : {}),
          };
          if (dispatch) {
            tr.insert(at, state.schema.nodes.comment!.create({ comment, markdown: '' }));
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: (_, state) => highlights(state.doc),
          apply: (tr, old, _before, state) => (tr.docChanged ? highlights(state.doc) : old),
        },
        props: {
          decorations: (state) => highlightKey.getState(state),
        },
      }),
    ];
  },
});

function highlights(doc: PmModelNode): DecorationSet {
  const decorations = commentRanges(doc).map((range) =>
    Decoration.inline(range.from, range.to, {
      class: range.exact ? 'cept-comment-highlight' : 'cept-comment-highlight cept-comment-approx',
      'data-comment-id': range.id,
    }),
  );
  return DecorationSet.create(doc, decorations);
}
