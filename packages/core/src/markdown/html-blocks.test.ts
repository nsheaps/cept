import { describe, expect, it } from 'vitest';
import { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';
import { structuralTokens } from './html-blocks.js';
import type { PmNode } from './prosemirror.js';

const blocks = (markdown: string) => parseMarkdownDocument(markdown).doc.content ?? [];
const paragraph = (text: string): PmNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const write = (...content: PmNode[]) => serializeMarkdownDocument({ type: 'doc', content });
const unchanged = (markdown: string) => {
  const parsed = parseMarkdownDocument(markdown);
  return serializeMarkdownDocument(parsed.doc, parsed);
};

describe('structuralTokens', () => {
  it('splits tag-only HTML into opening and closing tags with offsets', () => {
    const tokens = structuralTokens('</div>\n<div data-type="column">');
    expect(tokens?.map(({ kind, tag, offset }) => ({ kind, tag, offset }))).toEqual([
      { kind: 'close', tag: 'div', offset: 0 },
      { kind: 'open', tag: 'div', offset: 7 },
    ]);
    expect(tokens?.[1]).toMatchObject({ attrs: { dataType: 'column' } });
  });

  it('reads a details summary with entities decoded', () => {
    expect(structuralTokens('<details open>\n<summary>A &amp; B</summary>')).toEqual([
      expect.objectContaining({ tag: 'details', summary: 'A & B', attrs: { open: true } }),
    ]);
  });

  it('rejects HTML with anything but container tags', () => {
    expect(structuralTokens('<div>text</div>')).toBeNull();
    expect(structuralTokens('<details>\n<summary><b>x</b></summary>')).toBeNull();
    expect(structuralTokens('<section>')).toBeNull();
    expect(structuralTokens('<!-- comment -->')).toBeNull();
  });
});

describe('custom blocks: loading', () => {
  it('loads a toggle with a Markdown body', () => {
    expect(blocks('<details>\n<summary>S</summary>\n\nBody\n\n</details>\n')).toEqual([
      { type: 'toggle', attrs: { summary: 'S', open: false }, content: [paragraph('Body')] },
    ]);
  });

  it('never loads a blockquote as a toggle (EDT-024)', () => {
    expect(blocks('> S\n>\n> Body\n')[0]?.type).toBe('blockquote');
  });

  it('loads a toggle inside a list item', () => {
    const [list] = blocks(
      '- item\n\n  <details>\n  <summary>S</summary>\n\n  Body\n\n  </details>\n',
    );
    expect(list?.content?.[0]?.content?.[1]).toEqual({
      type: 'toggle',
      attrs: { summary: 'S', open: false },
      content: [paragraph('Body')],
    });
  });

  it('gives an empty container an empty paragraph', () => {
    expect(blocks('<details>\n<summary>S</summary>\n\n</details>\n')).toEqual([
      { type: 'toggle', attrs: { summary: 'S', open: false }, content: [{ type: 'paragraph' }] },
    ]);
  });

  it('loads containers written on one line of HTML, nested ones included', () => {
    const [columns] = blocks(
      '<div data-type="columns"><div data-type="column"><p>L</p></div>' +
        '<div data-type="column"><div data-type="callout" data-icon="!"><p>C</p></div></div></div>\n',
    );
    expect(columns).toEqual({
      type: 'columns',
      content: [
        { type: 'column', content: [paragraph('L')] },
        {
          type: 'column',
          content: [
            { type: 'callout', attrs: { icon: '!', color: 'default' }, content: [paragraph('C')] },
          ],
        },
      ],
    });
  });

  it('keeps unbalanced or misplaced tags as raw blocks', () => {
    expect(blocks('<details>\n<summary>S</summary>\n\nBody\n')).toEqual([
      { type: 'rawBlock', attrs: { markdown: '<details>\n<summary>S</summary>' } },
      paragraph('Body'),
    ]);
    expect(blocks('Text\n\n</div>\n')[1]).toEqual({
      type: 'rawBlock',
      attrs: { markdown: '</div>' },
    });
    expect(blocks('<div data-type="column">\n\nC\n\n</div>\n').map((b) => b.type)).toEqual([
      'rawBlock',
      'paragraph',
      'rawBlock',
    ]);
  });

  it('recovers locally from a container that cannot load, so later ones still do', () => {
    const source =
      '<div data-type="column">\n\nLone column.\n\n</div>\n\n' +
      '<details>\n<summary>S</summary>\n\nBody\n\n</details>\n';
    expect(blocks(source)).toEqual([
      { type: 'rawBlock', attrs: { markdown: '<div data-type="column">' } },
      paragraph('Lone column.'),
      { type: 'rawBlock', attrs: { markdown: '</div>' } },
      { type: 'toggle', attrs: { summary: 'S', open: false }, content: [paragraph('Body')] },
    ]);
    expect(unchanged(source)).toBe(source);
  });

  it('recovers from a mismatched closing tag and an unclosed container', () => {
    const source =
      '<details>\n<summary>Outer</summary>\n\n<div data-type="callout">\n\nIn\n\n</details>\n\n' +
      '<details>\n<summary>S</summary>\n\nBody\n\n</details>\n\n<div data-type="callout">\n\nEnd\n';
    const loaded = blocks(source);
    expect(loaded[0]).toEqual({
      type: 'toggle',
      attrs: { summary: 'Outer', open: false },
      content: [
        { type: 'rawBlock', attrs: { markdown: '<div data-type="callout">' } },
        paragraph('In'),
      ],
    });
    expect(loaded[1]).toEqual({
      type: 'toggle',
      attrs: { summary: 'S', open: false },
      content: [paragraph('Body')],
    });
    expect(loaded.slice(2)).toEqual([
      { type: 'rawBlock', attrs: { markdown: '<div data-type="callout">' } },
      paragraph('End'),
    ]);
    expect(unchanged(source)).toBe(source);
  });

  it('keeps an HTML element that is not a whole Cept element as raw', () => {
    const html = '<div data-type="callout"><p>x</p></div><p>after</p>';
    expect(blocks(`${html}\n`)).toEqual([{ type: 'rawBlock', attrs: { markdown: html } }]);
  });

  it('loads embeds, bookmarks and captioned images from their data attributes', () => {
    expect(
      blocks(
        '<figure data-type="embed" data-src="https://v.example/1" data-provider="vimeo"></figure>\n\n' +
          '<aside data-type="bookmark" data-url="https://e.example" data-title="E"></aside>\n\n' +
          '<figure data-type="image"><img src="a.png" alt="A"><figcaption>Cap</figcaption></figure>\n',
      ),
    ).toEqual([
      {
        type: 'embed',
        attrs: { src: 'https://v.example/1', provider: 'vimeo', width: '100%', height: '400px' },
      },
      {
        type: 'bookmark',
        attrs: { url: 'https://e.example', title: 'E', description: '', favicon: '', image: '' },
      },
      { type: 'imageBlock', attrs: { src: 'a.png', alt: 'A', title: null, caption: 'Cap' } },
    ]);
  });
});

describe('custom blocks: saving', () => {
  it('writes a toggle as details with a Markdown body, escaping the summary', () => {
    expect(
      write({
        type: 'toggle',
        attrs: { summary: 'a < b & c', open: true },
        content: [paragraph('Body')],
      }),
    ).toBe('<details open>\n<summary>a &lt; b &amp; c</summary>\n\nBody\n\n</details>\n');
  });

  it('writes a callout with its attributes escaped', () => {
    expect(
      write({ type: 'callout', attrs: { icon: '"', color: 'red' }, content: [paragraph('x')] }),
    ).toBe('<div data-type="callout" data-icon="&quot;" data-color="red">\n\nx\n\n</div>\n');
  });

  it('writes embeds and bookmarks as elements with a link GitHub shows', () => {
    expect(write({ type: 'bookmark', attrs: { url: 'https://e.example?a&b', title: '' } })).toBe(
      '<aside data-type="bookmark" data-url="https://e.example?a&amp;b" data-title="" ' +
        'data-description="" data-favicon="" data-image="">' +
        '<a href="https://e.example?a&amp;b">https://e.example?a&amp;b</a></aside>\n',
    );
    expect(write({ type: 'embed', attrs: { src: 'https://v.example/1' } })).toBe(
      '<figure data-type="embed" data-provider="generic" data-src="https://v.example/1" ' +
        'data-width="100%" data-height="400px">' +
        '<a href="https://v.example/1">https://v.example/1</a></figure>\n',
    );
  });

  it('writes an image as Markdown unless it has a caption or width', () => {
    expect(write({ type: 'imageBlock', attrs: { src: 'a.png', alt: 'A' } })).toBe('![A](a.png)\n');
    expect(write({ type: 'imageBlock', attrs: { src: 'a.png', alt: 'A', width: '50%' } })).toBe(
      '<figure data-type="image" data-width="50%"><img src="a.png" alt="A"></figure>\n',
    );
  });

  it('keeps the title of a captioned or sized image', () => {
    const image: PmNode = {
      type: 'imageBlock',
      attrs: { src: 'a.png', alt: 'A', title: 'T "q"', caption: 'Cap' },
    };
    const written = write(image);
    expect(written).toBe(
      '<figure data-type="image"><img src="a.png" alt="A" title="T &quot;q&quot;">' +
        '<figcaption>Cap</figcaption></figure>\n',
    );
    expect(blocks(written)).toEqual([image]);
  });

  it('leaves out empty source and URL attributes', () => {
    expect(write({ type: 'imageBlock', attrs: { src: '', alt: 'A', width: '50%' } })).toBe(
      '<figure data-type="image" data-width="50%"><img alt="A"></figure>\n',
    );
    expect(write({ type: 'embed', attrs: { src: '' } })).not.toContain('data-src');
    expect(write({ type: 'bookmark', attrs: { url: '' } })).not.toContain('data-url');
  });

  it('round-trips every written custom block to the same document', () => {
    const doc: PmNode = {
      type: 'doc',
      content: [
        {
          type: 'toggle',
          attrs: { summary: 'Outer', open: false },
          content: [
            {
              type: 'columns',
              content: [
                { type: 'column', content: [paragraph('A')] },
                {
                  type: 'column',
                  content: [
                    {
                      type: 'callout',
                      attrs: { icon: 'i', color: 'c' },
                      content: [paragraph('B')],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(parseMarkdownDocument(serializeMarkdownDocument(doc)).doc).toEqual(doc);
  });
});

describe('custom blocks: lossless saves', () => {
  it('keeps unbalanced tags byte for byte', () => {
    for (const source of [
      '<details>\n<summary>S</summary>\n\nBody\n',
      '</div>\n\nText\n',
      '<div data-type="column">\n\nC\n\n</div>\n',
    ]) {
      expect(unchanged(source)).toBe(source);
    }
  });

  it('splits toggles that share an HTML block and rewrites only the edited one', () => {
    const source =
      '<details>\n<summary>A</summary>\n\nOne\n\n</details>\n<details>\n<summary>B</summary>\n\nTwo\n\n</details>\n';
    const parsed = parseMarkdownDocument(source);
    expect(parsed.doc.content?.map((block) => block.attrs?.summary)).toEqual(['A', 'B']);
    expect(parsed.sources).toEqual([
      '<details>\n<summary>A</summary>\n\nOne\n\n</details>\n',
      '<details>\n<summary>B</summary>\n\nTwo\n\n</details>\n',
    ]);
    const [first, second] = parsed.doc.content!;
    const edited = { ...second!, content: [paragraph('Changed')] };
    // The edited toggle is regenerated, so a blank line separates it from the reused one.
    expect(serializeMarkdownDocument({ type: 'doc', content: [first!, edited] }, parsed)).toBe(
      '<details>\n<summary>A</summary>\n\nOne\n\n</details>\n\n' +
        '<details>\n<summary>B</summary>\n\nChanged\n\n</details>\n',
    );
    // Unedited, the shared block is saved byte for byte.
    expect(unchanged(source)).toBe(source);
  });
});
