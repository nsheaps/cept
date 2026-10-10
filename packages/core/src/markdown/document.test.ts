import { describe, expect, it } from 'vitest';
import { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';
import type { PmNode } from './prosemirror.js';

const blocks = (markdown: string): PmNode[] => parseMarkdownDocument(markdown).doc.content ?? [];
const block = (markdown: string): PmNode => blocks(markdown)[0]!;

/** The page written fresh, as if every block had been edited. */
function rewrite(markdown: string): string {
  const parsed = parseMarkdownDocument(markdown);
  return serializeMarkdownDocument(parsed.doc, undefined, parsed.frontMatter);
}

describe('parseMarkdownDocument: blocks', () => {
  it('maps paragraphs and headings', () => {
    expect(blocks('# Title\n\nText\n')).toEqual([
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] },
    ]);
    expect(block('Title\n=====\n').attrs).toEqual({ level: 1, setext: true });
  });

  it('maps a code block with its language and fence', () => {
    expect(block('~~~ts title\nlet a;\n~~~\n')).toEqual({
      type: 'codeBlock',
      attrs: { language: 'ts', meta: 'title', fence: '~~~' },
      content: [{ type: 'text', text: 'let a;' }],
    });
    expect(block('    indented\n').attrs).toEqual({ language: null, fence: null });
  });

  it('maps quotes, rules and lists', () => {
    expect(block('> quoted\n').type).toBe('blockquote');
    expect(block('* * *\n')).toEqual({ type: 'horizontalRule', attrs: { marker: '* * *' } });
    expect(block('+ a\n+ b\n')).toMatchObject({
      type: 'bulletList',
      attrs: { bullet: '+', spread: false },
      content: [{ type: 'listItem' }, { type: 'listItem' }],
    });
    expect(block('3) a\n').attrs).toEqual({ start: 3, delimiter: ')', spread: false });
  });

  it('maps a task list', () => {
    expect(block('- [x] done\n- [ ] open\n')).toMatchObject({
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true } },
        { type: 'taskItem', attrs: { checked: false } },
      ],
    });
  });

  it('maps a table with header cells and alignment', () => {
    const table = block('| a | b |\n|:--|--:|\n| 1 | 2 |\n');
    expect(table.attrs).toEqual({ align: ['left', 'right'] });
    expect(table.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(table.content?.[1]?.content?.[1]).toEqual({
      type: 'tableCell',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }],
    });
  });

  it('maps an image on its own line to an image block', () => {
    expect(block('![Alt](a.png "T")\n')).toEqual({
      type: 'imageBlock',
      attrs: { src: 'a.png', alt: 'Alt', title: 'T' },
    });
  });

  it('keeps HTML and unmodelled syntax as raw Markdown', () => {
    expect(block('<div data-type="callout">x</div>\n')).toEqual({
      type: 'rawBlock',
      attrs: { markdown: '<div data-type="callout">x</div>' },
    });
    expect(block('[^1]: A note.\n')).toEqual({
      type: 'rawBlock',
      attrs: { markdown: '[^1]: A note.' },
    });
  });
});

describe('parseMarkdownDocument: inline content', () => {
  it('flattens nested marks onto text', () => {
    expect(block('**a _b_** `c`').content).toEqual([
      { type: 'text', text: 'a ', marks: [{ type: 'bold' }] },
      {
        type: 'text',
        text: 'b',
        marks: [{ type: 'bold' }, { type: 'italic', attrs: { marker: '_' } }],
      },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: [{ type: 'code' }] },
    ]);
  });

  it('maps links, including autolinks', () => {
    expect(block('[x](a.md "T")').content?.[0]?.marks).toEqual([
      { type: 'link', attrs: { href: 'a.md', title: 'T' } },
    ]);
    expect(block('<https://a.example>').content?.[0]?.marks?.[0]?.attrs).toMatchObject({
      autolink: 'angle',
    });
    expect(block('see https://a.example').content?.[1]?.marks?.[0]?.attrs).toMatchObject({
      autolink: 'literal',
    });
  });

  it('maps hard breaks and keeps inline HTML and references raw', () => {
    expect(block('a\\\nb').content?.[1]).toEqual({ type: 'hardBreak' });
    expect(block('a  \nb').content?.[1]).toEqual({ type: 'hardBreak', attrs: { spaces: true } });
    const inline = block('a <b>x</b> [^1]\n\n[^1]: n\n').content;
    expect(inline).toContainEqual({ type: 'rawInline', attrs: { markdown: '<b>' } });
    expect(inline).toContainEqual({ type: 'rawInline', attrs: { markdown: '[^1]' } });
    expect(block('a ![i](i.png)').content?.[1]).toEqual({
      type: 'rawInline',
      attrs: { markdown: '![i](i.png)' },
    });
  });
});

