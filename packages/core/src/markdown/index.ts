/**
 * The Markdown pipeline (D-49): remark/mdast parses and writes pages, and
 * ProseMirror JSON is the bridge to the editor.
 */

export * from './front-matter.js';
export { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';
export type { MarkdownDocument } from './document.js';
export { claimFencedBlocks, fencedBlockNode, releaseFencedBlocks } from './fenced-blocks.js';
export type { FencedBlockPlugin } from './fenced-blocks.js';
export { blocksToMdast, mdastToBlocks } from './prosemirror.js';
export type { PmMark, PmNode } from './prosemirror.js';
