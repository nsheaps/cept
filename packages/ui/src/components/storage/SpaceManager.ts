/**
 * SpaceManager — manage multiple workspaces ("spaces") within a single
 * StorageBackend.
 *
 * Space metadata is stored at `.cept/spaces.json`.
 * Each space's data is under `.cept/spaces/{id}/` (workspace-state, pages, etc.).
 * The default space uses the root workspace-state for backward compatibility.
 */

import type { StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import type { SidebarPageRef } from '../sidebar/Sidebar.js';
import { DEFAULT_SPACE_ID, spaceDataDir } from './space-paths.js';
import {
  loadSpaceState,
  readSpacePageContent,
  saveSpaceState,
  writeSpacePageContent,
  deleteSpacePageContent,
} from './StorageContext.js';

export interface SpaceMeta {
  id: string;
  name: string;
  icon?: string;
  createdAt: string;
  /** Remote Git repository URL (e.g., "https://github.com/user/repo") */
  remoteUrl?: string;
  /** Branch to track (e.g., "main") */
  branch?: string;
  /** Sub-path within the repo to scope the space to (e.g., "docs/") */
  subPath?: string;
  /** Whether this space is read-only (true for cloned remote spaces) */
  readOnly?: boolean;
  /** ISO timestamp of the last successful sync/clone from the remote */
  lastSyncedAt?: string;
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
): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
  const manifest = await loadSpaces(backend);
  const newSpace: SpaceMeta = {
    id: `space-${Date.now()}`,
    name,
    icon,
    createdAt: new Date().toISOString(),
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
}

/**
 * Space lifecycle over one StorageBackend: the manifest (create, switch,
 * rename, delete, sync stamp) and each space's own state and page files.
 * Methods that change the manifest return the manifest as saved, so callers
 * can render it without reading it again.
 */
export class SpaceManager {
  constructor(readonly backend: StorageBackend) {}

  /** The manifest, created with a default space if missing. */
  load(): Promise<SpacesManifest> {
    return loadSpaces(this.backend);
  }

  save(manifest: SpacesManifest): Promise<void> {
    return saveSpaces(this.backend, manifest);
  }

  /** Create a local space and make it active. */
  async create(
    name: string,
    icon?: string,
  ): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    return addSpace(this.backend, name, icon);
  }

  /** Add (or replace) a space linked to a remote repository and make it active. */
  async createRemote(
    name: string,
    remoteUrl: string,
    branch: string,
    subPath?: string,
  ): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    return addRemoteSpace(this.backend, name, remoteUrl, branch, subPath);
  }

  /** Make `id` the active space. Throws if there is no such space. */
  async switch(id: string): Promise<{ space: SpaceMeta; manifest: SpacesManifest }> {
    const manifest = await switchSpace(this.backend, id);
    const space = manifest.spaces.find((s) => s.id === id);
    if (!space) throw new Error(`Space not found: ${id}`);
    return { space, manifest };
  }

  async rename(id: string, name: string): Promise<SpacesManifest> {
    return renameSpace(this.backend, id, name);
  }

  /**
   * Delete a space and its data. If it was active, the first remaining space
   * becomes active; the returned `active` is the space now active.
   */
  async delete(id: string): Promise<{ manifest: SpacesManifest; active: SpaceMeta }> {
    const manifest = await deleteSpace(this.backend, id);
    const active =
      manifest.spaces.find((s) => s.id === manifest.activeSpaceId) ?? manifest.spaces[0];
    return { manifest, active };
  }

  /** Record a successful sync from the remote. */
  async markSynced(id: string): Promise<SpacesManifest> {
    return updateSpaceSyncTimestamp(this.backend, id);
  }

  /** Save a space's snapshot and any page contents held in memory. */
  async saveState(
    id: string,
    snapshot: SpaceSnapshot,
    pageContents: Record<string, string> = {},
  ): Promise<void> {
    await saveSpaceState(this.backend, id, snapshot);
    await Promise.all(
      Object.entries(pageContents)
        .filter(([, content]) => content)
        .map(([pageId, content]) => this.writePage(id, pageId, content)),
    );
  }

  /** Read a space's saved snapshot and the content of its selected page. */
  async open(id: string, fallbackName: string): Promise<OpenedSpace> {
    const state = await loadSpaceState(this.backend, id);
    if (!state) return { snapshot: null, selectedContent: null };
    const snapshot: SpaceSnapshot = {
      pages: state.pages,
      favorites: state.favorites ?? [],
      recentPages: state.recentPages ?? [],
      selectedPageId: state.selectedPageId,
      spaceName: state.spaceName ?? fallbackName,
    };
    const selectedContent = state.selectedPageId
      ? await this.readPage(id, state.selectedPageId)
      : null;
    return { snapshot, selectedContent };
  }

  readPage(id: string, pageId: string): Promise<string | null> {
    return readSpacePageContent(this.backend, id, pageId);
  }

  writePage(id: string, pageId: string, content: string): Promise<void> {
    return writeSpacePageContent(this.backend, id, pageId, content);
  }

  deletePage(id: string, pageId: string): Promise<void> {
    return deleteSpacePageContent(this.backend, id, pageId);
  }
}