describe('serializeMarkdownDocument', () => {
  const page = '---\ntitle: T\n---\n\n# Title\n\nFirst  _para_.\n\n* one\n* two\n\nLast.\n';

  it('returns an unedited page byte for byte', () => {
    const parsed = parseMarkdownDocument(page);
    expect(serializeMarkdownDocument(parsed.doc, parsed)).toBe(page);
  });

  it('rewrites only the edited block', () => {
    const parsed = parseMarkdownDocument(page);
    const doc = structuredClone(parsed.doc);
    doc.content![3] = { type: 'paragraph', content: [{ type: 'text', text: 'Changed.' }] };
    expect(serializeMarkdownDocument(doc, parsed)).toBe(
      '---\ntitle: T\n---\n\n# Title\n\nFirst  _para_.\n\n* one\n* two\n\nChanged.\n',
    );
  });

  it('keeps the other blocks when one is inserted, removed or moved', () => {
    const parsed = parseMarkdownDocument(page);
    const [heading, first, list, last] = parsed.doc.content!;
    const added: PmNode = { type: 'paragraph', content: [{ type: 'text', text: 'New' }] };
    const write = (content: PmNode[]) =>
      serializeMarkdownDocument({ type: 'doc', content }, parsed);
    expect(write([heading!, added, first!, list!, last!])).toBe(
      '---\ntitle: T\n---\n\n# Title\n\nNew\n\nFirst  _para_.\n\n* one\n* two\n\nLast.\n',
    );
    expect(write([heading!, list!, last!])).toBe(
      '---\ntitle: T\n---\n\n# Title\n\n* one\n* two\n\nLast.\n',
    );
    expect(write([last!, heading!])).toBe('---\ntitle: T\n---\n\nLast.\n\n# Title\n');
  });

  it('writes an empty document as no body', () => {
    const parsed = parseMarkdownDocument('Text.\n');
    expect(
      serializeMarkdownDocument({ type: 'doc', content: [{ type: 'paragraph' }] }, parsed),
    ).toBe('');
    expect(serializeMarkdownDocument(parseMarkdownDocument('').doc)).toBe('');
  });

  it('keeps a whitespace-only body', () => {
    const parsed = parseMarkdownDocument('\n\n');
    expect(serializeMarkdownDocument(parsed.doc, parsed)).toBe('\n\n');
  });

  it('writes a rewritten block in the style it was written in', () => {
    expect(rewrite('__a__ _b_\n')).toBe('__a__ _b_\n');
    expect(rewrite('+ a\n+ b\n')).toBe('+ a\n+ b\n');
    expect(rewrite('1) a\n2) b\n')).toBe('1) a\n2) b\n');
    expect(rewrite('***\n')).toBe('***\n');
    expect(rewrite('~~~js\nx\n~~~\n')).toBe('~~~js\nx\n~~~\n');
    expect(rewrite('    code\n')).toBe('    code\n');
    expect(rewrite('Title\n-----\n')).toBe('Title\n-----\n');
    expect(rewrite('<https://a.example> and https://b.example\n')).toBe(
      '<https://a.example> and https://b.example\n',
    );
    expect(rewrite('a\\\nb  \nc\n')).toBe('a\\\nb  \nc\n');
  });

  it('writes the content of a node type it does not know', () => {
    const doc: PmNode = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }],
        },
      ],
    };
    expect(serializeMarkdownDocument(doc)).toBe('Inside\n');
  });
});
