/**
 * WebFsBackend — StorageBackend using the File System Access API.
 *
 * Provides the "Open Folder" experience in the browser. Uses
 * `showDirectoryPicker()` to get a `FileSystemDirectoryHandle`,
 * then reads/writes files through the handle.
 *
 * The handle can be persisted to IndexedDB so the user doesn't
 * need to re-pick the folder on every visit (`createFolderHandleStore`).
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

const WEB_FS_CAPABILITIES: BackendCapabilities = {
  history: false,
  collaboration: false,
  sync: false,
  branching: false,
  externalEditing: true,
  watchForExternalChanges: false, // no native FS watch in browser
};

/**
 * Navigate to a nested directory handle from a path like "pages" or ".cept/databases".
 * Returns null if any segment doesn't exist and create is false.
 */
async function getDirectoryHandle(
  root: FileSystemDirectoryHandle,
  dirPath: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  const segments = dirPath.split('/').filter(Boolean);
  let current = root;
  for (const seg of segments) {
    try {
      current = await current.getDirectoryHandle(seg, { create });
    } catch {
      return null;
    }
  }
  return current;
}

/**
 * Split a path like "pages/index.md" into parent dir segments and filename.
 */
function splitPath(filePath: string): { dir: string; name: string } {
  const normalized = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return { dir: '', name: normalized };
  return { dir: normalized.slice(0, lastSlash), name: normalized.slice(lastSlash + 1) };
}

export class WebFsBackend implements StorageBackend {
  readonly type = 'local' as const;
  readonly capabilities: BackendCapabilities = WEB_FS_CAPABILITIES;

  private root: FileSystemDirectoryHandle;

  constructor(directoryHandle: FileSystemDirectoryHandle) {
    this.root = directoryHandle;
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    try {
      const { dir, name } = splitPath(path);
      const parent = dir ? await getDirectoryHandle(this.root, dir, false) : this.root;
      if (!parent) return null;
      const fileHandle = await parent.getFileHandle(name);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const { dir, name } = splitPath(path);
    const parent = dir ? await getDirectoryHandle(this.root, dir, true) : this.root;
    if (!parent) throw new Error(`Cannot create directory: ${dir}`);
    const fileHandle = await parent.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data as unknown as BufferSource);
    await writable.close();
  }

  async deleteFile(path: string): Promise<void> {
    try {
      const { dir, name } = splitPath(path);
      const parent = dir ? await getDirectoryHandle(this.root, dir, false) : this.root;
      if (!parent) return;
      await parent.removeEntry(name, { recursive: true });
    } catch {
      // File doesn't exist ��� no-op
    }
  }

