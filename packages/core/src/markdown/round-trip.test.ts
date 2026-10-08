/**
 * Lossless round-trip corpus (phase-1 plan, PR 45).
 *
 * Every fixture in `__fixtures__/round-trip/` must come back byte for byte
 * after `serialize(parse(input))`. Fixtures that do not yet are listed in
 * `expected-failures.json` with a reason; they run as `it.fails`, so a fix
 * turns them red until their entry is removed. That list is the M3
 * burn-down: entries are removed as PRs fix them, never added.
 */
import { describe, expect, it } from 'vitest';
import { CeptMarkdownParser } from './parser.js';
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

function roundTrip(source: string): string {
  const parser = new CeptMarkdownParser();
  return parser.serialize(parser.parse(source));
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
    const test = name in expected ? it.fails : it;
    test(`${name} round-trips unchanged`, () => {
      expect(roundTrip(source)).toBe(source);
    });
  }
});
