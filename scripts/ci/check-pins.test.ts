import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findUnpinnedTools } from './check-pins';

describe('findUnpinnedTools', () => {
  it('accepts exact versions', () => {
    expect(findUnpinnedTools('[tools]\nbun = "1.4.2"\nnode = "24.21.0"\n')).toEqual([]);
  });

  it('rejects partial, latest, range and prefixed versions', () => {
    const toml = [
      '[tools]',
      'bun = "1"',
      'node = "24.1"',
      'gitleaks = "latest"',
      'actionlint = "^1.7.12"',
      '"aqua:foo/bar" = "prefix:1.2"',
      '',
    ].join('\n');
    expect(findUnpinnedTools(toml)).toEqual([
      'bun = "1"',
      'node = "24.1"',
      'gitleaks = "latest"',
      'actionlint = "^1.7.12"',
      '"aqua:foo/bar" = "prefix:1.2"',
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
