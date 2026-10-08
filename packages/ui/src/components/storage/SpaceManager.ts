/**
 * SpaceManager — manage multiple workspaces ("spaces") within a single
 * StorageBackend.
 *
 * Space metadata is stored at `.cept/spaces.json`.
 * Each space's data is under `.cept/spaces/{id}/` (workspace-state, pages, etc.).
 * The default space uses the root workspace-state for backward compatibility.
 */

import { ScopedBackend } from '@cept/core';
import type { StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import type { SidebarPageRef } from '../sidebar/Sidebar.js';
import { DEFAULT_SPACE_ID, spaceDataDir, spaceWorkspaceFile } from './space-paths.js';
import {
  appSpaceStore,
  deleteStorePage,
  loadStoreState,
  ownSpaceStore,
  readStorePage,
  saveStoreState,
  writeStorePage,
} from './space-store.js';
import type { SpaceStore } from './space-store.js';
import { SPACE_STATE_FILE } from './space-store.js';
import {
  addFolderPage,
  deleteFolderPage,
  duplicateFolderPage,
  initFolderSpace,
  isFolderSpace,
  moveFolderPageToRoot,
  readFolderPage,
  readFolderTree,
  renameFolderPage,
  toPageTree,
  writeFolderPage,
} from './folder-space.js';
import type { FolderChange } from './folder-space.js';
import {
  confirmFlatMigration,
  finishInterruptedUndo,
  hasMigrationBackup,
  migrateFlatSpace,
  migratedPageId,
  undoFlatMigration,
} from './legacy-migration.js';
import { isRemoteSpaceId } from '../../router.js';

/**
 * Where a space's data lives:
 * - `app`: inside the app's own backend (the default; see space-store.ts);
 * - `memory`: in a backend held only in memory, gone on reload;
 * - `folder`: in a folder on this device (File System Access API). It stays
 *   in the manifest, and after a reload it needs its folder connected again
 *   ({@link SpaceManager.connectFolder}) before it can be opened.
 */
export type SpaceBackendKind = 'app' | 'memory' | 'folder';

export interface SpaceMeta {
  id: string;
  name: string;
  icon?: string;
  createdAt: string;
  /** Remote Git repository URL (e.g., "https://github.com/user/repo") */
  remoteUrl?: string;
  /** Branch to track (e.g., "main") */
  branch?: string;
  /** Sub-path within the repo (or the opened folder) to scope the space to (e.g., "docs/") */
  subPath?: string;
  /** Whether this space is read-only (true for cloned remote spaces) */
  readOnly?: boolean;
  /** ISO timestamp of the last successful sync/clone from the remote */
  lastSyncedAt?: string;
  /** Where the space's data lives; absent means `app`. */
  backend?: SpaceBackendKind;
}

export interface SpacesManifest {
  activeSpaceId: string;
  spaces: SpaceMeta[];
}

const SPACES_FILE = '.cept/spaces.json';

function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decode<T>(data: Uint8Array | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  } catch {
    return null;
  }
}

