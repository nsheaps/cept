/**
 * Meta-tests for the import-boundary gates in eslint.config.js
 * (`@nx/enforce-module-boundaries` and `cept/restricted-imports`):
 *
 * - every fixture in tools/boundary-fixtures/ trips the rule its header names
 *   (or nothing, for `expect: none`) when linted as the path its header names;
 * - every baseline entry still matches a real import, so fixed violations are
 *   removed from the baseline;
 * - the baseline never grows past the entries recorded when the gate landed.
 *
 * The tests lint with the repo's real config, so they prove the gate CI runs.
 * `@nx/enforce-module-boundaries` reads Nx's cached project graph; run them
 * through `mise run test:integration` (an Nx target), which creates it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it, vi } from 'vitest';
import { readBaseline, ROOT } from './boundaries.js';

vi.setConfig({ testTimeout: 60_000 });

const FIXTURES = path.join(ROOT, 'tools/boundary-fixtures');

/** The baseline when the gate landed (PR 8). Entries may be removed, never added. */
const BASELINE_AT_PR_8 = [
  'packages/core/src/storage/local-fs.ts|platform|node:fs/promises|',
  'packages/core/src/storage/local-fs.ts|platform|node:path|',
  'packages/core/src/storage/local-fs.ts|platform|node:fs|',
  'packages/ui/src/components/App.tsx|isomorphic-git|isomorphic-git/http/web|',
  'packages/ui/src/components/App.tsx|concrete-backend|@cept/core|BrowserFsBackend',
  'packages/ui/src/components/storage/git-space.ts|concrete-backend|@cept/core|GitBackend',
  'packages/ui/src/components/storage/git-space.ts|concrete-backend|@cept/core|BrowserFsBackend',
];

const BOUNDARY_RULES = ['@nx/enforce-module-boundaries', 'cept/restricted-imports'];

interface Fixture {
  name: string;
  code: string;
  lintAs: string;
  /** `none`, or a rule id optionally followed by text its message must contain. */
  expect: string;
}

function readFixtures(): Fixture[] {
  return readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.ts'))
    .map((name) => {
      const code = readFileSync(path.join(FIXTURES, name), 'utf8');
      const lintAs = /^\/\/ lint-as: (.+)$/m.exec(code)?.[1];
      const expected = /^\/\/ expect: (.+)$/m.exec(code)?.[1];
      if (!lintAs || !expected) throw new Error(`${name} needs "// lint-as:" and "// expect:"`);
      return { name, code, lintAs, expect: expected };
    });
}

/** Boundary-rule messages as `rule message`; other rules (unused vars, require) are ignored. */
async function boundaryMessages(eslint: ESLint, code: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(ROOT, file) });
  return (result?.messages ?? [])
    .filter((m) => m.ruleId !== null && BOUNDARY_RULES.includes(m.ruleId))
    .map((m) => `${m.ruleId} ${m.message}`);
}

describe('boundary fixtures', () => {
  const eslint = new ESLint({ cwd: ROOT });
  const fixtures = readFixtures();

  it('has fixtures for both rules and a clean one', () => {
    const expects = fixtures.map((f) => f.expect.split(' ')[0]);
    expect(expects).toEqual(expect.arrayContaining([...BOUNDARY_RULES, 'none']));
  });

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', async (_name, fixture) => {
    const messages = await boundaryMessages(eslint, fixture.code, fixture.lintAs);
    if (fixture.expect === 'none') {
      expect(messages).toEqual([]);
      return;
    }
    const [rule = '', ...text] = fixture.expect.split(' ');
    const hits = messages.filter((m) => m.startsWith(`${rule} `) && m.includes(text.join(' ')));
    expect(hits, `messages: ${JSON.stringify(messages)}`).not.toEqual([]);
  });
});

describe('boundary baseline', () => {
  const baseline = readBaseline();

  it('only shrinks: every entry was in the baseline when the gate landed', () => {
    const keys = baseline.map((e) => `${e.file}|${e.group}|${e.module}|${e.name ?? ''}`);
    expect(BASELINE_AT_PR_8).toEqual(expect.arrayContaining(keys));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no stale entries: each one still matches an import in its file', async () => {
    const eslint = new ESLint({
      cwd: ROOT,
      overrideConfig: { rules: { 'cept/restricted-imports': ['error', { baseline: [] }] } },
    });
    for (const entry of baseline) {
      const code = readFileSync(path.join(ROOT, entry.file), 'utf8');
      const messages = await boundaryMessages(eslint, code, entry.file);
      const what = entry.name ? `"${entry.name}" from "${entry.module}"` : `"${entry.module}"`;
      const match = messages.some(
        (m) => m.startsWith(`cept/restricted-imports ${what} `) && m.endsWith(`[${entry.group}]`),
      );
      expect(match, `${entry.file}: ${what} [${entry.group}] is no longer imported`).toBe(true);
    }
  });
});
