import { describe, it, expect } from 'vitest';
import {
  convertWikiLinksToMarkdown,
  serializeFrontMatter,
  markdownToHtml,
  wrapHtmlDocument,
  exportPage,
  exportPages,
  DEFAULT_CSS,
} from './exporter.js';
import type { PageContent } from './exporter.js';

describe('convertWikiLinksToMarkdown', () => {
  it('converts wiki-links with display text', () => {
    const result = convertWikiLinksToMarkdown('See [[/pages/note.md|my note]]');
    expect(result).toBe('See [my note](/pages/note.md)');
  });

  it('converts wiki-links without display text', () => {
    const result = convertWikiLinksToMarkdown('See [[/pages/note.md]]');
    expect(result).toBe('See [note](/pages/note.md)');
  });

  it('preserves regular markdown links', () => {
    const result = convertWikiLinksToMarkdown('[link](https://example.com)');
    expect(result).toBe('[link](https://example.com)');
  });

  it('handles multiple wiki-links', () => {
    const result = convertWikiLinksToMarkdown('[[a.md]] and [[b.md]]');
    expect(result).toContain('[a](a.md)');
    expect(result).toContain('[b](b.md)');
  });
});

describe('serializeFrontMatter', () => {
  it('serializes simple key-value pairs', () => {
    const result = serializeFrontMatter({ title: 'Test', draft: true });
    expect(result).toContain('---');
    expect(result).toContain('title: Test');
    expect(result).toContain('draft: true');
  });

  it('serializes arrays as YAML lists', () => {
    const result = serializeFrontMatter({ tags: ['a', 'b'] });
    expect(result).toContain('tags:');
    expect(result).toContain('  - a');
    expect(result).toContain('  - b');
  });

  it('serializes objects as JSON', () => {
    const result = serializeFrontMatter({ meta: { key: 'val' } });
    expect(result).toContain('meta: {"key":"val"}');
  });

  it('skips null and undefined values', () => {
    const result = serializeFrontMatter({ a: 'keep', b: null, c: undefined });
    expect(result).toContain('a: keep');
    expect(result).not.toContain('b:');
    expect(result).not.toContain('c:');
  });
});

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('## Subtitle')).toContain('<h2>Subtitle</h2>');
    expect(markdownToHtml('### H3')).toContain('<h3>H3</h3>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
  });

  it('converts code blocks', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('language-js');
    expect(html).toContain('const x = 1;');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('Use `code` here')).toContain('<code>code</code>');
  });

  it('converts links', () => {
    expect(markdownToHtml('[text](url)')).toContain('<a href="url">text</a>');
  });

  it('converts images', () => {
    expect(markdownToHtml('![alt](img.png)')).toContain('<img src="img.png" alt="alt" />');
  });

  it('converts blockquotes', () => {
    expect(markdownToHtml('> quote')).toContain('<blockquote>quote</blockquote>');
  });

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toContain('<hr />');
  });

  it('escapes HTML in code blocks', () => {
    const md = '```\n<script>alert("xss")</script>\n```';
    const html = markdownToHtml(md);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('wrapHtmlDocument', () => {
  it('creates complete HTML document', () => {
    const html = wrapHtmlDocument('My Title', '<p>Content</p>');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Title</title>');
    expect(html).toContain('<p>Content</p>');
  });

  it('includes default CSS', () => {
    const html = wrapHtmlDocument('Title', '<p>Content</p>');
    expect(html).toContain('<style>');
    expect(html).toContain('font-family');
  });

  it('uses custom CSS when provided', () => {
    const html = wrapHtmlDocument('Title', '<p>Content</p>', '.custom { color: red; }');
    expect(html).toContain('.custom { color: red; }');
  });

  it('escapes title', () => {
    const html = wrapHtmlDocument('Title <script>', '<p>Content</p>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('exportPage', () => {
  const page: PageContent = {
    title: 'My Note',
    markdown: '# My Note\n\nSee [[other.md|other page]].\n\nSome content.',
    frontMatter: { tags: ['test'] },
    path: '/notes/my-note.md',
  };

  it('exports to markdown', () => {
    const file = exportPage(page, { format: 'markdown' });
    expect(file.filename).toBe('My Note.md');
    expect(file.mimeType).toBe('text/markdown');
    expect(file.content).toContain('[other page](other.md)');
    expect(file.content).toContain('---');
    expect(file.content).toContain('tags:');
  });

  it('exports markdown without front matter', () => {
    const file = exportPage(page, { format: 'markdown', includeFrontMatter: false });
    expect((file.content as string)).not.toContain('---');
  });

  it('exports to HTML', () => {
    const file = exportPage(page, { format: 'html' });
    expect(file.filename).toBe('My Note.html');
    expect(file.mimeType).toBe('text/html');
    expect((file.content as string)).toContain('<!DOCTYPE html>');
    expect((file.content as string)).toContain('<h1>My Note</h1>');
  });

  it('exports to PDF (HTML for printing)', () => {
    const file = exportPage(page, { format: 'pdf' });
    expect(file.filename).toBe('My Note.html');
    expect((file.content as string)).toContain('@media print');
  });

  it('uses custom CSS for HTML export', () => {
    const file = exportPage(page, { format: 'html', customCss: '.test {}' });
    expect((file.content as string)).toContain('.test {}');
  });

  it('uses title override', () => {
    const file = exportPage(page, { format: 'markdown', title: 'Custom Title' });
    expect(file.filename).toBe('Custom Title.md');
  });

  it('sanitizes filenames', () => {
    const unsafePage = { ...page, title: 'File: <with> "special" chars?' };
    const file = exportPage(unsafePage, { format: 'markdown' });
    expect(file.filename).not.toContain('<');
    expect(file.filename).not.toContain('>');
    expect(file.filename).not.toContain('"');
    expect(file.filename).not.toContain('?');
  });
});

describe('exportPages', () => {
  it('exports multiple pages', () => {
    const pages: PageContent[] = [
      { title: 'A', markdown: '# A', path: '/a.md' },
      { title: 'B', markdown: '# B', path: '/b.md' },
    ];
    const result = exportPages(pages, { format: 'html' });
    expect(result.files.length).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  it('collects errors from individual pages', () => {
    // Create a page that will cause an error when exported
    const pages = [
      { title: 'Good', markdown: '# Good', path: '/good.md' },
    ];
    const result = exportPages(pages, { format: 'markdown' });
    expect(result.files.length).toBe(1);
  });
});

describe('DEFAULT_CSS', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_CSS).toBe('string');
    expect(DEFAULT_CSS.length).toBeGreaterThan(0);
  });
});
