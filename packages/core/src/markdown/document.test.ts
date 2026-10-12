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
    expect(block('<section class="x">x</section>\n')).toEqual({
      type: 'rawBlock',
      attrs: { markdown: '<section class="x">x</section>' },
    });
    expect(block('[a]: https://a.example\n')).toEqual({
      type: 'rawBlock',
      attrs: { markdown: '[a]: https://a.example' },
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
    const inline = block('a <b>x</b> [y][r]\n\n[r]: https://a.example\n').content;
    expect(inline).toContainEqual({ type: 'rawInline', attrs: { markdown: '<b>' } });
    expect(inline).toContainEqual({ type: 'rawInline', attrs: { markdown: '[y][r]' } });
    expect(block('a ![i](i.png)').content?.[1]).toEqual({
      type: 'rawInline',
      attrs: { markdown: '![i](i.png)' },
    });
  });

  it('reads <u> and <mark> pairs as underline and highlight, and writes them back', () => {
    const inline = block('a <u>under **bold**</u> <mark data-color="#ff0">hi</mark>').content;
    expect(inline).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'text', text: 'under ', marks: [{ type: 'underline' }] },
      { type: 'text', text: 'bold', marks: [{ type: 'underline' }, { type: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'hi', marks: [{ type: 'highlight', attrs: { color: '#ff0' } }] },
    ]);
    for (const markdown of [
      'a <u>b <mark>c</mark></u> d\n',
      '<u>x</u> <mark data-color="red">y</mark>\n',
    ]) {
      expect(rewrite(markdown)).toBe(markdown);
    }
    // Written fresh, marks nest in a fixed order; the text and marks are unchanged.
    const mixed = 'a <u>under **bold**</u>\n';
    expect(rewrite(mixed)).toBe('a <u>under </u>**<u>bold</u>**\n');
    const marks = (markdown: string) =>
      block(markdown).content?.map((node) => [node.text, node.marks?.map((m) => m.type).sort()]);
    expect(marks(rewrite(mixed))).toEqual(marks(mixed));
  });

  it('adds one mark for a tag nested in itself', () => {
    expect(block('<u>a <u>b</u></u>').content).toEqual([
      { type: 'text', text: 'a b', marks: [{ type: 'underline' }] },
    ]);
  });

  it('keeps unpaired or unknown tags raw', () => {
    expect(block('a <u>open').content).toContainEqual({
      type: 'rawInline',
      attrs: { markdown: '<u>' },
    });
    expect(block('a <U>x</U>').content).toContainEqual({
      type: 'rawInline',
      attrs: { markdown: '<U>' },
    });
  });

  it('writes underline and highlight made in the editor', () => {
    const doc: PmNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'u', marks: [{ type: 'underline' }] },
            { type: 'text', text: 'h', marks: [{ type: 'highlight', attrs: { color: null } }] },
          ],
        },
      ],
    };
    expect(serializeMarkdownDocument(doc)).toBe('<u>u</u><mark>h</mark>\n');
  });
});

describe('math', () => {
  it('maps $..$ and $$ blocks to the KaTeX nodes', () => {
    expect(block('a $x^2$ b').content?.[1]).toEqual({
      type: 'inlineMath',
      attrs: { content: 'x^2' },
    });
    expect(block('$$\n\\frac{1}{2}\n$$\n')).toEqual({
      type: 'mathBlock',
      attrs: { content: '\\frac{1}{2}' },
    });
    expect(block('$$ label\nx\n$$\n').attrs).toEqual({ content: 'x', meta: 'label' });
  });

  it('writes edited and new math with dollars', () => {
    const doc: PmNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Area ' },
            { type: 'inlineMath', attrs: { content: '\\pi r^2' } },
          ],
        },
        { type: 'mathBlock', attrs: { content: 'a$$b' } },
      ],
    };
    expect(serializeMarkdownDocument(doc)).toBe('Area $\\pi r^2$\n\n$$$\na$$b\n$$$\n');
  });

  it('keeps prices as text, not math', () => {
    for (const markdown of [
      'It costs $5 and $10.',
      'From $ 1 to $ 2',
      'Pay $5, get $',
      'Up $3$4',
    ]) {
      const content = block(markdown).content ?? [];
      expect(content, markdown).toEqual([{ type: 'text', text: markdown }]);
    }
    expect(rewrite('It costs $5 and $10.')).toBe('It costs \\$5 and \\$10.\n');
    expect(block(rewrite('It costs $5 and $10.')).content).toEqual([
      { type: 'text', text: 'It costs $5 and $10.' },
    ]);
  });
});

describe('footnotes', () => {
  const page = 'One.[^n] Two.[^n]\n\n[^n]: Shared *note*.\n';

  it('maps references and the definition they share (EDT-016)', () => {
    const [paragraph, definition] = blocks(page);
    const references = paragraph?.content?.filter((node) => node.type === 'footnoteReference');
    expect(references).toEqual([
      { type: 'footnoteReference', attrs: { identifier: 'n', label: 'n' } },
      { type: 'footnoteReference', attrs: { identifier: 'n', label: 'n' } },
    ]);
    expect(definition).toMatchObject({
      type: 'footnoteDefinition',
      attrs: { identifier: 'n', label: 'n' },
      content: [{ type: 'paragraph' }],
    });
  });

  it('writes an edited definition once and keeps every reference', () => {
    const parsed = parseMarkdownDocument(page);
    const [paragraph, definition] = parsed.doc.content!;
    const edited: PmNode = {
      type: 'doc',
      content: [
        paragraph!,
        {
          ...definition!,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New.' }] }],
        },
      ],
    };
    expect(serializeMarkdownDocument(edited, parsed)).toBe('One.[^n] Two.[^n]\n\n[^n]: New.\n');
  });

  it('keeps the label as written', () => {
    expect(rewrite('A[^Note]\n\n[^Note]: x\n')).toBe('A[^Note]\n\n[^Note]: x\n');
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
          type: 'mystery',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }],
        },
      ],
    };
    expect(serializeMarkdownDocument(doc)).toBe('Inside\n');
  });

  it('keeps inline children held directly by an unknown node', () => {
    const doc: PmNode = {
      type: 'doc',
      content: [{ type: 'mystery', content: [{ type: 'text', text: 'Loose' }] }],
    };
    expect(serializeMarkdownDocument(doc)).toBe('Loose\n');
  });

  it('writes no text for empty paragraphs, however they are written', () => {
    const empty = { type: 'paragraph' };
    expect(serializeMarkdownDocument({ type: 'doc', content: [empty, empty] })).toBe('');
    expect(serializeMarkdownDocument({ type: 'doc', content: [{ ...empty, content: [] }] })).toBe(
      '',
    );
  });

  it('reuses the source of a block whose attribute keys were reordered', () => {
    const source = '#   Title  #\n\nText\n';
    const parsed = parseMarkdownDocument(source);
    const [heading, paragraph] = parsed.doc.content!;
    const reordered = { content: heading!.content, attrs: heading!.attrs, type: heading!.type };
    expect(
      serializeMarkdownDocument({ type: 'doc', content: [reordered, paragraph!] }, parsed),
    ).toBe(source);
  });
});
