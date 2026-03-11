/**
 * BrowserFsBackend — StorageBackend implementation using @isomorphic-git/lightning-fs.
 *
 * Uses IndexedDB for persistence via lightning-fs. Works in any modern browser
 * with zero setup — no accounts, no server, no installation required.
 */

import FS from '@isomorphic-git/lightning-fs';
import type {
  StorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
} from './backend.js';

const BROWSER_CAPABILITIES: BackendCapabilities = {
  history: false,
  collaboration: false,
  sync: false,
  branching: false,
  externalEditing: false,
  watchForExternalChanges: false,
};

export class BrowserFsBackend implements StorageBackend {
  readonly type = 'browser' as const;
  readonly capabilities: BackendCapabilities = BROWSER_CAPABILITIES;

  private fs: FS;
  private pfs: FS.PromisifiedFS;
  private watchers: Map<string, Set<(event: FsEvent) => void>> = new Map();

  constructor(dbName: string = 'cept-workspace') {
    this.fs = new FS(dbName);
    this.pfs = this.fs.promises;
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    try {
      const data = await this.pfs.readFile(this.normalizePath(path));
      if (typeof data === 'string') {
        return new TextEncoder().encode(data);
      }
      return new Uint8Array(data);
    } catch {
      return null;
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const normalized = this.normalizePath(path);
    await this.ensureParentDir(normalized);
    await this.pfs.writeFile(normalized, data);
    this.emitEvent(path, 'modify');
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    try {
      const s = await this.pfs.stat(normalized);
      if (s.isDirectory()) {
        await this.removeRecursive(normalized);
      } else {
        await this.pfs.unlink(normalized);
      }
      this.emitEvent(path, 'delete');
    } catch {
      // File doesn't exist — no-op
    }
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    const normalized = this.normalizePath(path);
    try {
      const names = await this.pfs.readdir(normalized);
      const entries: DirEntry[] = [];
      for (const name of names) {
        const fullPath = normalized === '/' ? `/${name}` : `${normalized}/${name}`;
        try {
          const s = await this.pfs.stat(fullPath);
          entries.push({
            name,
            isDirectory: s.isDirectory(),
            isFile: !s.isDirectory(),
          });
        } catch {
          // Skip entries we can't stat
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.pfs.stat(this.normalizePath(path));
      return true;
    } catch {
      return false;
    }
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    const normalized = this.normalizePath(path);
    let callbacks = this.watchers.get(normalized);
    if (!callbacks) {
      callbacks = new Set();
      this.watchers.set(normalized, callbacks);
    }
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.watchers.delete(normalized);
      }
    };
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      const s = await this.pfs.stat(this.normalizePath(path));
      return {
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: !s.isDirectory(),
        modifiedAt: new Date(s.mtimeMs),
        createdAt: new Date(s.ctimeMs),
      };
    } catch {
      return null;
    }
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    // Create workspace root directories
    await this.ensureDir('/pages');
    await this.ensureDir('/.cept');
    await this.ensureDir('/.cept/databases');
    await this.ensureDir('/.cept/assets');
    await this.ensureDir('/.cept/templates');

    // Create workspace config
    const configYaml = `name: "${config.name}"\nicon: "${config.icon ?? '📝'}"\ndefaultPage: "${config.defaultPage ?? 'pages/index.md'}"\n`;
    await this.writeFile('.cept/config.yaml', new TextEncoder().encode(configYaml));

    // Create root page if it doesn't exist
    if (!(await this.exists('pages/index.md'))) {
      const now = new Date().toISOString();
      const rootPage = `---
id: "root"
title: "${config.name}"
icon: "${config.icon ?? '📝'}"
created: "${now}"
modified: "${now}"
tags: []
properties: {}
---

# ${config.name}

Welcome to your new workspace.
`;
      await this.writeFile('pages/index.md', new TextEncoder().encode(rootPage));
    }
  }

  async close(): Promise<void> {
    this.watchers.clear();
  }

  // -- Internal helpers --

  private normalizePath(path: string): string {
    // Ensure path starts with /
    const normalized = path.startsWith('/') ? path : `/${path}`;
    // Remove trailing slash (except for root)
    return normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
  }

  private async ensureDir(path: string): Promise<void> {
    const normalized = this.normalizePath(path);
    try {
      await this.pfs.stat(normalized);
    } catch {
      try {
        await this.pfs.mkdir(normalized);
      } catch {
        // Directory may have been created concurrently — ignore
      }
    }
  }

  private async ensureParentDir(normalizedPath: string): Promise<void> {
    const parts = normalizedPath.split('/').filter(Boolean);
    // Build each parent directory
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += '/' + parts[i];
      try {
        await this.pfs.stat(current);
      } catch {
        try {
          await this.pfs.mkdir(current);
        } catch {
          // Directory may have been created concurrently — ignore
        }
      }
    }
  }

  private async removeRecursive(path: string): Promise<void> {
    const entries = await this.pfs.readdir(path);
    for (const entry of entries) {
      const fullPath = `${path}/${entry}`;
      const s = await this.pfs.stat(fullPath);
      if (s.isDirectory()) {
        await this.removeRecursive(fullPath);
      } else {
        await this.pfs.unlink(fullPath);
      }
    }
    await this.pfs.rmdir(path);
  }

  private emitEvent(path: string, type: FsEvent['type']): void {
    const normalized = this.normalizePath(path);
    // Notify watchers on the exact path
    const exact = this.watchers.get(normalized);
    if (exact) {
      for (const cb of exact) {
        cb({ type, path: normalized });
      }
    }
    // Notify watchers on parent directories
    const parentPath = normalized.substring(0, normalized.lastIndexOf('/')) || '/';
    const parent = this.watchers.get(parentPath);
    if (parent) {
      for (const cb of parent) {
        cb({ type, path: normalized });
      }
    }
  }
}
