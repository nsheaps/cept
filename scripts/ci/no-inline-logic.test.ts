import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ALLOWLIST, findInlineLogic } from './no-inline-logic';

const step = (run: string) => `jobs:\n  a:\n    steps:\n      - name: x\n        ${run}\n`;

describe('findInlineLogic', () => {
  it('accepts single-line runs, including expressions with && and ||', () => {
    expect(findInlineLogic(step('run: mise run lint'))).toEqual([]);
    expect(findInlineLogic(step("run: mise run x ${{ a && '--b' || '' }}"))).toEqual([]);
  });

  it('accepts a block with one command, comments and a continued command', () => {
    const block = step('run: |\n          # why\n          cmd --a \\\n            --b\n');
    expect(findInlineLogic(block)).toEqual([]);
  });

  it('flags a block with more than one command', () => {
    const v = findInlineLogic(step('run: |\n          one\n          two\n'));
    expect(v).toEqual([{ line: 5, reason: 'run block has 2 commands' }]);
  });

  it('flags chained single-line commands', () => {
    expect(findInlineLogic(step('run: cd a && b'))).toHaveLength(1);
    expect(findInlineLogic(step('run: a || true'))).toHaveLength(1);
    expect(findInlineLogic(step('run: a; b'))).toHaveLength(1);
  });

  it('stops a block at the next key', () => {
    const yaml = step('run: |\n          one\n        env:\n          A: b\n');
    expect(findInlineLogic(yaml)).toEqual([]);
  });
});

describe('no-inline-logic CLI', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'inline-logic-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = () =>
    spawnSync('bun', [path.resolve(__dirname, 'no-inline-logic.ts'), dir], { encoding: 'utf8' });

  it('fails on a workflow with inline logic and skips allowlisted files', () => {
    writeFileSync(path.join(dir, 'bad.yml'), step('run: |\n          one\n          two\n'));
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('bad.yml:5');

    rmSync(path.join(dir, 'bad.yml'));
    const [allowed] = Object.keys(ALLOWLIST);
    writeFileSync(path.join(dir, allowed ?? ''), step('run: a && b'));
    writeFileSync(path.join(dir, 'ok.yml'), step('run: mise run lint'));
    expect(run().status).toBe(0);
  });
});
