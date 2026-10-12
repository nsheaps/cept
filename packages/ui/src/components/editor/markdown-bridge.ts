import {
  claimFencedBlocks,
  parseMarkdownDocument,
  releaseFencedBlocks,
  serializeMarkdownDocument,
} from '@cept/core';
import type { MarkdownDocument, PmNode } from '@cept/core';
import { Fragment, Slice, type Schema } from '@tiptap/pm/model';
import type { FencedBlockEditorPlugin } from './extensions/fenced-block.js';
import { mermaidPlugin } from './extensions/mermaid.js';

/**
 * How the editor reads and writes a page (EDT-005): through the shared
 * Markdown pipeline in `@cept/core`, with the fenced-block plugins claiming
 * their fences on load and releasing them on save.
 */

/** The fenced-block plugins the editor registers (EDT-013). */
export const fencedBlockPlugins: FencedBlockEditorPlugin[] = [mermaidPlugin];

/** A page parsed for the editor: the document to show and the parse it came from. */
export interface LoadedMarkdown {
  parsed: MarkdownDocument;
  /** The document with fenced blocks claimed; never empty, as ProseMirror needs a block. */
  doc: PmNode;
}

export function loadMarkdown(markdown: string): LoadedMarkdown {
  const parsed = parseMarkdownDocument(markdown);
  const doc = claimFencedBlocks(parsed.doc, fencedBlockPlugins);
  if (doc.content?.length) return { parsed, doc };
  // A copy, as `claimFencedBlocks` may return `parsed.doc` itself.
  return { parsed, doc: { ...doc, content: [{ type: 'paragraph' }] } };
}

/** The editor's document as the pipeline sees it. */
export function releaseDocument(doc: PmNode): PmNode {
  return releaseFencedBlocks(doc, fencedBlockPlugins);
}

/**
 * The baseline a save compares against: the parse, with the document as the
 * editor holds it. The editor fills in its attribute defaults, so a block is
 * recognised as unchanged (and its source reused) by its editor form.
 */
export function editorBaseline(parsed: MarkdownDocument, held: PmNode): MarkdownDocument {
  return { ...parsed, doc: releaseDocument(held) };
}

/** The page's Markdown: unchanged blocks keep their source. */
export function saveMarkdown(doc: PmNode, baseline: MarkdownDocument): string {
  return serializeMarkdownDocument(releaseDocument(doc), baseline);
}

/** Pasted plain text, read as Markdown. Front matter in the pasted text is discarded. */
export function markdownToSlice(text: string, schema: Schema): Slice {
  const { doc } = loadMarkdown(text);
  return Slice.maxOpen(schema.nodeFromJSON(doc).content);
}

/** Pasted plain text kept as typed (Shift held): one paragraph per line. */
export function plainTextToSlice(text: string, schema: Schema): Slice {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => schema.nodes.paragraph!.create(null, line ? schema.text(line) : undefined));
  return Slice.maxOpen(Fragment.from(paragraphs));
}

/** Copied content as Markdown. */
export function sliceToMarkdown(slice: Slice): string {
  const content = (slice.content.toJSON() as PmNode[] | null) ?? [];
  // Text copied from inside one block arrives as inline nodes.
  const blocks = slice.content.firstChild?.isInline ? [{ type: 'paragraph', content }] : content;
  const doc = releaseDocument({ type: 'doc', content: blocks });
  return serializeMarkdownDocument(doc).replace(/\n+$/, '');
}
