import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  claimFencedBlocks,
  parseMarkdownDocument,
  releaseFencedBlocks,
  serializeMarkdownDocument,
} from '@cept/core';
import type { PmNode } from '@cept/core';
import { createFencedBlockExtension, type FencedBlockEditorPlugin } from './fenced-block.js';

const rendered: string[] = [];
const cleaned: string[] = [];
const shout: FencedBlockEditorPlugin = {
  name: 'shout',
  language: 'shout',
  defaultSource: 'hello',
  claims: (language) => language === 'shout',
  render(source, element, { meta }) {
    rendered.push(meta ? `${source}|${meta}` : source);
    element.textContent = source.toUpperCase();
    return () => cleaned.push(source);
  },
};

function editorFor(doc: PmNode) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, createFencedBlockExtension(shout)],
    content: doc,
  });
}

describe('createFencedBlockExtension', () => {
  it('registers an atom block node named after the plugin', () => {
    const extension = createFencedBlockExtension(shout);
    expect(extension.name).toBe('shout');
    expect(extension.config.group).toBe('block');
    expect(extension.config.atom).toBe(true);
  });

  it('rejects plugin names that are not plain identifiers', () => {
    for (const name of ['', 'Shout', 'a"b', 'a b', '1x']) {
      expect(() => createFencedBlockExtension({ ...shout, name })).toThrow(/plugin name/);
    }
  });

  it('gives a new block the default source and language', () => {
    const editor = editorFor({ type: 'doc', content: [{ type: 'paragraph' }] });
    editor.commands.insertContent({ type: 'shout' });
    const block = (editor.getJSON() as PmNode).content?.find((node) => node.type === 'shout');
    expect(block?.attrs).toMatchObject({ language: 'shout', source: 'hello', fence: '```' });
    editor.destroy();
  });

  it('loads a claimed fence, renders it, and saves it unchanged', () => {
    const markdown = 'Intro\n\n~~~shout loud\nhey there\n~~~\n';
    const parsed = parseMarkdownDocument(markdown);
    const editor = editorFor(claimFencedBlocks(parsed.doc, [shout]));
    expect(editor.view.dom.querySelector('[data-type="shout"]')?.textContent).toBe('HEY THERE');

    const saved = releaseFencedBlocks(editor.getJSON() as PmNode, [shout]);
    expect(serializeMarkdownDocument(saved, parsed)).toBe(markdown);
    editor.destroy();
  });

  it('re-renders when the source changes and cleans up the old render', () => {
    rendered.length = 0;
    cleaned.length = 0;
    const editor = editorFor({
      type: 'doc',
      content: [{ type: 'shout', attrs: { language: 'shout', source: 'a' } }],
    });
    editor.commands.setNodeSelection(0);
    editor.commands.updateAttributes('shout', { source: 'b' });
    expect(rendered).toEqual(['a', 'b']);
    expect(cleaned).toEqual(['a']);
    expect(editor.view.dom.querySelector('[data-type="shout"]')?.textContent).toBe('B');
    editor.destroy();
    expect(cleaned).toEqual(['a', 'b']);
  });

  it('re-renders when the meta string changes', () => {
    rendered.length = 0;
    const editor = editorFor({
      type: 'doc',
      content: [{ type: 'shout', attrs: { language: 'shout', source: 'a' } }],
    });
    editor.commands.setNodeSelection(0);
    editor.commands.updateAttributes('shout', { meta: 'loud' });
    expect(rendered).toEqual(['a', 'a|loud']);
    editor.destroy();
  });
});
