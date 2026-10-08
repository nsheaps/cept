/**
 * LocalFsBackend — StorageBackend implementation using Node.js fs.
 *
 * "Open Folder" experience: user picks a directory on disk and Cept reads/writes
 * plain Markdown files there. Files are directly editable with any text editor.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync, mkdirSync, watch as fsWatch, type FSWatcher } from 'node:fs';
import type {
  StorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
} from '@cept/core';

const LOCAL_CAPABILITIES: BackendCapabilities = {
  history: false,
  collaboration: false,
  sync: false,
  branching: false,
  externalEditing: true,
  watchForExternalChanges: true,
};

interface WatchListener {
  path: string;
  callback: (event: FsEvent) => void;
}

/** Workspace-relative path with a leading "/" and "/" separators, no trailing slash. */
function toWorkspacePath(p: string): string {
  const posix = p.split(path.sep).join('/');
  const withSlash = posix.startsWith('/') ? posix : `/${posix}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

function isAtOrUnder(eventPath: string, watched: string): boolean {
  return watched === '/' || eventPath === watched || eventPath.startsWith(`${watched}/`);
}

export class LocalFsBackend implements StorageBackend {
  readonly type = 'local' as const;
  readonly capabilities: BackendCapabilities = LOCAL_CAPABILITIES;

  private rootDir: string;
  private rootWatcher: FSWatcher | null = null;
  private listeners = new Set<WatchListener>();

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
    // One recursive watcher on the workspace root serves every subscription, so
    // watching a sub-path that does not exist yet still works once it is created.
    // The root itself must exist for fs.watch, so it is created if missing
    // (creating an empty folder never touches existing files).
    // Events carry workspace-relative paths with a leading "/", like the other
    // backends, and are delivered for any change at or under the watched path.
    const listener: WatchListener = { path: toWorkspacePath(watchPath), callback };
    this.listeners.add(listener);

    if (!this.rootWatcher) {
      try {
        mkdirSync(this.rootDir, { recursive: true });
        this.rootWatcher = fsWatch(this.rootDir, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          this.dispatch(eventType, toWorkspacePath(filename.toString()));
        });
      } catch {
        // Root cannot be created or watched; the next watch() call retries
      }
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopWatching();
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
    this.listeners.clear();
    this.stopWatching();
  }

  private stopWatching(): void {
    this.rootWatcher?.close();
    this.rootWatcher = null;
  }

  /** Turn a raw fs.watch notification into create/modify/delete for matching listeners. */
  private dispatch(eventType: string, eventPath: string): void {
    const matching = [...this.listeners].filter((l) => isAtOrUnder(eventPath, l.path));
    if (matching.length === 0) return;
    let type: FsEvent['type'] = 'modify';
    if (eventType === 'rename') {
      // Classify synchronously, in notification order, so a quick write-then-delete
      // cannot have both notifications resolve after the delete and lose the create.
      type = existsSync(this.resolve(eventPath)) ? 'create' : 'delete';
    }
    for (const l of matching) {
      l.callback({ type, path: eventPath });
    }
  }

  /** Resolve a workspace-relative path to an absolute path */
  private resolve(relativePath: string): string {
    // Strip leading slash for path.join
    const cleaned = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    return path.join(this.rootDir, cleaned);
  }
}
