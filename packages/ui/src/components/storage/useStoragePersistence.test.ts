import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStoragePersistence } from './useStoragePersistence.js';

describe('useStoragePersistence (REQ-WEB-004)', () => {
  it('asks once per page load and shows a warning per problem', async () => {
    const storage = {
      persisted: vi.fn(async () => false),
      persist: vi.fn(async () => false),
      estimate: vi.fn(async () => ({ usage: 99, quota: 100 })),
    };
    const warn = vi.fn();
    const { result } = renderHook(() => useStoragePersistence(warn, storage));

    await result.current();
    await result.current();

    expect(storage.persist).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[0]).toMatch(/may clear your spaces/);
    expect(warn.mock.calls[1]?.[0]).toMatch(/almost full/);
  });

  it('shows nothing once persistent storage is granted', async () => {
    const storage = { persist: vi.fn(async () => true) };
    const warn = vi.fn();
    const { result } = renderHook(() => useStoragePersistence(warn, storage));
    await result.current();
    expect(warn).not.toHaveBeenCalled();
  });
});
