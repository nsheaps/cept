import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { parseMarkdownDocument, serializeMarkdownDocument } from '@cept/core';
import type { PmNode } from '@cept/core';
import { documentExtensions } from '../document-extensions.js';

const markdown = 'Text with <kbd>Ctrl</kbd> keys.\n\n<!-- a comment Cept does not understand -->\n';

describe('raw Markdown nodes', () => {
  it('shows unmodelled source and saves it unchanged', () => {
    const parsed = parseMarkdownDocument(markdown);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: documentExtensions(),
      content: parsed.doc,
    });
    const dom = editor.view.dom;
    expect(dom.querySelector('.cept-raw-block')?.textContent).toBe(
      '<!-- a comment Cept does not understand -->',
    );
    expect([...dom.querySelectorAll('.cept-raw-inline')].map((el) => el.textContent)).toEqual([
      '<kbd>',
      '</kbd>',
    ]);
    const json = editor.getJSON() as PmNode;
    expect(serializeMarkdownDocument(json, { ...parsed, doc: json })).toBe(markdown);
    expect(serializeMarkdownDocument(json)).toBe(serializeMarkdownDocument(parsed.doc));
    editor.destroy();
  });
});
