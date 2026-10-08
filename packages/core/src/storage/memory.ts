/**
 * MemoryBackend — StorageBackend implementation that keeps everything in a Map.
 *
 * Intended for tests and for ephemeral workspaces. Directories are implicit:
 * a directory exists while at least one file lives under it (the root always
 * exists). Behaviour is pinned by the shared backend conformance suite.
 *
 * `watch()` reports changes made through this instance (in-process), so it
 * works even though the backend cannot observe "external" changes
 * (`capabilities.watchForExternalChanges` is false, like BrowserFsBackend).
 */

import type {
  StorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
} from './backend.js';

const MEMORY_CAPABILITIES: BackendCapabilities = {
  history: false,
  collaboration: false,
  sync: false,
  branching: false,
  externalEditing: false,
  watchForExternalChanges: false,
};

interface MemoryFile {
  data: Uint8Array;
  createdAt: Date;
  modifiedAt: Date;
}

interface Watcher {
  path: string;
  callback: (event: FsEvent) => void;
}

export class MemoryBackend implements StorageBackend {
  // Reports 'browser' because, like BrowserFsBackend, it has no disk, history or
  // sync. Code that branches on `type === 'browser'` cannot tell the two apart;
  // branch on `capabilities` instead (architecture rule 4).
  readonly type = 'browser' as const;
  readonly capabilities: BackendCapabilities = MEMORY_CAPABILITIES;

  private files = new Map<string, MemoryFile>();
  private watchers = new Set<Watcher>();

  async readFile(path: string): Promise<Uint8Array | null> {
    const file = this.files.get(normalize(path));
    return file ? new Uint8Array(file.data) : null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.put(normalize(path), data);
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = normalize(path);
    const removed: string[] = [];
    for (const key of [...this.files.keys()]) {
      if (key === normalized || isUnder(key, normalized)) {
        this.files.delete(key);
        removed.push(key);
      }
    }
    for (const key of removed) {
      this.emit(key, 'delete');
    }
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    const dir = normalize(path);
    const prefix = dir === '/' ? '/' : `${dir}/`;
    const entries = new Map<string, DirEntry>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf('/');
      const name = slash === -1 ? rest : rest.slice(0, slash);
      if (!entries.has(name)) {
        const isDirectory = slash !== -1;
        entries.set(name, { name, isDirectory, isFile: !isDirectory });
      }
    }
    return [...entries.values()];
  }

  async exists(path: string): Promise<boolean> {
    return this.kindOf(normalize(path)) !== null;
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    const watcher: Watcher = { path: normalize(path), callback };
    this.watchers.add(watcher);
    return () => {
      this.watchers.delete(watcher);
    };
  }

  async stat(path: string): Promise<FileStat | null> {
    const normalized = normalize(path);
    const file = this.files.get(normalized);
    if (file) {
      return {
        size: file.data.byteLength,
        isDirectory: false,
        isFile: true,
        modifiedAt: file.modifiedAt,
        createdAt: file.createdAt,
      };
    }
    if (this.kindOf(normalized) === 'directory') {
      const now = new Date();
      return { size: 0, isDirectory: true, isFile: false, modifiedAt: now, createdAt: now };
    }
    return null;
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    const encode = (text: string) => new TextEncoder().encode(text);
    const icon = config.icon ?? '\u{1F4DD}';
    const configYaml = `name: "${config.name}"\nicon: "${icon}"\ndefaultPage: "${config.defaultPage ?? 'pages/index.md'}"\n`;
    this.put('/.cept/config.yaml', encode(configYaml));

    if (!this.files.has('/pages/index.md')) {
      const now = new Date().toISOString();
      const rootPage = `---
id: "root"
title: "${config.name}"
icon: "${icon}"
created: "${now}"
modified: "${now}"
tags: []
properties: {}
---

# ${config.name}

Welcome to your new workspace.
`;
      this.put('/pages/index.md', encode(rootPage));
    }
  }

  async close(): Promise<void> {
    this.watchers.clear();
  }

  // -- Test conveniences (synchronous, no events) --

  /** Whether a file (not a directory) exists at `path`. */
  hasFile(path: string): boolean {
    return this.files.has(normalize(path));
  }

  /** Read a file as a UTF-8 string, or null if missing. */
  readText(path: string): string | null {
    const file = this.files.get(normalize(path));
    return file ? new TextDecoder().decode(file.data) : null;
  }

  /** Write a UTF-8 string without emitting watch events. */
  seedText(path: string, text: string): void {
    this.seed(path, new TextEncoder().encode(text));
  }

  /** Write a JSON-serializable value without emitting watch events. */
  seedFile(path: string, data: unknown): void {
    this.seed(path, new TextEncoder().encode(JSON.stringify(data)));
  }

  // -- Internal helpers --

  private seed(path: string, data: Uint8Array): void {
    const normalized = normalize(path);
    const now = new Date();
    this.files.set(normalized, { data: new Uint8Array(data), createdAt: now, modifiedAt: now });
  }

  private put(normalized: string, data: Uint8Array): void {
    // Match real filesystems: a path is either a file or a directory, never both.
    if (this.kindOf(normalized) === 'directory') {
      throw new Error(`EISDIR: cannot write file over directory ${normalized}`);
    }
    for (let dir = parentOf(normalized); dir !== '/'; dir = parentOf(dir)) {
      if (this.files.has(dir)) {
        throw new Error(`ENOTDIR: ${dir} is a file, cannot write ${normalized}`);
      }
    }
    const existing = this.files.get(normalized);
    const now = new Date();
    this.files.set(normalized, {
      data: new Uint8Array(data),
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
    });
    this.emit(normalized, existing ? 'modify' : 'create');
  }

  private kindOf(normalized: string): 'file' | 'directory' | null {
    if (this.files.has(normalized)) return 'file';
    if (normalized === '/') return 'directory';
    for (const key of this.files.keys()) {
      if (isUnder(key, normalized)) return 'directory';
    }
    return null;
  }

  private emit(path: string, type: FsEvent['type']): void {
    for (const watcher of [...this.watchers]) {
      if (path === watcher.path || isUnder(path, watcher.path)) {
        watcher.callback({ type, path });
      }
    }
  }
}

/** Normalize to an absolute path with no trailing slash (root is "/"). */
function normalize(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  const collapsed = withSlash.replace(/\/+/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed;
}

/** The parent directory of `path` ("/" for a top-level path). */
function parentOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash <= 0 ? '/' : path.slice(0, slash);
}

/** True if `path` is strictly inside directory `dir`. */
function isUnder(path: string, dir: string): boolean {
  return dir === '/' ? path !== '/' : path.startsWith(`${dir}/`);
}
