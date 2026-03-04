/**
 * Tests for WebFsBackend — the File System Access API StorageBackend.
 *
 * Uses an in-memory mock of FileSystemDirectoryHandle since the real
 * API is only available in browsers.
 */

import { describe, it, expect } from 'vitest';
import { WebFsBackend } from './web-fs.js';

// ---------------------------------------------------------------------------
// In-memory mock of the File System Access API
// ---------------------------------------------------------------------------

class MockFileHandle {
  kind = 'file' as const;
  name: string;
  private data: Uint8Array;

  constructor(name: string, data: Uint8Array = new Uint8Array()) {
    this.name = name;
    this.data = data;
  }

  async getFile(): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; size: number; lastModified: number }> {
    const buf = this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    );
    return {
      arrayBuffer: async () => buf,
      size: this.data.byteLength,
      lastModified: Date.now(),
    };
  }

  async createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void> }> {
    return {
      write: async (d: Uint8Array) => {
        this.data = new Uint8Array(d);
      },
      close: async () => {},
    };
  }
}

class MockDirectoryHandle {
  kind = 'directory' as const;
  name: string;
  private files = new Map<string, MockFileHandle>();
  private dirs = new Map<string, MockDirectoryHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getFileHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<MockFileHandle> {
    let handle = this.files.get(name);
    if (!handle) {
      if (opts?.create) {
        handle = new MockFileHandle(name);
        this.files.set(name, handle);
      } else {
        throw new DOMException('Not found', 'NotFoundError');
      }
    }
    return handle;
  }

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<MockDirectoryHandle> {
    let handle = this.dirs.get(name);
    if (!handle) {
      if (opts?.create) {
        handle = new MockDirectoryHandle(name);
        this.dirs.set(name, handle);
      } else {
        throw new DOMException('Not found', 'NotFoundError');
      }
    }
    return handle;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.dirs.delete(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
  }

  // AsyncIterable for listDirectory
  async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, { kind: 'file' | 'directory' }]> {
    for (const [name, handle] of this.files) {
      yield [name, handle];
    }
    for (const [name, handle] of this.dirs) {
      yield [name, handle];
    }
  }
}

function createMockRoot(): FileSystemDirectoryHandle {
  return new MockDirectoryHandle('root') as unknown as FileSystemDirectoryHandle;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebFsBackend', () => {
  it('has type local and correct capabilities', () => {
    const backend = new WebFsBackend(createMockRoot());
    expect(backend.type).toBe('local');
    expect(backend.capabilities.externalEditing).toBe(true);
    expect(backend.capabilities.watchForExternalChanges).toBe(false);
    expect(backend.capabilities.history).toBe(false);
  });

  it('reads and writes files', async () => {
    const backend = new WebFsBackend(createMockRoot());
    const data = new TextEncoder().encode('hello world');
    await backend.writeFile('test.txt', data);

    const read = await backend.readFile('test.txt');
    expect(read).not.toBeNull();
    expect(new TextDecoder().decode(read!)).toBe('hello world');
  });

  it('reads non-existent file returns null', async () => {
    const backend = new WebFsBackend(createMockRoot());
    const result = await backend.readFile('does-not-exist.txt');
    expect(result).toBeNull();
  });

  it('writes to nested directories', async () => {
    const backend = new WebFsBackend(createMockRoot());
    const data = new TextEncoder().encode('nested content');
    await backend.writeFile('pages/sub/page.md', data);

    const read = await backend.readFile('pages/sub/page.md');
    expect(read).not.toBeNull();
    expect(new TextDecoder().decode(read!)).toBe('nested content');
  });

  it('handles leading slash in paths', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('/test.txt', new TextEncoder().encode('data'));
    const read = await backend.readFile('/test.txt');
    expect(new TextDecoder().decode(read!)).toBe('data');
  });

  it('deletes files', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('delete-me.txt', new TextEncoder().encode('bye'));
    expect(await backend.exists('delete-me.txt')).toBe(true);

    await backend.deleteFile('delete-me.txt');
    expect(await backend.exists('delete-me.txt')).toBe(false);
  });

  it('delete of non-existent file is a no-op', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await expect(backend.deleteFile('nope.txt')).resolves.not.toThrow();
  });

  it('lists directory entries', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('dir/a.txt', new TextEncoder().encode('a'));
    await backend.writeFile('dir/b.txt', new TextEncoder().encode('b'));

    const entries = await backend.listDirectory('dir');
    expect(entries.length).toBe(2);
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['a.txt', 'b.txt']);
    expect(entries[0].isFile).toBe(true);
  });

  it('lists empty directory returns empty', async () => {
    const backend = new WebFsBackend(createMockRoot());
    const entries = await backend.listDirectory('nonexistent');
    expect(entries).toEqual([]);
  });

  it('exists returns true for files', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('exists.txt', new TextEncoder().encode('hi'));
    expect(await backend.exists('exists.txt')).toBe(true);
    expect(await backend.exists('nope.txt')).toBe(false);
  });

  it('stat returns file metadata', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('stat-test.txt', new TextEncoder().encode('content'));

    const s = await backend.stat('stat-test.txt');
    expect(s).not.toBeNull();
    expect(s!.isFile).toBe(true);
    expect(s!.isDirectory).toBe(false);
    expect(s!.size).toBe(7); // "content" is 7 bytes
    expect(s!.modifiedAt).toBeInstanceOf(Date);
  });

  it('stat returns null for non-existent path', async () => {
    const backend = new WebFsBackend(createMockRoot());
    const s = await backend.stat('nope.txt');
    expect(s).toBeNull();
  });

  it('initialize creates workspace structure', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.initialize({ name: 'Test Workspace' });

    expect(await backend.exists('.cept/config.yaml')).toBe(true);
    expect(await backend.exists('pages/index.md')).toBe(true);

    const config = await backend.readFile('.cept/config.yaml');
    expect(new TextDecoder().decode(config!)).toContain('Test Workspace');
  });

  it('initialize does not overwrite existing root page', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await backend.writeFile('pages/index.md', new TextEncoder().encode('# Existing'));
    await backend.initialize({ name: 'New' });

    const content = await backend.readFile('pages/index.md');
    expect(new TextDecoder().decode(content!)).toBe('# Existing');
  });

  it('watch returns unsubscribe function', () => {
    const backend = new WebFsBackend(createMockRoot());
    const unsub = backend.watch('/', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('close succeeds without error', async () => {
    const backend = new WebFsBackend(createMockRoot());
    await expect(backend.close()).resolves.not.toThrow();
  });

  it('exposes directoryHandle getter', () => {
    const handle = createMockRoot();
    const backend = new WebFsBackend(handle);
    expect(backend.directoryHandle).toBe(handle);
  });
});
