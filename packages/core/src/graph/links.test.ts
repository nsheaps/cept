import { describe, it, expect } from 'vitest';
import {
  extractLinks,
  resolveLink,
  resolvePath,
  baseFileOfPage,
  pageIdForPath,
  headingSlugs,
} from './links.js';

describe('extractLinks', () => {
  it('finds inline links with their text and offsets', () => {
    const md = 'See [Setup](guides/setup.md) and [home](../README.md).';
    const links = extractLinks(md);
    expect(links.map((l) => [l.url, l.text])).toEqual([
      ['guides/setup.md', 'Setup'],
      ['../README.md', 'home'],
    ]);
    expect(md.slice(links[0]!.start, links[0]!.end)).toBe('[Setup](guides/setup.md)');
  });

  it('resolves reference-style links through their definitions', () => {
    const md = 'Read [Setup][S] or [again][s] or [missing][nope].\n\n[S]: guides/setup.md\n';
    expect(extractLinks(md).map((l) => l.url)).toEqual(['guides/setup.md', 'guides/setup.md']);
  });

  it('does not read links in code, math, images, HTML or front matter', () => {
    const md = [
      '---',
      'related: "[x](front.md)"',
      '---',
      'A `[code](code.md)` span.',
      '',
      '```',
      '[block](block.md)',
      '```',
      '',
      '![image](image.png) <a href="html.md">html</a> $[m](math.md)$',
      '',
      '[real](real.md)',
    ].join('\n');
    expect(extractLinks(md).map((l) => l.url)).toEqual(['real.md']);
  });

  it('counts offsets from the start of the text, front matter included', () => {
    const md = '---\ntitle: T\n---\n[a](a.md)\n';
    const [link] = extractLinks(md);
    expect(md.slice(link!.start, link!.end)).toBe('[a](a.md)');
  });

  it('reads the text of formatted links', () => {
    expect(extractLinks('[**bold** and `code`](a.md)')[0]!.text).toBe('bold and code');
  });
});

describe('resolveLink', () => {
  it('resolves relative paths against the linking page', () => {
    expect(resolveLink('guides/setup.md', 'install.md')).toEqual({ path: 'guides/install.md' });
    expect(resolveLink('guides/setup.md', '../README.md')).toEqual({ path: 'README.md' });
    expect(resolveLink('guides/setup.md', './a/./b.md')).toEqual({ path: 'guides/a/b.md' });
    expect(resolveLink('README.md', 'guides/setup.md')).toEqual({ path: 'guides/setup.md' });
  });

  it('treats a leading slash as the space root', () => {
    expect(resolveLink('a/b/c.md', '/guides/setup.md')).toEqual({ path: 'guides/setup.md' });
  });

  it('keeps and decodes anchors, and links to the page itself for a bare anchor', () => {
    expect(resolveLink('a.md', 'b.md#Some%20Heading')).toEqual({
      path: 'b.md',
      anchor: 'Some Heading',
    });
    expect(resolveLink('a/x.md', '#below')).toEqual({ path: 'a/x.md', anchor: 'below' });
    expect(resolveLink('a.md', 'b.md#')).toEqual({ path: 'b.md' });
  });

  it('ignores the query string and decodes the path', () => {
    expect(resolveLink('a.md', 'my%20page.md?raw=1')).toEqual({ path: 'my page.md' });
    expect(resolveLink('a.md', 'bad%E0%A4%A.md')).toEqual({ path: 'bad%E0%A4%A.md' });
  });

  it('returns null for anything that is not a page in the space', () => {
    expect(resolveLink('a.md', 'https://example.com/x.md')).toBeNull();
    expect(resolveLink('a.md', 'mailto:me@example.com')).toBeNull();
    expect(resolveLink('a.md', '//example.com/x.md')).toBeNull();
    expect(resolveLink('a.md', '')).toBeNull();
    expect(resolveLink('a.md', '../outside.md')).toBeNull();
    expect(resolveLink('a/b.md', '../../outside.md')).toBeNull();
    expect(resolveLink('a.md', 'image.png')).toBeNull();
    expect(resolveLink('a.md', 'folder/')).toBeNull();
  });

  it('accepts .markdown pages', () => {
    expect(resolveLink('a.md', 'b.markdown')).toEqual({ path: 'b.markdown' });
  });
});

describe('resolvePath', () => {
  it('resolves any target, not just pages', () => {
    expect(resolvePath('a/b.md', 'img/pic.png')).toEqual({ path: 'a/img/pic.png' });
    expect(resolvePath('a/b.md', '../assets/pic%20one.png')).toEqual({
      path: 'assets/pic one.png',
    });
    expect(resolvePath('a/b.md', '/assets/pic.png')).toEqual({ path: 'assets/pic.png' });
    expect(resolvePath('a/b.md', './x/./y.pdf#page=2')).toEqual({
      path: 'a/x/y.pdf',
      anchor: 'page=2',
    });
  });

  it('keeps a bare folder path', () => {
    expect(resolvePath('a/b.md', '../guides/')).toEqual({ path: 'guides' });
  });

  it('is null for external URLs, escapes and empty input', () => {
    expect(resolvePath('a.md', 'https://x.test/p.png')).toBeNull();
    expect(resolvePath('a.md', 'data:image/png;base64,AAAA')).toBeNull();
    expect(resolvePath('a.md', '//cdn.test/p.png')).toBeNull();
    expect(resolvePath('a.md', '../p.png')).toBeNull();
    expect(resolvePath('a.md', '')).toBeNull();
  });
});

describe('baseFileOfPage', () => {
  it('is the file itself for a file page and a stand-in index for a folder page', () => {
    expect(baseFileOfPage('a/b.md')).toBe('a/b.md');
    expect(baseFileOfPage('a/b')).toBe('a/b/index.md');
  });
});

describe('pageIdForPath', () => {
  const pages = new Set(['a/b.md', 'guides', 'README.md']);
  const has = (id: string) => pages.has(id);

  it('finds a file page, a folder page by folder, and a folder page by its index file', () => {
    expect(pageIdForPath('a/b.md', has)).toBe('a/b.md');
    expect(pageIdForPath('guides', has)).toBe('guides');
    expect(pageIdForPath('guides/README.md', has)).toBe('guides');
    expect(pageIdForPath('guides/index.md', has)).toBe('guides');
    expect(pageIdForPath('README.md', has)).toBe('README.md');
  });

  it('is null when there is no such page', () => {
    expect(pageIdForPath('missing.md', has)).toBeNull();
    expect(pageIdForPath('a/other.md', has)).toBeNull();
    expect(pageIdForPath('', has)).toBeNull();
  });
});

describe('headingSlugs', () => {
  it('follows GitHub: lowercase, punctuation removed, spaces to dashes, repeats numbered', () => {
    expect(
      headingSlugs(['Hello, World!', 'Install', 'Install', 'Install', 'A_b-c  d', 'Café 2']),
    ).toEqual(['hello-world', 'install', 'install-1', 'install-2', 'a_b-c--d', 'café-2']);
  });
});
