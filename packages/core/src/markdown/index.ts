/**
 * Markdown <-> Block tree parser/serializer interface.
 *
 * Handles CommonMark + GFM + Cept extensions (<!-- cept:block --> comments).
 */

import type { Block, PageMeta } from '../models/index.js';

/** Parsed page = front matter + block tree */
export interface ParsedPage {
  meta: PageMeta;
  blocks: Block[];
}

/** Markdown parser/serializer interface */
export interface MarkdownParser {
  /** Parse a Markdown string (with YAML front matter) into a page */
  parse(markdown: string): ParsedPage;

  /** Serialize a page back to Markdown with YAML front matter */
  serialize(page: ParsedPage): string;

  /** Parse just the front matter from a Markdown string */
  parseFrontMatter(markdown: string): PageMeta;

  /** Parse just the body blocks from a Markdown string (no front matter) */
  parseBlocks(markdown: string): Block[];

  /** Serialize blocks to Markdown (no front matter) */
  serializeBlocks(blocks: Block[]): string;
}

export { CeptMarkdownParser } from './parser.js';
