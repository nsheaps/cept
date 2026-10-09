import { describe, expect, it } from 'vitest';
import {
  firstHeading,
  frontMatterKeyBlocks,
  frontMatterPrefix,
  joinFrontMatter,
  pageTitle,
  readFrontMatter,
  setFrontMatterKey,
  splitFrontMatter,
} from './front-matter.js';

const BOM = '﻿';

describe('splitFrontMatter', () => {
  const cases: Record<string, string> = {
    plain: '---\ntitle: A\n---\n# Body\n',
    noFrontMatter: '# Body\n\ntext\n',
    empty: '',
    bom: `${BOM}---\ntitle: A\n---\nbody`,
    dotsCloser: '---\ntitle: A\n...\nbody\n',
    crlf: '---\r\ntitle: A\r\n---\r\nbody\r\n',
    unclosed: '---\ntitle: A\nbody\n',
    closerAtEof: '---\ntitle: A\n---',
    emptyBlock: '---\n---\nbody',
    trailingSpaces: '--- \ntitle: A\n---  \nbody',
    thematicBreakLater: '# Title\n\n---\n\ntext\n',
  };

  for (const [name, text] of Object.entries(cases)) {
    it(`joins back byte for byte (${name})`, () => {
      expect(joinFrontMatter(splitFrontMatter(text))).toBe(text);
    });
  }

  it('separates the block, YAML and body', () => {
    expect(splitFrontMatter(cases.plain!)).toEqual({
      bom: '',
      block: '---\ntitle: A\n---\n',
      yaml: 'title: A\n',
      body: '# Body\n',
    });
  });

  it('keeps a byte order mark outside the block', () => {
    const split = splitFrontMatter(cases.bom!);
    expect(split.bom).toBe(BOM);
    expect(split.yaml).toBe('title: A\n');
    expect(split.body).toBe('body');
  });

  it('accepts a `...` closing line', () => {
    expect(splitFrontMatter(cases.dotsCloser!).yaml).toBe('title: A\n');
  });

  it('handles CRLF line endings', () => {
    const split = splitFrontMatter(cases.crlf!);
    expect(split.yaml).toBe('title: A\r\n');
    expect(split.body).toBe('body\r\n');
  });

  it('treats an unclosed block as body', () => {
    expect(splitFrontMatter(cases.unclosed!)).toMatchObject({ block: null, yaml: null });
  });

  it('treats a later `---` as body, not front matter', () => {
    expect(splitFrontMatter(cases.thematicBreakLater!).block).toBeNull();
  });

  it('returns the prefix before the body', () => {
    expect(frontMatterPrefix(cases.bom!)).toBe(`${BOM}---\ntitle: A\n---\n`);
    expect(frontMatterPrefix(cases.noFrontMatter!)).toBe('');
    expect(frontMatterPrefix('---\na: 1\n---\n\n  \n# Body\n')).toBe('---\na: 1\n---\n\n  \n');
  });
});

describe('readFrontMatter', () => {
  it('reads the reserved keys', () => {
    const meta = readFrontMatter(
      [
        'title: Hello',
        'icon: "🚀"',
        'cover: img/cover.png',
        'tags: [a, b]',
        'aliases: other',
        'description: Short',
        'created: 2026-01-02',
        'updated: 2026-01-03T04:05:06Z',
        'order: 3',
        'id: 42',
        'custom: kept but not read',
      ].join('\n'),
    );
    expect(meta).toEqual({
      title: 'Hello',
      icon: '🚀',
      cover: 'img/cover.png',
      tags: ['a', 'b'],
      aliases: ['other'],
      description: 'Short',
      created: '2026-01-02',
      updated: '2026-01-03T04:05:06Z',
      order: 3,
      id: '42',
      warnings: [],
    });
  });

  it('reads the compatibility aliases when the reserved key is absent', () => {
    expect(readFrontMatter('date: 2026-01-02\nlastmod: 2026-02-03')).toMatchObject({
      created: '2026-01-02',
      updated: '2026-02-03',
    });
    expect(readFrontMatter('modified: 2026-02-03').updated).toBe('2026-02-03');
  });

  it('prefers the reserved key over an alias', () => {
    expect(readFrontMatter('date: 2020-01-01\ncreated: 2026-01-02').created).toBe('2026-01-02');
  });

  it('ignores values of the wrong type with a warning', () => {
    const meta = readFrontMatter('title: [a, b]\ntags: {x: 1}\ncreated: soon\norder: first');
    expect(meta.title).toBeUndefined();
    expect(meta.tags).toEqual([]);
    expect(meta.created).toBeUndefined();
    expect(meta.order).toBeUndefined();
    expect(meta.warnings).toHaveLength(4);
    expect(meta.warnings.join('\n')).toContain('`title`');
  });

  it('names the alias in a wrong-type warning', () => {
    expect(readFrontMatter('date: tomorrow').warnings[0]).toContain('`date`');
  });

  it('warns on invalid YAML and reads nothing', () => {
    const meta = readFrontMatter('title: [unclosed');
    expect(meta.title).toBeUndefined();
    expect(meta.warnings[0]).toMatch(/not valid YAML/);
  });

  it('warns when the front matter is not a mapping', () => {
    expect(readFrontMatter('- a\n- b').warnings).toEqual(['Front matter is not a set of keys']);
  });

  it('returns empty metadata for no or empty front matter', () => {
    expect(readFrontMatter(null)).toEqual({ tags: [], aliases: [], warnings: [] });
    expect(readFrontMatter('')).toEqual({ tags: [], aliases: [], warnings: [] });
    expect(readFrontMatter('# only a comment\n')).toEqual({ tags: [], aliases: [], warnings: [] });
  });

  it('skips null values without a warning', () => {
    expect(readFrontMatter('title:\ntags:').warnings).toEqual([]);
  });
});