  async listDirectory(dirPath: string): Promise<DirEntry[]> {
    try {
      const normalized = dirPath.startsWith('/') ? dirPath.slice(1) : dirPath;
      const handle = normalized
        ? await getDirectoryHandle(this.root, normalized, false)
        : this.root;
      if (!handle) return [];

      const entries: DirEntry[] = [];
      for await (const [name, entry] of handle as unknown as AsyncIterable<
        [string, FileSystemHandle]
      >) {
        entries.push({
          name,
          isDirectory: entry.kind === 'directory',
          isFile: entry.kind === 'file',
        });
      }
      return entries;
    } catch {
      return [];
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const { dir, name } = splitPath(path);
      const parent = dir ? await getDirectoryHandle(this.root, dir, false) : this.root;
      if (!parent) return false;
      // Try as file first, then as directory
      try {
        await parent.getFileHandle(name);
        return true;
      } catch {
        try {
          await parent.getDirectoryHandle(name);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  watch(_path: string, _callback: (event: FsEvent) => void): Unsubscribe {
    // File System Access API doesn't provide native watch support.
    // Polling could be added in the future.
    return () => {};
  }

  async stat(path: string): Promise<FileStat | null> {
    try {
      const { dir, name } = splitPath(path);
      const parent = dir ? await getDirectoryHandle(this.root, dir, false) : this.root;
      if (!parent) return null;

      // Try as file
      try {
        const fileHandle = await parent.getFileHandle(name);
        const file = await fileHandle.getFile();
        return {
          size: file.size,
          isDirectory: false,
          isFile: true,
          modifiedAt: new Date(file.lastModified),
          createdAt: new Date(file.lastModified), // File System Access API doesn't expose creation time
        };
      } catch {
        // Try as directory
        try {
          await parent.getDirectoryHandle(name);
          return {
            size: 0,
            isDirectory: true,
            isFile: false,
            modifiedAt: new Date(),
            createdAt: new Date(),
          };
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    // Create workspace directories
    await getDirectoryHandle(this.root, 'pages', true);
    await getDirectoryHandle(this.root, '.cept/databases', true);
    await getDirectoryHandle(this.root, '.cept/assets', true);
    await getDirectoryHandle(this.root, '.cept/templates', true);

    // Create workspace config
    const configYaml = `name: "${config.name}"\nicon: "${config.icon ?? '\u{1F4DD}'}"\ndefaultPage: "${config.defaultPage ?? 'pages/index.md'}"\n`;
    await this.writeFile('.cept/config.yaml', new TextEncoder().encode(configYaml));

    // Create root page if it doesn't exist
    const rootExists = await this.exists('pages/index.md');
    if (!rootExists) {
      const now = new Date().toISOString();
      const rootPage = `---
id: "root"
title: "${config.name}"
icon: "${config.icon ?? '\u{1F4DD}'}"
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
    // No cleanup needed — the handle is held by the caller
  }

  /** Get the underlying directory handle (for IndexedDB persistence) */
  get directoryHandle(): FileSystemDirectoryHandle {
    return this.root;
  }
}

/**
 * Prompt the user to select a folder using the File System Access API.
 * Returns null if the user cancels or the API is not available.
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
    return null;
  }
  try {
    return await (
      window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
    ).showDirectoryPicker();
  } catch {
    return null; // User cancelled
  }
}

/** Whether the app may read and write a folder, as the File System Access API reports it. */
export type FolderPermission = 'granted' | 'prompt' | 'denied';

/** The permission calls Chromium adds to a handle; other browsers may lack them. */
interface PermissionHandle {
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>;
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>;
}

/**
 * Check, and optionally ask for, read-write access to a folder. A handle
 * restored after a reload usually reports `prompt`: the browser asks again,
 * and only from a user gesture (a click), so pass `request: true` only from
 * one. Without the permission API the handle is usable as is.
 */
export async function folderPermission(
  handle: FileSystemDirectoryHandle,
  { request = false }: { request?: boolean } = {},
): Promise<FolderPermission> {
  const api = handle as unknown as PermissionHandle;
  if (typeof api.queryPermission !== 'function') return 'granted';
  try {
    const current = await api.queryPermission({ mode: 'readwrite' });
    if (current !== 'prompt' || !request || typeof api.requestPermission !== 'function') {
      return current;
    }
    return await api.requestPermission({ mode: 'readwrite' });
  } catch {
    // requestPermission throws outside a user gesture; the browser can still ask later.
    return 'prompt';
  }
}

/** Folder handles kept across reloads, keyed by the id of the space they open. */
export interface FolderHandleStore {
  save(id: string, handle: FileSystemDirectoryHandle): Promise<void>;
  load(id: string): Promise<FileSystemDirectoryHandle | null>;
  list(): Promise<{ id: string; handle: FileSystemDirectoryHandle }[]>;
  remove(id: string): Promise<void>;
}

const HANDLE_STORE = 'cept-fs-handles';

/**
 * A FolderHandleStore in IndexedDB, which can hold handles (they are
 * structured-cloneable). Pass a per-deploy `dbName` so previews and
 * production keep separate handles.
 */
export function createFolderHandleStore(
  dbName = 'cept-handles',
  idb: IDBFactory = globalThis.indexedDB,
): FolderHandleStore {
  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const req = idb.open(dbName, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(HANDLE_STORE)) {
          req.result.createObjectStore(HANDLE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest,
    read: (request: IDBRequest) => T,
  ): Promise<T> => {
    const db = await open();
    try {
      const tx = db.transaction(HANDLE_STORE, mode);
      const request = action(tx.objectStore(HANDLE_STORE));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return read(request);
    } finally {
      db.close();
    }
  };

  return {
    save: (id, handle) =>
      run(
        'readwrite',
        (store) => store.put(handle, id),
        () => undefined,
      ),
    load: (id) =>
      run(
        'readonly',
        (store) => store.get(id),
        (request) => (request.result as FileSystemDirectoryHandle | undefined) ?? null,
      ),
    list: async () => {
      const db = await open();
      try {
        const tx = db.transaction(HANDLE_STORE, 'readonly');
        const store = tx.objectStore(HANDLE_STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        return (keys.result as IDBValidKey[]).map((key, i) => ({
          id: String(key),
          handle: values.result[i] as FileSystemDirectoryHandle,
        }));
      } finally {
        db.close();
      }
    },
    remove: (id) =>
      run(
        'readwrite',
        (store) => store.delete(id),
        () => undefined,
      ),
  };
}

/** A folder space restored after a reload, and whether it can be opened yet. */
export interface RestoredFolder {
  id: string;
  handle: FileSystemDirectoryHandle;
  /** `granted`: open it now; `prompt`: ask with `reconnectFolder` from a click; `denied`: the user refused. */
  permission: FolderPermission;
}

/**
 * Restore every saved folder on startup. Only queries permission (no prompt),
 * so it is safe to call before the user has clicked anything.
 */
export async function restoreFolders(store: FolderHandleStore): Promise<RestoredFolder[]> {
  let saved: { id: string; handle: FileSystemDirectoryHandle }[];
  try {
    saved = await store.list();
  } catch {
    return [];
  }
  return Promise.all(
    saved.map(async ({ id, handle }) => ({
      id,
      handle,
      permission: await folderPermission(handle),
    })),
  );
}

/** Ask again for access to a restored folder. Call from a click; true when granted. */
export async function reconnectFolder(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await folderPermission(handle, { request: true })) === 'granted';
}
