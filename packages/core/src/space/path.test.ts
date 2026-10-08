import { describe, it, expect } from 'vitest';
import { splitPath, normalizeFolder, joinPath, parentFolder, toBackendPath } from './path.js';

describe('space path helpers', () => {
  it('splits on / only and drops empty and . segments', () => {
    expect(splitPath('/a//./b/')).toEqual(['a', 'b']);
    expect(splitPath('a\\b')).toEqual(['a\\b']);
    expect(splitPath('../a')).toEqual(['..', 'a']);
  });

  it('normalizes every spelling of the root to an empty string', () => {
    for (const root of ['', '/', '.', './', '//']) expect(normalizeFolder(root)).toBe('');
    expect(normalizeFolder('/notes/')).toBe('notes');
  });

  it('joins pieces into canonical form', () => {
    expect(joinPath('', 'a')).toBe('a');
    expect(joinPath('a/', '/b', 'c.md')).toBe('a/b/c.md');
  });

  it('returns the parent, and null above the root', () => {
    expect(parentFolder('a/b')).toBe('a');
    expect(parentFolder('a')).toBe('');
    expect(parentFolder('')).toBeNull();
  });

  it('builds the absolute form backends are called with', () => {
    expect(toBackendPath('')).toBe('/');
    expect(toBackendPath('notes/')).toBe('/notes');
  });
});
