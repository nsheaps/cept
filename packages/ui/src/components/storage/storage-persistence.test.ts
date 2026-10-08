import { describe, it, expect, vi } from 'vitest';
import {
  LOW_QUOTA_BYTES,
  checkStoragePersistence,
  storageWarningText,
} from './storage-persistence.js';
import type { StorageManagerLike } from './storage-persistence.js';

const MB = 1024 * 1024;
const GB = 1024 * MB;

function storage(overrides: Partial<StorageManagerLike> = {}): StorageManagerLike {
  return {
    persisted: vi.fn(async () => false),
    persist: vi.fn(async () => true),
    estimate: vi.fn(async () => ({ usage: 10 * MB, quota: 10 * GB })),
    ...overrides,
  };
}

describe('checkStoragePersistence (REQ-WEB-004)', () => {
  it('asks for persistent storage and warns about nothing once it is granted', async () => {
    const s = storage();
    expect(await checkStoragePersistence(s)).toEqual([]);
    expect(s.persist).toHaveBeenCalledOnce();
  });

  it('does not ask again when storage is already persistent', async () => {
    const s = storage({ persisted: vi.fn(async () => true) });
    expect(await checkStoragePersistence(s)).toEqual([]);
    expect(s.persist).not.toHaveBeenCalled();
  });

  it('warns when the browser refuses persistent storage', async () => {
    const s = storage({ persist: vi.fn(async () => false) });
    expect(await checkStoragePersistence(s)).toEqual([{ kind: 'not-persistent' }]);
  });

  it('asks even when the browser cannot say whether storage is persistent', async () => {
    const s = storage({ persisted: undefined, persist: vi.fn(async () => false) });
    expect(await checkStoragePersistence(s)).toEqual([{ kind: 'not-persistent' }]);
  });

  it('warns when little room is left', async () => {
    const quota = 200 * MB;
    const usage = quota - LOW_QUOTA_BYTES + 1;
    const s = storage({ estimate: vi.fn(async () => ({ usage, quota })) });
    expect(await checkStoragePersistence(s)).toEqual([{ kind: 'low-quota', usage, quota }]);
  });

  it('warns when nine tenths of the quota is used', async () => {
    const quota = 10 * GB;
    const usage = 9 * GB;
    const s = storage({ estimate: vi.fn(async () => ({ usage, quota })) });
    expect(await checkStoragePersistence(s)).toEqual([{ kind: 'low-quota', usage, quota }]);
  });

  it('reports both problems together', async () => {
    const s = storage({
      persist: vi.fn(async () => false),
      estimate: vi.fn(async () => ({ usage: 95 * MB, quota: 100 * MB })),
    });
    expect((await checkStoragePersistence(s)).map((w) => w.kind)).toEqual([
      'not-persistent',
      'low-quota',
    ]);
  });

  it('stays quiet when the browser has no storage manager or an estimate is unknown', async () => {
    expect(await checkStoragePersistence(null)).toEqual([]);
    expect(await checkStoragePersistence({})).toEqual([]);
    const s = storage({ persisted: vi.fn(async () => true), estimate: vi.fn(async () => ({})) });
    expect(await checkStoragePersistence(s)).toEqual([]);
  });

  it('treats a persist() that throws as a refusal', async () => {
    const s = storage({
      persist: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    expect(await checkStoragePersistence(s)).toEqual([{ kind: 'not-persistent' }]);
  });

  it('still asks when persisted() throws, and stays quiet when the estimate fails', async () => {
    const s = storage({
      persisted: vi.fn(async () => {
        throw new Error('denied');
      }),
      estimate: vi.fn(async () => {
        throw new Error('denied');
      }),
    });
    expect(await checkStoragePersistence(s)).toEqual([]);
    expect(s.persist).toHaveBeenCalledOnce();
  });
});

describe('storageWarningText', () => {
  it('explains a refused request', () => {
    expect(storageWarningText({ kind: 'not-persistent' })).toMatch(/may clear/);
  });

  it('gives the usage and quota of a low quota', () => {
    expect(storageWarningText({ kind: 'low-quota', usage: 95 * MB, quota: 100 * MB })).toBe(
      'Browser storage is almost full: 95 MB of 100 MB used. Free some room or link spaces to GitHub so nothing is lost.',
    );
    expect(storageWarningText({ kind: 'low-quota', usage: 1.5 * GB, quota: 2 * GB })).toContain(
      '1.5 GB of 2 GB',
    );
  });
});
