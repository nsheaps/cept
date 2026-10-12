import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { Slice } from '@tiptap/pm/model';
import type { PmNode } from '@cept/core';
import { documentExtensions } from './document-extensions.js';
import {
  editorBaseline,
  loadMarkdown,
  markdownToSlice,
  plainTextToSlice,
  saveMarkdown,
  sliceToMarkdown,
} from './markdown-bridge.js';

const page = [
  '---',
  'title: Notes',
  'tags: [a, b]',
  '---',
  '',
  'Intro with __bold__ and a note[^n].',
  '',
  '* first',
  '* second',
  '',
  '```mermaid',
  'graph TD; A-->B',
  '```',
  '',
  '[^n]: The note.',
  '',
].join('\n');

function open(markdown: string) {
  const loaded = loadMarkdown(markdown);
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: documentExtensions(),
    content: loaded.doc,
  });
  const baseline = editorBaseline(loaded.parsed, editor.getJSON() as PmNode);
  const save = () => saveMarkdown(editor.getJSON() as PmNode, baseline);
  return { editor, save };
}

describe('loadMarkdown / saveMarkdown', () => {
  it('saves an unedited page byte for byte, front matter included', () => {
    const { editor, save } = open(page);
    expect(editor.getJSON().content?.map((block) => block.type)).toContain('mermaid');
    expect(save()).toBe(page);
    editor.destroy();
  });

  it('keeps the source of every block that was not edited', () => {
    const { editor, save } = open(page);
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'first') at = pos;
    });
    editor.commands.insertContentAt({ from: at, to: at + 'first'.length }, 'one');
    expect(save()).toBe(page.replace('* first\n* second', '* one\n* second'));
    editor.destroy();
  });

  it('keeps underline and highlight, which Markdown writes as HTML', () => {
    const { editor, save } = open('Some <u>under</u> and <mark>marked</mark> text.\n');
    const marks = editor.getJSON().content?.[0]?.content?.flatMap((node) => node.marks ?? []);
    expect(marks?.map((mark) => mark.type)).toEqual(['underline', 'highlight']);
    editor.commands.setTextSelection({ from: 1, to: 5 });
    editor.commands.toggleUnderline();
    expect(save()).toBe('<u>Some</u> <u>under</u> and <mark>marked</mark> text.\n');
    editor.destroy();
  });

  it('gives an empty page a paragraph to type in', () => {
    expect(loadMarkdown('').doc.content).toEqual([{ type: 'paragraph' }]);
  });
});

describe('clipboard', () => {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: documentExtensions(),
  });
  const schema = editor.schema;

  it('reads pasted text as Markdown', () => {
    const slice = markdownToSlice('# Title\n\nSome **bold** text', schema);
    const blocks = slice.content.toJSON() as PmNode[];
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph']);
    expect(blocks[1]!.content?.[1]).toMatchObject({ text: 'bold', marks: [{ type: 'bold' }] });
  });

  it('keeps plain text as typed, one paragraph per line', () => {
    const slice = plainTextToSlice('# Title\n\n**b**', schema);
    expect(slice.content.toJSON()).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: '# Title' }] },
      { type: 'paragraph' },
      { type: 'paragraph', content: [{ type: 'text', text: '**b**' }] },
    ]);
  });

  it('copies blocks as Markdown', () => {
    const slice = markdownToSlice('## Heading\n\n- item', schema);
    expect(sliceToMarkdown(slice)).toBe('## Heading\n\n- item');
  });

  it('copies text from inside a block as Markdown', () => {
    const text = schema.text('bold', [schema.marks.bold!.create()]);
    expect(
      sliceToMarkdown(new Slice(schema.nodes.paragraph!.create(null, text).content, 0, 0)),
    ).toBe('**bold**');
  });
});
