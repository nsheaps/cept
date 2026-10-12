/**
 * Every page the Markdown pipeline loads must fit the editor's schema
 * without losing anything (EDT-005, EDT-023). Each fixture of the core
 * round-trip corpus is loaded into an editor built from
 * `documentExtensions()`, and what the editor holds must:
 *
 * 1. save back byte for byte when nothing is edited, and
 * 2. write fresh (every block regenerated) exactly as the parsed document
 *    does, so the editor's attribute defaults change no output.
 */
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import {
  claimFencedBlocks,
  parseMarkdownDocument,
  releaseFencedBlocks,
  serializeMarkdownDocument,
} from '@cept/core';
import type { PmNode } from '@cept/core';
import { documentExtensions } from './document-extensions.js';
import { mermaidPlugin } from './extensions/mermaid.js';

const fixtures = import.meta.glob<string>(
  '../../../../core/src/markdown/__fixtures__/{round-trip,normalized}/*.md',
  { query: '?raw', import: 'default', eager: true },
);

const corpus = Object.entries(fixtures)
  .filter(([path]) => !path.endsWith('.out.md'))
  .map(([path, source]) => ({ name: path.replace(/^.*__fixtures__\//, ''), source }))
  .sort((a, b) => a.name.localeCompare(b.name));

const plugins = [mermaidPlugin];

/** Load a page into an editor and read back the document it holds. */
function throughEditor(doc: PmNode): PmNode {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: documentExtensions(),
    content: claimFencedBlocks(doc, plugins),
  });
  try {
    return releaseFencedBlocks(editor.getJSON() as PmNode, plugins);
  } finally {
    editor.destroy();
  }
}

describe('documentExtensions schema', () => {
  it('reads the corpus', () => {
    expect(corpus.length).toBeGreaterThan(20);
  });

  describe.each(corpus)('$name', ({ source }) => {
    const parsed = parseMarkdownDocument(source);
    const held = throughEditor(parsed.doc);

    it('keeps every block', () => {
      expect(held.content?.map((block) => block.type)).toEqual(
        parsed.doc.content?.map((block) => block.type),
      );
    });

    it('saves unchanged when nothing is edited', () => {
      const original = { ...parsed, doc: held };
      expect(serializeMarkdownDocument(held, original)).toBe(source);
    });

    it('writes fresh exactly as the parsed document does', () => {
      expect(serializeMarkdownDocument(held, undefined, parsed.frontMatter)).toBe(
        serializeMarkdownDocument(parsed.doc, undefined, parsed.frontMatter),
      );
    });
  });
});