describe('firstHeading and pageTitle', () => {
  it('finds the first level-1 heading outside code fences', () => {
    expect(firstHeading('```\n# not this\n```\n\n## nor this\n# This one #\n')).toBe('This one');
    expect(firstHeading('~~~\n```\n# still code\n~~~\n# Real\n')).toBe('Real');
    expect(firstHeading('text only')).toBeUndefined();
  });

  it('uses the front matter title first', () => {
    expect(pageTitle({ title: ' Set ' }, '# Heading', 'a/b.md')).toBe('Set');
  });

  it('falls back to the first heading', () => {
    expect(pageTitle({}, 'intro\n# Heading\n', 'a/b.md')).toBe('Heading');
  });

  it('falls back to the file name', () => {
    expect(pageTitle({}, 'no heading', 'notes/My Page.md')).toBe('My Page');
  });

  it('uses the folder name for README and index pages', () => {
    expect(pageTitle({}, '', 'projects/Alpha/README.md')).toBe('Alpha');
    expect(pageTitle({}, '', 'projects/Beta/index.md')).toBe('Beta');
    expect(pageTitle({}, '', 'README.md')).toBe('README');
  });
});

describe('frontMatterKeyBlocks', () => {
  it('groups list items and comments with their keys', () => {
    expect(frontMatterKeyBlocks(['a: 1', '# about b', 'b:', '- x', '  - y', 'c: 2'])).toEqual([
      { key: 'a', lines: ['a: 1'] },
      { key: 'b', lines: ['# about b', 'b:', '- x', '  - y'] },
      { key: 'c', lines: ['c: 2'] },
    ]);
  });

  it('returns null for a repeated key', () => {
    expect(frontMatterKeyBlocks(['a: 1', 'a: 2'])).toBeNull();
  });
});

describe('setFrontMatterKey', () => {
  const page = '---\n# Hugo page\ntitle: Old\ntags:\n  - a\n  - b\ncustom: { x: 1 }\n---\n# Body\n';

  it('changes only the edited key', () => {
    expect(setFrontMatterKey(page, 'title', 'New')).toBe(
      '---\n# Hugo page\ntitle: New\ntags:\n  - a\n  - b\ncustom: { x: 1 }\n---\n# Body\n',
    );
  });

  it('replaces a multi-line value', () => {
    expect(setFrontMatterKey(page, 'tags', ['c'])).toBe(
      '---\n# Hugo page\ntitle: Old\ntags:\n  - c\ncustom: { x: 1 }\n---\n# Body\n',
    );
  });

  it('appends a new key at the end', () => {
    expect(setFrontMatterKey(page, 'icon', '🚀')).toBe(
      '---\n# Hugo page\ntitle: Old\ntags:\n  - a\n  - b\ncustom: { x: 1 }\nicon: 🚀\n---\n# Body\n',
    );
  });

  it('removes a cleared key and keeps the comment above it', () => {
    expect(setFrontMatterKey(page, 'title', undefined)).toBe(
      '---\n# Hugo page\ntags:\n  - a\n  - b\ncustom: { x: 1 }\n---\n# Body\n',
    );
  });

  it('adds a block only when metadata is set', () => {
    expect(setFrontMatterKey('# Body\n', 'title', 'T')).toBe('---\ntitle: T\n---\n# Body\n');
    expect(setFrontMatterKey('# Body\n', 'title', undefined)).toBe('# Body\n');
  });

  it('keeps the byte order mark, CRLF and a `...` closer', () => {
    expect(setFrontMatterKey(`${BOM}---\r\ntitle: A\r\n...\r\nbody`, 'title', 'B')).toBe(
      `${BOM}---\r\ntitle: B\r\n...\r\nbody`,
    );
    expect(setFrontMatterKey('body\r\n', 'title', 'T')).toBe('---\r\ntitle: T\r\n---\r\nbody\r\n');
  });

  it('never rewrites invalid YAML or repeated keys', () => {
    const invalid = '---\ntitle: [unclosed\n---\nbody';
    expect(setFrontMatterKey(invalid, 'title', 'X')).toBe(invalid);
    const repeated = '---\na: 1\na: 2\n---\nbody';
    expect(setFrontMatterKey(repeated, 'title', 'X')).toBe(repeated);
  });

  it('edits a quoted key', () => {
    expect(setFrontMatterKey('---\n"title": A\n---\n', 'title', 'B')).toBe('---\ntitle: B\n---\n');
  });

  it('adds a key to a block holding only comments', () => {
    expect(setFrontMatterKey('---\n# note\n---\n', 'title', 'T')).toBe(
      '---\n# note\ntitle: T\n---\n',
    );
  });

  it('removing the only key leaves an empty block', () => {
    expect(setFrontMatterKey('---\ntitle: A\n---\nbody', 'title', undefined)).toBe(
      '---\n---\nbody',
    );
  });
});
