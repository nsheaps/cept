/**
 * Shared test helpers for storage-related tests.
 */

import type {
  StorageBackend,
  BackendCapabilities,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
  WorkspaceConfig,
} from '@cept/core';

/** In-memory StorageBackend for testing */
export class MemoryBackend implements StorageBackend {
  readonly type = 'browser' as const;
  readonly capabilities: BackendCapabilities = {
    history: false,
    collaboration: false,
    sync: false,
    branching: false,
    externalEditing: false,
    watchForExternalChanges: false,
  };

  private files = new Map<string, Uint8Array>();

  async readFile(path: string): Promise<Uint8Array | null> {
    return this.files.get(this.normalize(path)) ?? null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(this.normalize(path), data);
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.normalize(path);
    for (const key of [...this.files.keys()]) {
      if (key === normalized || key.startsWith(normalized + '/')) {
        this.files.delete(key);
      }
    }
  }

  async listDirectory(_path: string): Promise<DirEntry[]> {
    return [];
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalize(path));
  }

  watch(_path: string, _callback: (event: FsEvent) => void): Unsubscribe {
    return () => {};
  }

  async stat(_path: string): Promise<FileStat | null> {
    return null;
  }

  async initialize(_config: WorkspaceConfig): Promise<void> {}

  async close(): Promise<void> {}

  private normalize(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  /** Test helper: check if a file exists */
  hasFile(path: string): boolean {
    return this.files.has(this.normalize(path));
  }

  /** Test helper: read file as UTF-8 string */
  readText(path: string): string | null {
    const data = this.files.get(this.normalize(path));
    if (!data) return null;
    return new TextDecoder().decode(data);
  }

  /** Test helper: write a UTF-8 string */
  seedText(path: string, text: string): void {
    this.files.set(this.normalize(path), new TextEncoder().encode(text));
  }

  /** Test helper: seed a JSON-serializable value */
  seedFile(path: string, data: unknown): void {
    this.files.set(this.normalize(path), new TextEncoder().encode(JSON.stringify(data)));
  }
}
