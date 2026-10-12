import { describe, it, expect } from 'vitest';
import type { GitAuthRecord } from '@cept/core';
import { LocalStorageAuthIndexStore } from './auth-index-store.js';

function memoryStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('k', initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const record: GitAuthRecord = {
  id: 'a1',
  host: 'github.com',
  username: 'x-access-token',
  label: '@alice',
  status: 'ok',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('LocalStorageAuthIndexStore', () => {
  it('reads nothing as an empty list', async () => {
    expect(await new LocalStorageAuthIndexStore('k', memoryStorage()).load()).toEqual([]);
  });

  it('saves and loads the records', async () => {
    const storage = memoryStorage();
    const store = new LocalStorageAuthIndexStore('k', storage);
    await store.save([record]);
    expect(await new LocalStorageAuthIndexStore('k', storage).load()).toEqual([record]);
  });

  it('reads damaged or non-list data as empty', async () => {
    expect(await new LocalStorageAuthIndexStore('k', memoryStorage('{oops')).load()).toEqual([]);
    expect(await new LocalStorageAuthIndexStore('k', memoryStorage('{"a":1}')).load()).toEqual([]);
  });
});
