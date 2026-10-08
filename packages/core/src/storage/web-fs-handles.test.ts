/**
 * Tests for keeping folder handles across reloads (REQ-WS-012, REQ-WEB-023):
 * the IndexedDB handle store, the permission check and the restore step.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import {
  createFolderHandleStore,
  folderPermission,
  reconnectFolder,
  restoreFolders,
  type FolderHandleStore,
  type FolderPermission,
} from './web-fs.js';

/** A handle whose permission starts at `initial` and becomes `afterRequest` when asked. */
function mockHandle(
  initial: FolderPermission,
  afterRequest: FolderPermission | 'throws' = initial,
  name = 'notes',
) {
  const handle = {
    kind: 'directory' as const,
    name,
    queryPermission: vi.fn(async () => initial),
    requestPermission: vi.fn(async () => {
      if (afterRequest === 'throws') throw new DOMException('No user gesture', 'SecurityError');
      return afterRequest;
    }),
  };
  return handle as typeof handle & FileSystemDirectoryHandle;
}

/** A FolderHandleStore in memory, which keeps handle methods (IndexedDB clones drop them). */
function memoryStore(entries: [string, FileSystemDirectoryHandle][]): FolderHandleStore {
  const map = new Map(entries);
  return {
    save: async (id, handle) => void map.set(id, handle),
    load: async (id) => map.get(id) ?? null,
    list: async () => [...map].map(([id, handle]) => ({ id, handle })),
    remove: async (id) => void map.delete(id),
  };
}

let dbCount = 0;
const freshDbName = () => `cept-handles-test-${++dbCount}`;

/** A structured-cloneable stand-in for a handle, as IndexedDB stores it. */
const cloneable = (name: string) =>
  ({ kind: 'directory', name }) as unknown as FileSystemDirectoryHandle;

describe('folderPermission', () => {
  it('reports a granted folder without asking', async () => {
    const handle = mockHandle('granted');
    expect(await folderPermission(handle)).toBe('granted');
    expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('reports prompt after a reload and does not ask unless told to', async () => {
    const handle = mockHandle('prompt', 'granted');
    expect(await folderPermission(handle)).toBe('prompt');
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('asks when told to and returns the answer', async () => {
    expect(await folderPermission(mockHandle('prompt', 'granted'), { request: true })).toBe(
      'granted',
    );
    expect(await folderPermission(mockHandle('prompt', 'denied'), { request: true })).toBe(
      'denied',
    );
  });

  it('does not ask again once the user has denied access', async () => {
    const handle = mockHandle('denied', 'granted');
    expect(await folderPermission(handle, { request: true })).toBe('denied');
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('stays at prompt when asking outside a user gesture throws', async () => {
    expect(await folderPermission(mockHandle('prompt', 'throws'), { request: true })).toBe(
      'prompt',
    );
  });

  it('reports prompt without asking when the query itself throws', async () => {
    const handle = mockHandle('granted');
    handle.queryPermission.mockRejectedValueOnce(new DOMException('Gone', 'NotFoundError'));
    expect(await folderPermission(handle, { request: true })).toBe('prompt');
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('treats a handle without the permission API as usable', async () => {
    expect(await folderPermission(cloneable('plain'))).toBe('granted');
  });
});

describe('createFolderHandleStore', () => {
  it('saves, lists and loads handles by space id', async () => {
    const store = createFolderHandleStore(freshDbName());
    await store.save('notes', cloneable('notes'));
    await store.save('work', cloneable('work'));

    expect(await store.load('notes')).toEqual({ kind: 'directory', name: 'notes' });
    expect(await store.load('missing')).toBeNull();
    const listed = await store.list();
    expect(listed.map((e) => e.id).sort()).toEqual(['notes', 'work']);
    expect(listed.find((e) => e.id === 'work')?.handle).toEqual({
      kind: 'directory',
      name: 'work',
    });
  });

  it('keeps handles across a reload (a new store on the same database)', async () => {
    const dbName = freshDbName();
    await createFolderHandleStore(dbName).save('notes', cloneable('notes'));

    const reloaded = createFolderHandleStore(dbName);
    expect(await reloaded.load('notes')).toEqual({ kind: 'directory', name: 'notes' });
  });

  it('replaces a handle saved again under the same id', async () => {
    const store = createFolderHandleStore(freshDbName());
    await store.save('notes', cloneable('old'));
    await store.save('notes', cloneable('new'));
    expect(await store.list()).toEqual([
      { id: 'notes', handle: { kind: 'directory', name: 'new' } },
    ]);
  });

  it('forgets a removed handle', async () => {
    const store = createFolderHandleStore(freshDbName());
    await store.save('notes', cloneable('notes'));
    await store.remove('notes');
    expect(await store.load('notes')).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('keeps separate databases apart (one per deploy)', async () => {
    await createFolderHandleStore(freshDbName()).save('notes', cloneable('notes'));
    expect(await createFolderHandleStore(freshDbName()).list()).toEqual([]);
  });
});

describe('restoreFolders', () => {
  it('reports each saved folder with its permission, without prompting', async () => {
    const granted = mockHandle('granted');
    const prompt = mockHandle('prompt', 'granted');
    const denied = mockHandle('denied');
    const restored = await restoreFolders(
      memoryStore([
        ['a', granted],
        ['b', prompt],
        ['c', denied],
      ]),
    );

    expect(restored.map(({ id, permission }) => [id, permission])).toEqual([
      ['a', 'granted'],
      ['b', 'prompt'],
      ['c', 'denied'],
    ]);
    expect(restored[1]?.handle).toBe(prompt);
    for (const handle of [granted, prompt, denied]) {
      expect(handle.requestPermission).not.toHaveBeenCalled();
    }
  });

  it('restores nothing when the store cannot be read', async () => {
    const broken = memoryStore([]);
    broken.list = () => Promise.reject(new Error('IndexedDB unavailable'));
    expect(await restoreFolders(broken)).toEqual([]);
  });
});

describe('reconnectFolder', () => {
  it('is true when the user grants access again', async () => {
    const handle = mockHandle('prompt', 'granted');
    expect(await reconnectFolder(handle)).toBe(true);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('is false when the user denies access', async () => {
    expect(await reconnectFolder(mockHandle('prompt', 'denied'))).toBe(false);
  });

  it('is false when the browser will not ask (no user gesture)', async () => {
    expect(await reconnectFolder(mockHandle('prompt', 'throws'))).toBe(false);
  });
});
