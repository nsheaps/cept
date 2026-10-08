import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findFakeGreen } from './no-fake-green';

describe('findFakeGreen', () => {
  it('flags an upload that only warns when the artifact is missing', () => {
    expect(findFakeGreen('        with:\n          if-no-files-found: warn\n')).toEqual([
      { line: 2, reason: expect.stringContaining('if-no-files-found') },
    ]);
    expect(findFakeGreen('          if-no-files-found: ignore')).toHaveLength(1);
  });

  it('accepts an upload that fails on a missing artifact', () => {
    expect(findFakeGreen('          if-no-files-found: error')).toEqual([]);
  });

  it('flags a step whose failure is ignored', () => {
    expect(findFakeGreen('        continue-on-error: true')).toHaveLength(1);
    expect(findFakeGreen('        continue-on-error: ${{ matrix.allow-fail }}')).toHaveLength(1);
    expect(findFakeGreen('        continue-on-error: false')).toEqual([]);
  });

  it('flags a Capacitor sync in a workflow or a script', () => {
    expect(findFakeGreen('        run: npx cap sync ios')).toHaveLength(1);
    expect(findFakeGreen('npx cap sync "$1"')).toHaveLength(1);
  });

  it('flags a release upload whose errors are swallowed', () => {
    const line = 'gh release upload "$TAG" dist/*.dmg --clobber 2>/dev/null || true';
    expect(findFakeGreen(line)).toHaveLength(1);
    expect(findFakeGreen('gh release upload "$TAG" dist/*.dmg --clobber')).toEqual([]);
  });

  it('allows || true outside release uploads and ignores comments', () => {
    expect(findFakeGreen('git fetch origin gh-pages || true')).toEqual([]);
    expect(findFakeGreen('# never use continue-on-error: true here')).toEqual([]);
  });
});

describe('no-fake-green CLI', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fake-green-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = () =>
    spawnSync('bun', [path.resolve(__dirname, 'no-fake-green.ts'), dir], { encoding: 'utf8' });

  it('fails on a fake-green workflow and passes once it is fixed', () => {
    writeFileSync(path.join(dir, 'cd.yml'), 'jobs:\n  a:\n    continue-on-error: true\n');
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('cd.yml:3');

    writeFileSync(path.join(dir, 'cd.yml'), 'jobs:\n  a:\n    runs-on: ubuntu-latest\n');
    expect(run().status).toBe(0);
  });

  it('scans subdirectories too', () => {
    mkdirSync(path.join(dir, 'release'), { recursive: true });
    writeFileSync(path.join(dir, 'release', 'upload.sh'), 'gh release upload v1 a.dmg || true\n');
    const bad = run();
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain(path.join('release', 'upload.sh') + ':1');
    rmSync(path.join(dir, 'release'), { recursive: true });
  });
});
