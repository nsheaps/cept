/**
 * ScopedBackend — a StorageBackend view of one folder inside another backend.
 *
 * Every path is resolved against `prefix` in the base backend, so a space
 * stored in a sub-folder of the app's backend gets a backend of its own whose
 * root is that folder. Paths cannot climb out of the folder: `..` segments
 * stop at the scope root, like a chroot.
 *
 * `initialize` writes the workspace config and root page inside the scope.
 * `close` is a no-op: the base backend may be shared with other scopes, and
 * its owner closes it.
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

/** Split a path into clean segments, resolving `.` and `..` within the root. */
function segments(path: string): string[] {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out;
}

export class ScopedBackend implements StorageBackend {
  readonly type: StorageBackend['type'];
  readonly capabilities: BackendCapabilities;
  /** The scope's folder in the base backend, without leading or trailing `/`. */
  readonly prefix: string;

  constructor(
    readonly base: StorageBackend,
    prefix: string,
  ) {
    this.prefix = segments(prefix).join('/');
    if (!this.prefix) throw new Error('ScopedBackend needs a non-empty prefix');
    this.type = base.type;
    this.capabilities = base.capabilities;
  }

  /** The base-backend path for a scope-relative path. */
  private resolve(path: string): string {
    const rest = segments(path).join('/');
    return rest ? `${this.prefix}/${rest}` : this.prefix;
  }

  /** The scope-relative path for a base-backend path, or null if outside the scope. */
  private relative(basePath: string): string | null {
    const path = segments(basePath).join('/');
    if (path === this.prefix) return '';
    if (path.startsWith(`${this.prefix}/`)) return path.slice(this.prefix.length + 1);
    return null;
  }

  readFile(path: string): Promise<Uint8Array | null> {
    return this.base.readFile(this.resolve(path));
  }

  writeFile(path: string, data: Uint8Array): Promise<void> {
    return this.base.writeFile(this.resolve(path), data);
  }

  deleteFile(path: string): Promise<void> {
    return this.base.deleteFile(this.resolve(path));
  }

  listDirectory(path: string): Promise<DirEntry[]> {
    return this.base.listDirectory(this.resolve(path));
  }

  exists(path: string): Promise<boolean> {
    return this.base.exists(this.resolve(path));
  }

  stat(path: string): Promise<FileStat | null> {
    return this.base.stat(this.resolve(path));
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    return this.base.watch(this.resolve(path), (event) => {
      const relative = this.relative(event.path);
      if (relative !== null) callback({ type: event.type, path: relative });
    });
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    const encode = (text: string) => new TextEncoder().encode(text);
    const icon = config.icon ?? '\u{1F4DD}';
    const configYaml = `name: "${config.name}"\nicon: "${icon}"\ndefaultPage: "${config.defaultPage ?? 'pages/index.md'}"\n`;
    await this.writeFile('.cept/config.yaml', encode(configYaml));
    if (await this.exists('pages/index.md')) return;
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
    await this.writeFile('pages/index.md', encode(rootPage));
  }

  async close(): Promise<void> {
    // The base backend may be shared with other scopes; its owner closes it.
  }
}
