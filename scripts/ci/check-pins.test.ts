import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findUnpinnedTools } from './check-pins';

describe('findUnpinnedTools', () => {
  it('accepts exact versions', () => {
    expect(findUnpinnedTools('[tools]\nbun = "1.4.2"\nnode = "24.21.0"\n')).toEqual([]);
  });

  it('accepts exact prerelease and build versions', () => {
    expect(findUnpinnedTools('[tools]\na = "1.4.2-rc.1"\nb = "1.4.2+build.5"\n')).toEqual([]);
  });

  it('accepts an inline table with an exact version and trailing comments', () => {
    const toml =
      '[tools]\npython = { version = "3.11.9", virtualenv = ".venv" }\nbun = "1.4.2" # lockfile\n';
    expect(findUnpinnedTools(toml)).toEqual([]);
  });

  it('rejects partial, latest, range and prefixed versions', () => {
    const toml = [
      '[tools]',
      'bun = "1"',
      'node = "24.1"',
      'gitleaks = "latest"',
      'actionlint = "^1.7.12"',
      '"aqua:foo/bar" = "prefix:1.2"',
      'python = { version = "3.11" }',
      '',
    ].join('\n');
    expect(findUnpinnedTools(toml)).toEqual([
      'bun = "1"',
      'node = "24.1"',
      'gitleaks = "latest"',
      'actionlint = "^1.7.12"',
      '"aqua:foo/bar" = "prefix:1.2"',
      'python = { version = "3.11" }',
    ]);
  });

  it('reports value forms it cannot read as unpinned', () => {
    const toml =
      '[tools]\npython = ["3.11.9", "3.12.4"]\nbun = \'1.4.2\'\nruby = { virtualenv = "x" }\n';
    expect(findUnpinnedTools(toml)).toEqual([
      'python = ["3.11.9", "3.12.4"]',
      "bun = '1.4.2'",
      'ruby = { virtualenv = "x" }',
    ]);
  });

  it('ignores keys outside [tools]', () => {
    expect(findUnpinnedTools('[env]\nFOO = "1"\n[tools]\nbun = "1.4.2"\n')).toEqual([]);
  });

  it('passes on the repository .mise.toml', () => {
    const toml = readFileSync(path.resolve(__dirname, '../../.mise.toml'), 'utf8');
    expect(findUnpinnedTools(toml)).toEqual([]);
  });
});

describe('check-pins CLI', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-pins-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = (toml: string) => {
    const file = path.join(dir, 'mise.toml');
    writeFileSync(file, toml);
    return spawnSync('bun', [path.resolve(__dirname, 'check-pins.ts'), file], { encoding: 'utf8' });
  };

  it('exits 0 when every tool is pinned', () => {
    const result = run('[tools]\nbun = "1.4.2"\n');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('all tools pinned exactly');
  });

  it('exits 1 and lists the unpinned lines', () => {
    const result = run('[tools]\nbun = "1"\nnode = "24.21.0"\n');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('bun = "1"');
    expect(result.stderr).not.toContain('node = "24.21.0"');
  });
});
