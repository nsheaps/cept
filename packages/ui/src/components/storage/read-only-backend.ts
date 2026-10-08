/**
 * A backend that reads through to another and refuses every write, so a space
 * that must not change on this device (a GitHub space with no editing session,
 * for example while signed out) cannot be edited by any code path.
 */

import type {
  BackendCapabilities,
  DirEntry,
  FileStat,
  FsEvent,
  StorageBackend,
  Unsubscribe,
} from '@cept/core';

export class ReadOnlyBackend implements StorageBackend {
  readonly type: StorageBackend['type'];
  readonly capabilities: BackendCapabilities;

  constructor(
    private readonly inner: StorageBackend,
    /** Why writes are refused, as the error message. */
    private readonly reason: string,
  ) {
    this.type = inner.type;
    this.capabilities = inner.capabilities;
  }

  readFile(path: string): Promise<Uint8Array | null> {
    return this.inner.readFile(path);
  }

  writeFile(): Promise<void> {
    return Promise.reject(new Error(this.reason));
  }

  deleteFile(): Promise<void> {
    return Promise.reject(new Error(this.reason));
  }

  listDirectory(path: string): Promise<DirEntry[]> {
    return this.inner.listDirectory(path);
  }

  exists(path: string): Promise<boolean> {
    return this.inner.exists(path);
  }

  stat(path: string): Promise<FileStat | null> {
    return this.inner.stat(path);
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    return this.inner.watch(path, callback);
  }

  initialize(): Promise<void> {
    return Promise.reject(new Error(this.reason));
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}
