import { describe, expect, it } from 'vitest';
import { isAffected } from './nx-affected';

const never = (): string => {
  throw new Error('nx should not run');
};

describe('isAffected', () => {
  it('treats every project as affected without NX_BASE', () => {
    expect(isAffected('@cept/e2e', {}, never)).toBe(true);
    expect(isAffected('@cept/e2e', { NX_BASE: '' }, never)).toBe(true);
  });

  it('asks nx for the affected projects between NX_BASE and NX_HEAD', () => {
    const calls: string[][] = [];
    const nx = (args: string[]): string => {
      calls.push(args);
      return JSON.stringify(['@cept/ui', '@cept/e2e']);
    };
    expect(isAffected('@cept/e2e', { NX_BASE: 'abc', NX_HEAD: 'def' }, nx)).toBe(true);
    expect(calls).toEqual([
      ['show', 'projects', '--affected', '--json', '--base=abc', '--head=def'],
    ]);
  });

  it('reports a project nx does not list as unaffected', () => {
    const nx = (): string => JSON.stringify(['@cept/signaling']);
    expect(isAffected('@cept/e2e', { NX_BASE: 'abc' }, nx)).toBe(false);
  });

  it('propagates an nx failure instead of skipping', () => {
    const nx = (): string => {
      throw new Error('boom');
    };
    expect(() => isAffected('@cept/e2e', { NX_BASE: 'abc' }, nx)).toThrow('boom');
  });

  it('counts a changed also-path as affecting the project', () => {
    const files = (): string[] => ['.github/workflows/_test-e2e.yml', 'docs/x.md'];
    const nx = (): string => JSON.stringify([]);
    expect(
      isAffected('@cept/e2e', { NX_BASE: 'abc' }, nx, ['.github/workflows/_test-e2e.yml'], files),
    ).toBe(true);
  });

  it('ignores also-paths that did not change', () => {
    const files = (): string[] => ['docs/x.md'];
    const nx = (): string => JSON.stringify([]);
    expect(
      isAffected('@cept/e2e', { NX_BASE: 'abc' }, nx, ['.github/workflows/_test-e2e.yml'], files),
    ).toBe(false);
  });

  it('asks git for the changed files between NX_BASE and NX_HEAD', () => {
    const seen: string[][] = [];
    const files = (base: string, head: string): string[] => {
      seen.push([base, head]);
      return [];
    };
    isAffected('@cept/e2e', { NX_BASE: 'abc', NX_HEAD: 'def' }, () => '[]', ['w.yml'], files);
    expect(seen).toEqual([['abc', 'def']]);
  });
});