/** Load the spaces manifest, creating a default if none exists. */
export async function loadSpaces(backend: StorageBackend): Promise<SpacesManifest> {
  const data = await backend.readFile(SPACES_FILE);
  const manifest = decode<SpacesManifest>(data);
  if (manifest && manifest.spaces.length > 0) return manifest;

  // Create default manifest with a single default space
  const defaultManifest: SpacesManifest = {
    activeSpaceId: DEFAULT_SPACE_ID,
    spaces: [
      {
        id: DEFAULT_SPACE_ID,
        name: 'My Space',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  await backend.writeFile(SPACES_FILE, encode(defaultManifest));
  return defaultManifest;
}

/** Save the spaces manifest. */
export async function saveSpaces(backend: StorageBackend, manifest: SpacesManifest): Promise<void> {
  await backend.writeFile(SPACES_FILE, encode(manifest));
}

/** Create a new space and return its metadata. */
export async function createSpace(
  backend: StorageBackend,
  name: string,
  icon?: string,
): Promise<SpaceMeta> {
  return (await addSpace(backend, name, icon)).space;
}

/** Create a new space, make it active, and return it with the saved manifest. */
async function addSpace(
  backend: StorageBackend,
  name: string,
  icon?: string,
  kind: SpaceBackendKind = 'app',
): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
  const manifest = await loadSpaces(backend);
  const newSpace: SpaceMeta = {
    id: `space-${crypto.randomUUID()}`,
    name,
    icon,
    createdAt: new Date().toISOString(),
    ...(kind === 'app' ? {} : { backend: kind }),
  };
  manifest.spaces.push(newSpace);
  manifest.activeSpaceId = newSpace.id;
  await saveSpaces(backend, manifest);
  return { space: newSpace, manifest };
}

/**
 * Generate a deterministic space ID from repo URL, branch, and optional sub-path.
 * Uses `@` to separate repo from branch for unambiguous parsing.
 * e.g., "https://github.com/nsheaps/cept" + "main" + "docs/" → "github.com/nsheaps/cept@main/docs"
 */
export function generateRemoteSpaceId(remoteUrl: string, branch: string, subPath?: string): string {
  // Strip protocol and trailing slashes
  const repo = remoteUrl
    .replace(/^https?:\/\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  let id = `${repo}@${branch}`;
  // Append sub-path if present
  if (subPath) {
    const cleanSubPath = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (cleanSubPath) {
      id += `/${cleanSubPath}`;
    }
  }
  return id;
}

/**
 * Parse a remote space ID back into its components.
 * Returns null if the ID is not a valid remote space ID.
 */
export function parseRemoteSpaceId(
  spaceId: string,
): { repo: string; branch: string; subPath?: string } | null {
  const atIdx = spaceId.indexOf('@');
  if (atIdx < 0) return null;
  const repo = spaceId.substring(0, atIdx);
  const rest = spaceId.substring(atIdx + 1);
  const slashIdx = rest.indexOf('/');
  if (slashIdx < 0) {
    return { repo, branch: rest };
  }
  return { repo, branch: rest.substring(0, slashIdx), subPath: rest.substring(slashIdx + 1) };
}

/** Create a new space linked to a remote Git repository. */
export async function createRemoteSpace(
  backend: StorageBackend,
  name: string,
  remoteUrl: string,
  branch: string,
  subPath?: string,
): Promise<SpaceMeta> {
  return (await addRemoteSpace(backend, name, remoteUrl, branch, subPath)).space;
}

/** Add (or replace) a remote space, make it active, and return it with the saved manifest. */
async function addRemoteSpace(
  backend: StorageBackend,
  name: string,
  remoteUrl: string,
  branch: string,
  subPath?: string,
): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
  const manifest = await loadSpaces(backend);
  const id = generateRemoteSpaceId(remoteUrl, branch, subPath);
  const newSpace: SpaceMeta = {
    id,
    name,
    createdAt: new Date().toISOString(),
    remoteUrl,
    branch,
    subPath,
    readOnly: true,
    lastSyncedAt: new Date().toISOString(),
  };
  // Replace existing space with same ID (re-clone) or add new
  const existingIdx = manifest.spaces.findIndex((s) => s.id === id);
  if (existingIdx >= 0) {
    manifest.spaces[existingIdx] = newSpace;
  } else {
    manifest.spaces.push(newSpace);
  }
  manifest.activeSpaceId = newSpace.id;
  await saveSpaces(backend, manifest);
  return { space: newSpace, manifest };
}

/** Update the lastSyncedAt timestamp for a space. */
export async function updateSpaceSyncTimestamp(
  backend: StorageBackend,
  spaceId: string,
): Promise<SpacesManifest> {
  const manifest = await loadSpaces(backend);
  const space = manifest.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error(`Space not found: ${spaceId}`);
  space.lastSyncedAt = new Date().toISOString();
  await saveSpaces(backend, manifest);
  return manifest;
}

/** Switch the active space. */
export async function switchSpace(
  backend: StorageBackend,
  spaceId: string,
): Promise<SpacesManifest> {
  const manifest = await loadSpaces(backend);
  if (!manifest.spaces.find((s) => s.id === spaceId)) {
    throw new Error(`Space not found: ${spaceId}`);
  }
  manifest.activeSpaceId = spaceId;
  await saveSpaces(backend, manifest);
  return manifest;
}

/** Delete a space by id. Cannot delete the last space. */
export async function deleteSpace(
  backend: StorageBackend,
  spaceId: string,
): Promise<SpacesManifest> {
  const manifest = await loadSpaces(backend);
  if (manifest.spaces.length <= 1) {
    throw new Error('Cannot delete the last space');
  }
  manifest.spaces = manifest.spaces.filter((s) => s.id !== spaceId);

  // Delete the space's data directory (for non-default spaces)
  if (spaceId !== DEFAULT_SPACE_ID) {
    try {
      await backend.deleteFile(spaceDataDir(spaceId));
    } catch {
      // Ignore if not found
    }
  }

  // If active space was deleted, switch to first remaining
  if (manifest.activeSpaceId === spaceId) {
    manifest.activeSpaceId = manifest.spaces[0].id;
  }
  await saveSpaces(backend, manifest);
  return manifest;
}

/** Rename a space. */
export async function renameSpace(
  backend: StorageBackend,
  spaceId: string,
  name: string,
): Promise<SpacesManifest> {
  const manifest = await loadSpaces(backend);
  const space = manifest.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error(`Space not found: ${spaceId}`);
  space.name = name;
  await saveSpaces(backend, manifest);
  return manifest;
}

/** The part of a space's state that is saved per space (page tree, sidebar lists). */
export interface SpaceSnapshot {
  pages: PageTreeNode[];
  favorites: SidebarPageRef[];
  recentPages: SidebarPageRef[];
  selectedPageId?: string;
  spaceName: string;
}

/** What {@link SpaceManager.open} found for a space. */
export interface OpenedSpace {
  /** The saved snapshot (possibly with no pages), or `null` when the space has never been saved. */
  snapshot: SpaceSnapshot | null;
  /** Content of the snapshot's selected page, when there is one. */
  selectedContent: string | null;
  /** Whether this open converted the space from the flat layout to folders. */
  converted?: boolean;
  /** Whether a conversion's backup is still kept, waiting for the user to keep or undo it. */
  backupKept?: boolean;
}

/**
 * Space lifecycle over one StorageBackend: the manifest (create, switch,
 * rename, delete, sync stamp) and each space's own state and page files.
 * Methods that change the manifest return the manifest as saved, so callers
 * can render it without reading it again.
 */
export class SpaceManager {
  /** Backends of spaces that do not live in the app's backend, by space id. */
  private readonly bound = new Map<string, StorageBackend>();
  /** Memory spaces: listed while this manager lives, never written to the manifest. */
  private readonly session = new Map<string, SpaceMeta>();
  /** The active space when it is a session space; the saved manifest keeps its own. */
  private sessionActive: string | null = null;
  /** Whether each space opened or created so far uses the folder layout. */
  private readonly layouts = new Map<string, boolean>();
  /** Folder spaces seen in the manifest; those not bound wait for their folder. */
  private readonly folders = new Set<string>();
  /** The state last read or written per space, so an unchanged state is not written again. */
  private readonly savedState = new Map<string, string>();

  constructor(readonly backend: StorageBackend) {}

  /** Where a space's data lives. */
  kindOf(space: SpaceMeta): SpaceBackendKind {
    return space.backend ?? 'app';
  }

  /** Use `backend` as the store for space `id` from now on. */
  bind(id: string, backend: StorageBackend): void {
    this.bound.set(id, backend);
  }

  /**
   * Use a folder on this device as the store of folder space `space`: its
   * root, or the space's `subPath` inside it. Opening it writes nothing.
   */
  connectFolder(space: SpaceMeta, folder: StorageBackend): void {
    this.folders.add(space.id);
    this.bind(space.id, space.subPath ? new ScopedBackend(folder, space.subPath) : folder);
  }

  /** Whether a space can be opened now: false only for a folder space whose folder is not connected. */
  isConnected(id: string): boolean {
    return !this.folders.has(id) || this.bound.has(id);
  }

  /** The backend and state file a space is read and written through. */
  store(id: string): SpaceStore {
    const own = this.bound.get(id);
    return own ? ownSpaceStore(own) : appSpaceStore(this.backend, id);
  }

  /**
   * The manifest as this manager can serve it: saved memory spaces this
   * manager has no backend for (from before a reload, or another tab's) are
   * left out, folder spaces are kept even before their folder is connected,
   * this session's memory spaces are added, and the active space falls back
   * to the first one left.
   */
  private visible(manifest: SpacesManifest): SpacesManifest {
    for (const s of manifest.spaces) if (this.kindOf(s) === 'folder') this.folders.add(s.id);
    const saved = manifest.spaces.filter(
      (s) => !this.session.has(s.id) && (this.kindOf(s) !== 'memory' || this.bound.has(s.id)),
    );
    const spaces = [...saved, ...this.session.values()];
    const wanted = this.sessionActive ?? manifest.activeSpaceId;
    const activeSpaceId = spaces.some((s) => s.id === wanted)
      ? wanted
      : (spaces[0]?.id ?? DEFAULT_SPACE_ID);
    return { activeSpaceId, spaces };
  }

  /** The manifest without this session's memory spaces, as it is written to disk. */
  private async persistable(manifest: SpacesManifest): Promise<SpacesManifest> {
    if (this.session.size === 0) return manifest;
    const spaces = manifest.spaces.filter((s) => !this.session.has(s.id));
    const activeSpaceId = this.session.has(manifest.activeSpaceId)
      ? (await loadSpaces(this.backend)).activeSpaceId
      : manifest.activeSpaceId;
    return { activeSpaceId, spaces };
  }

  /** Throw before touching disk for an id this manager would not hand back. */
  private async requireVisible(id: string): Promise<void> {
    const manifest = this.visible(await loadSpaces(this.backend));
    if (!manifest.spaces.some((s) => s.id === id)) throw new Error(`Space not found: ${id}`);
  }

  /** The manifest, created with a default space if missing. */
  async load(): Promise<SpacesManifest> {
    return this.visible(await loadSpaces(this.backend));
  }

  /** Save the manifest. This session's memory spaces are never written. */
  async save(manifest: SpacesManifest): Promise<void> {
    await saveSpaces(this.backend, await this.persistable(manifest));
  }

  /**
   * Create a space and make it active. By default it lives in the app's
   * backend and is saved in the manifest.
   *
   * Pass `{ kind: 'memory', backend }` to hold it in `backend` for this
   * session only: neither it nor its being active is written to the manifest,
   * so the saved spaces and the saved active space stay as they were. With an
   * `id`, an earlier memory space with that id is replaced, data and all.
   *
   * Pass `{ kind: 'folder', backend, subPath }` for a space in a folder on this
   * device (`backend` is the opened folder, `subPath` the space inside it). It
   * is saved in the manifest, and nothing is written to the folder.
   */
  async create(
    name: string,
    icon?: string,
    options?:
      | { kind: 'memory'; backend: StorageBackend; id?: string }
      | { kind: 'folder'; backend: StorageBackend; subPath?: string; id?: string },
  ): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    if (options?.kind === 'folder') {
      const manifest = await loadSpaces(this.backend);
      const space: SpaceMeta = {
        id: options.id ?? `folder-${crypto.randomUUID()}`,
        name,
        icon,
        createdAt: new Date().toISOString(),
        backend: 'folder',
        ...(options.subPath ? { subPath: options.subPath } : {}),
      };
      manifest.spaces = [...manifest.spaces.filter((s) => s.id !== space.id), space];
      manifest.activeSpaceId = space.id;
      this.connectFolder(space, options.backend);
      this.sessionActive = null;
      await saveSpaces(this.backend, manifest);
      return { space, manifest: this.visible(manifest) };
    }
    if (options) {
      const space: SpaceMeta = {
        id: options.id ?? `space-${crypto.randomUUID()}`,
        name,
        icon,
        createdAt: new Date().toISOString(),
        backend: options.kind,
      };
      this.session.set(space.id, space);
      this.bind(space.id, options.backend);
      this.sessionActive = space.id;
      return { space, manifest: await this.load() };
    }
    const { space, manifest } = await addSpace(this.backend, name, icon);
    await initFolderSpace(this.store(space.id).backend, name);
    this.layouts.set(space.id, true);
    this.sessionActive = null;
    return { space, manifest: this.visible(manifest) };
  }

  /** Add (or replace) a space linked to a remote repository and make it active. */
  async createRemote(
    name: string,
    remoteUrl: string,
    branch: string,
    subPath?: string,
  ): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    this.sessionActive = null;
    const { space, manifest } = await addRemoteSpace(
      this.backend,
      name,
      remoteUrl,
      branch,
      subPath,
    );
    return { space, manifest: this.visible(manifest) };
  }

  /** Make `id` the active space. Throws if there is no such space. */
  async switch(id: string): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    const own = this.session.get(id);
    if (own) {
      this.sessionActive = id;
      return { space: own, manifest: await this.load() };
    }
    await this.requireVisible(id);
    this.sessionActive = null;
    const manifest = this.visible(await switchSpace(this.backend, id));
    const space = manifest.spaces.find((s) => s.id === id);
    if (!space) throw new Error(`Space not found: ${id}`);
    return { space, manifest };
  }

  async rename(id: string, name: string): Promise<SpacesManifest> {
    const own = this.session.get(id);
    if (own) {
      this.session.set(id, { ...own, name });
      return this.load();
    }
    await this.requireVisible(id);
    return this.visible(await renameSpace(this.backend, id, name));
  }

  /**
   * Delete a space and its data. If it was active, the first remaining space
   * becomes active; the returned `active` is the space now active.
   */
  async delete(id: string): Promise<{ manifest: SpacesManifest; active: SpaceMeta }> {
    const inSession = this.session.delete(id);
    if (this.sessionActive === id) this.sessionActive = null;
    this.bound.delete(id);
    this.folders.delete(id);
    this.layouts.delete(id);
    this.savedState.delete(id);
    const manifest = inSession
      ? await this.load()
      : this.visible(await deleteSpace(this.backend, id));
    const active =
      manifest.spaces.find((s) => s.id === manifest.activeSpaceId) ?? manifest.spaces[0];
    return { manifest, active };
  }

  /** Record a successful sync from the remote. */
  async markSynced(id: string): Promise<SpacesManifest> {
    return this.visible(await updateSpaceSyncTimestamp(this.backend, id));
  }

  /**
   * Whether a space uses the folder layout, as found when it was last opened
   * or created. Spaces not yet opened count as flat.
   */
  isFolder(id: string): boolean {
    return this.layouts.get(id) ?? false;
  }

  /** Look for the space marker and remember the layout. */
  private async detectLayout(id: string): Promise<boolean> {
    const folder = await isFolderSpace(this.store(id).backend);
    this.layouts.set(id, folder);
    return folder;
  }

  /**
   * Where a space's snapshot is saved. A space in a folder on this device
   * keeps it in the app's backend, so looking around (recent pages, expanded
   * folders) adds no files to the user's folder (REQ-WS-019). Any other space
   * in the folder layout keeps it under its own `.cept/`, which the folder
   * reader leaves out of the page tree.
   */
  private stateStore(id: string): SpaceStore {
    if (this.folders.has(id)) return { backend: this.backend, stateFile: spaceWorkspaceFile(id) };
    const store = this.store(id);
    return this.isFolder(id) ? { backend: store.backend, stateFile: SPACE_STATE_FILE } : store;
  }

  /**
   * Save a space's snapshot and any page contents held in memory. A snapshot
   * equal to the one last read or written is not written again. A folder
   * space whose folder is not connected is skipped.
   */
  async saveState(
    id: string,
    snapshot: SpaceSnapshot,
    pageContents: Record<string, string> = {},
  ): Promise<void> {
    if (!this.isConnected(id)) return;
    const json = JSON.stringify(snapshot);
    if (this.savedState.get(id) !== json) {
      await saveStoreState(this.stateStore(id), snapshot);
      this.savedState.set(id, json);
    }
    await Promise.all(
      Object.entries(pageContents)
        .filter(([, content]) => content)
        .map(([pageId, content]) => this.writePage(id, pageId, content)),
    );
  }

  /**
   * Read a space's saved snapshot and the content of its selected page. A
   * folder space's pages come from its files; the snapshot only adds what
   * files do not hold (icons, covers, expanded folders, sidebar lists), and
   * entries for pages no longer on disk are dropped.
   */
  async open(id: string, fallbackName: string): Promise<OpenedSpace> {
    if (!this.isConnected(id)) {
      throw new Error(`The folder of "${fallbackName}" is not connected`);
    }
    let folder = await this.detectLayout(id);
    let converted = false;
    if (!folder && this.migrates(id)) {
      // An undo that stopped half way is finished before anything reads the space.
      await finishInterruptedUndo(this.store(id));
      converted = await migrateFlatSpace(this.store(id), fallbackName);
      if (converted) folder = await this.detectLayout(id);
    }
    const backupKept = folder && (await hasMigrationBackup(this.store(id).backend));
    const state = await loadStoreState(this.stateStore(id));
    if (!state && !folder) return { snapshot: null, selectedContent: null };
    let snapshot: SpaceSnapshot = {
      pages: state?.pages ?? [],
      favorites: state?.favorites ?? [],
      recentPages: state?.recentPages ?? [],
      selectedPageId: state?.selectedPageId,
      spaceName: state?.spaceName ?? fallbackName,
    };
    if (folder) {
      const pages = toPageTree(await readFolderTree(this.store(id).backend), snapshot.pages);
      const titles = new Map<string, string>();
      const collect = (nodes: typeof pages) =>
        nodes.forEach((n) => {
          titles.set(n.id, n.title);
          collect(n.children);
        });
      collect(pages);
      const present = <T extends { id: string }>(refs: T[]) =>
        refs.filter((r) => titles.has(r.id)).map((r) => ({ ...r, title: titles.get(r.id)! }));
      snapshot = {
        ...snapshot,
        pages,
        favorites: present(snapshot.favorites),
        recentPages: present(snapshot.recentPages),
        selectedPageId:
          snapshot.selectedPageId && titles.has(snapshot.selectedPageId)
            ? snapshot.selectedPageId
            : undefined,
      };
    }
    const selectedContent = snapshot.selectedPageId
      ? await this.readPage(id, snapshot.selectedPageId)
      : null;
    this.savedState.set(id, JSON.stringify(snapshot));
    return { snapshot, selectedContent, converted, backupKept };
  }

  /**
   * Whether a flat space is converted to folders when it opens: only spaces
   * kept in the app's backend. Memory spaces end with the session, and remote
   * spaces stay flat until syncing writes folders.
   */
  private migrates(id: string): boolean {
    return !this.bound.has(id) && !this.session.has(id) && !isRemoteSpaceId(id);
  }

  /**
   * Make an app space that holds nothing yet a folder space, so its first
   * pages are written as files. Returns whether the space is a folder space.
   */
  async startFolder(id: string, name: string): Promise<boolean> {
    if (await this.detectLayout(id)) return true;
    if (!this.migrates(id) || (await loadStoreState(this.store(id)))) return false;
    await initFolderSpace(this.store(id).backend, name);
    this.layouts.set(id, true);
    return true;
  }

  /** Keep a conversion: delete its backup (REQ-WS-025). */
  async confirmConversion(id: string): Promise<void> {
    await confirmFlatMigration(this.store(id).backend);
  }

  /**
   * Undo a conversion: put the flat layout back from its backup. The space is
   * then kept flat; changes made since the conversion are lost.
   */
  async undoConversion(id: string): Promise<void> {
    await undoFlatMigration(this.store(id));
    this.layouts.set(id, false);
  }

  /** Where a page of a space's old flat layout moved when it was converted; null if unknown. */
  movedPageId(id: string, oldId: string): Promise<string | null> {
    return migratedPageId(this.store(id).backend, oldId);
  }

  readPage(id: string, pageId: string): Promise<string | null> {
    return this.isFolder(id)
      ? readFolderPage(this.store(id).backend, pageId)
      : readStorePage(this.store(id), pageId);
  }

  writePage(id: string, pageId: string, content: string): Promise<void> {
    return this.isFolder(id)
      ? writeFolderPage(this.store(id).backend, pageId, content)
      : writeStorePage(this.store(id), pageId, content);
  }

  deletePage(id: string, pageId: string): Promise<void> {
    return this.isFolder(id)
      ? deleteFolderPage(this.store(id).backend, pageId)
      : deleteStorePage(this.store(id), pageId);
  }

  // Page operations on a folder space. Each renames or creates files and
  // returns the page's id afterwards with the paths that moved.

  /** A folder space's sidebar tree, keeping icons and expanded state from `previous`. */
  async pageTree(
    id: string,
    previous: readonly PageTreeNode[] = [],
    hidden: ReadonlySet<string> = new Set(),
  ): Promise<PageTreeNode[]> {
    return toPageTree(await readFolderTree(this.store(id).backend), previous, hidden);
  }

  addPage(id: string, parentId?: string, title?: string, text?: string): Promise<FolderChange> {
    return addFolderPage(this.store(id).backend, parentId, title, text);
  }

  renamePage(id: string, pageId: string, title: string): Promise<FolderChange> {
    return renameFolderPage(this.store(id).backend, pageId, title);
  }

  movePageToRoot(id: string, pageId: string): Promise<FolderChange> {
    return moveFolderPageToRoot(this.store(id).backend, pageId);
  }

  duplicatePage(id: string, pageId: string): Promise<FolderChange> {
    return duplicateFolderPage(this.store(id).backend, pageId);
  }
}
