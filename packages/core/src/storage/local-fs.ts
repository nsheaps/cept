/**
 * LocalFsBackend — StorageBackend implementation using Node.js fs.
 *
 * "Open Folder" experience: user picks a directory on disk and Cept reads/writes
 * plain Markdown files there. Files are directly editable with any text editor.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { watch as fsWatch, type FSWatcher } from 'node:fs';
import type {
  StorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
} from './backend.js';

const LOCAL_CAPABILITIES: BackendCapabilities = {
  history: false,
  collaboration: false,
  sync: false,
  branching: false,
  externalEditing: true,
  watchForExternalChanges: true,
};

export class LocalFsBackend implements StorageBackend {
  readonly type = 'local' as const;
  readonly capabilities: BackendCapabilities = LOCAL_CAPABILITIES;

  private rootDir: string;
  private watchers: Map<string, FSWatcher> = new Map();
  private callbacks: Map<string, Set<(event: FsEvent) => void>> = new Map();

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  async readFile(filePath: string): Promise<Uint8Array | null> {
    try {
      const data = await fs.readFile(this.resolve(filePath));
      return new Uint8Array(data);
    } catch {
      return null;
    }
  }

  async writeFile(filePath: string, data: Uint8Array): Promise<void> {
    const resolved = this.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, data);
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const resolved = this.resolve(filePath);
      const s = await fs.stat(resolved);
      if (s.isDirectory()) {
        await fs.rm(resolved, { recursive: true });
      } else {
        await fs.unlink(resolved);
      }
    } catch {
      // File doesn't exist — no-op
    }
  }

  async listDirectory(dirPath: string): Promise<DirEntry[]> {
    try {
      const resolved = this.resolve(dirPath);
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
      }));
    } catch {
      return [];
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(this.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  watch(watchPath: string, callback: (event: FsEvent) => void): Unsubscribe {
    const resolved = this.resolve(watchPath);

    let callbackSet = this.callbacks.get(resolved);
    if (!callbackSet) {
      callbackSet = new Set();
      this.callbacks.set(resolved, callbackSet);
    }
    callbackSet.add(callback);

    // Set up fs.watch if not already watching this path
    if (!this.watchers.has(resolved)) {
      try {
        const watcher = fsWatch(resolved, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const cbs = this.callbacks.get(resolved);
          if (!cbs) return;
          const fsEvent: FsEvent = {
            type: eventType === 'rename' ? 'create' : 'modify',
            path: filename,
          };
          for (const cb of cbs) {
            cb(fsEvent);
          }
        });
        this.watchers.set(resolved, watcher);
      } catch {
        // Path doesn't exist yet — watch will start on next call
      }
    }

    return () => {
      callbackSet.delete(callback);
      if (callbackSet.size === 0) {
        this.callbacks.delete(resolved);
        const watcher = this.watchers.get(resolved);
        if (watcher) {
          watcher.close();
          this.watchers.delete(resolved);
        }
      }
    };
  }

  async stat(filePath: string): Promise<FileStat | null> {
    try {
      const s = await fs.stat(this.resolve(filePath));
      return {
        size: s.size,
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
        modifiedAt: s.mtime,
        createdAt: s.birthtime,
      };
    } catch {
      return null;
    }
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    // Create workspace directories
    await fs.mkdir(this.resolve('pages'), { recursive: true });
    await fs.mkdir(this.resolve('.cept/databases'), { recursive: true });
    await fs.mkdir(this.resolve('.cept/assets'), { recursive: true });
    await fs.mkdir(this.resolve('.cept/templates'), { recursive: true });

    // Create workspace config
    const configYaml = `name: "${config.name}"\nicon: "${config.icon ?? '📝'}"\ndefaultPage: "${config.defaultPage ?? 'pages/index.md'}"\n`;
    await fs.writeFile(this.resolve('.cept/config.yaml'), configYaml, 'utf-8');

    // Create root page if it doesn't exist
    const rootPagePath = this.resolve('pages/index.md');
    try {
      await fs.stat(rootPagePath);
    } catch {
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
      await fs.writeFile(rootPagePath, rootPage, 'utf-8');
    }
  }

  async close(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.callbacks.clear();
  }

  /** Resolve a workspace-relative path to an absolute path */
  private resolve(relativePath: string): string {
    // Strip leading slash for path.join
    const cleaned = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return path.join(this.rootDir, cleaned);
  }
}
