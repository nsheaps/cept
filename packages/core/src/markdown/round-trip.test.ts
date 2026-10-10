/**
 * Lossless round-trip corpus (phase-1 plan, PRs 45 and 47).
 *
 * Each fixture in `__fixtures__/round-trip/` goes through the Markdown
 * pipeline (`parseMarkdownDocument` / `serializeMarkdownDocument`) three ways:
 *
 * 1. Loaded and saved without edits, it comes back byte for byte (EDT-005).
 * 2. Written fresh from its document (as after editing every block) and
 *    parsed again, it is the same document: the bridge loses no content.
 * 3. Written fresh, it is byte for byte the input. Fixtures that are not yet
 *    are listed in `expected-failures.json` with the normalization they get;
 *    for those the test asserts the output still differs, so a fix turns them
 *    red until their entry is removed. Entries are removed, never added.
 */
import { describe, expect, it } from 'vitest';
import { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';
import expectedFailures from './__fixtures__/round-trip/expected-failures.json';

const fixtures = import.meta.glob<string>('./__fixtures__/round-trip/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const expected: Record<string, string> = expectedFailures;

function fixtureName(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '');
}

const corpus = Object.entries(fixtures)
  .map(([path, source]) => ({ name: fixtureName(path), source }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Every block rewritten: the document serialized without its sources. */
function fresh(source: string): string {
  const parsed = parseMarkdownDocument(source);
  return serializeMarkdownDocument(parsed.doc, undefined, parsed.frontMatter);
}

describe('markdown round-trip corpus', () => {
  it('has fixtures', () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  it('lists only existing fixtures as expected failures, each with a reason', () => {
    const names = new Set(corpus.map((f) => f.name));
    for (const [name, reason] of Object.entries(expected)) {
      expect(names.has(name), `${name} is not a fixture`).toBe(true);
      expect(reason.trim(), `${name} needs a reason`).not.toBe('');
    }
  });

  for (const { name, source } of corpus) {
    it(`${name} is unchanged when loaded and saved`, () => {
      const parsed = parseMarkdownDocument(source);
      expect(serializeMarkdownDocument(parsed.doc, parsed)).toBe(source);
    });

    it(`${name} keeps its content when every block is rewritten`, () => {
      expect(parseMarkdownDocument(fresh(source)).doc).toEqual(parseMarkdownDocument(source).doc);
    });

    if (name in expected) {
      // Must still differ from the input: once it is written byte for byte
      // this fails until the entry is removed.
      it(`${name} is normalized when rewritten (expected failure)`, () => {
        expect(fresh(source)).not.toBe(source);
      });
    } else {
      it(`${name} is written byte for byte when rewritten`, () => {
        expect(fresh(source)).toBe(source);
      });
    }
  }
});
