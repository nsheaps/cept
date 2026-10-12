import { describe, expect, it } from 'vitest';
import { NEW_FINE_GRAINED_TOKEN_URL, newTokenUrl, tokenPermissions } from './token-url.js';

describe('newTokenUrl', () => {
  it('opens the fine-grained token form with a name, a description and contents write', () => {
    const url = new URL(newTokenUrl());

    expect(`${url.origin}${url.pathname}`).toBe(NEW_FINE_GRAINED_TOKEN_URL);
    expect(url.searchParams.get('name')).toBe('Cept');
    expect(url.searchParams.get('description')).toMatch(/clone and sync/);
    expect(url.searchParams.get('contents')).toBe('write');
    expect(url.searchParams.has('administration')).toBe(false);
  });

  it('asks for administration only when Cept may create repositories', () => {
    const url = new URL(newTokenUrl({ createRepos: true }));

    expect(url.searchParams.get('administration')).toBe('write');
    expect(url.searchParams.get('description')).toMatch(/create repositories/);
    expect(tokenPermissions({ createRepos: true })).toEqual({
      contents: 'write',
      administration: 'write',
    });
  });

  it('keeps the name within the 40 characters GitHub allows and the description within 1024', () => {
    const url = new URL(newTokenUrl({ name: 'x'.repeat(80), createRepos: true }));

    expect(url.searchParams.get('name')).toHaveLength(40);
    expect(url.searchParams.get('description')!.length).toBeLessThanOrEqual(1024);
  });
});
