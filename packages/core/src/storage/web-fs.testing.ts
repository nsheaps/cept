/**
 * In-memory mock of the File System Access API, shared by the WebFsBackend
 * unit tests and the storage conformance suite. Test-only (excluded from build).
 */

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

  async getFile(): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    size: number;
    lastModified: number;
  }> {
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

  async createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }> {
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

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
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

export function createMockRoot(): FileSystemDirectoryHandle {
  return new MockDirectoryHandle('root') as unknown as FileSystemDirectoryHandle;
}
