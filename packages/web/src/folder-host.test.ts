import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { WebFsBackend } from '@cept/core';
import { createFolderHost } from './folder-host.js';

describe('createFolderHost', () => {
  it('is null where the browser cannot open folders', () => {
    expect(createFolderHost('cept-test-folders', {})).toBeNull();
  });

  it('picks with the browser picker and opens folders through WebFsBackend', async () => {
    const folder = { kind: 'directory', name: 'notes' } as unknown as FileSystemDirectoryHandle;
    const showDirectoryPicker = vi.fn(async () => folder);
    const host = createFolderHost('cept-test-folders', { showDirectoryPicker })!;

    expect(await host.pick()).toBe(folder);
    expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(host.open(folder)).toBeInstanceOf(WebFsBackend);
  });

  it('keeps picked folders in its own database', async () => {
    const host = createFolderHost('cept-test-folders-db', { showDirectoryPicker: () => null })!;
    const folder = { kind: 'directory', name: 'notes' } as unknown as FileSystemDirectoryHandle;
    await host.handles.save('folder-1', folder);
    expect((await host.handles.list()).map((e) => e.id)).toEqual(['folder-1']);
  });
});
