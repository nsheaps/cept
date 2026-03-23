/**
 * SpaceManager — manage multiple workspaces ("spaces") within a single
 * StorageBackend.
 *
 * Space metadata is stored at `.cept/spaces.json`.
 * Each space's data is under `.cept/spaces/{id}/` (workspace-state, pages, etc.).
 * The default space uses the root workspace-state for backward compatibility.
 */

import type { StorageBackend } from '@cept/core';

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
const DEFAULT_SPACE_ID = 'default';

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
  return newSpace;
}

/**
 * Generate a deterministic space ID from repo URL, branch, and optional sub-path.
 * Uses `@` to separate repo from branch for unambiguous parsing.
 * e.g., "https://github.com/nsheaps/cept" + "main" + "docs/" → "github.com/nsheaps/cept@main/docs"
 */
export function generateRemoteSpaceId(remoteUrl: string, branch: string, subPath?: string): string {
  // Strip protocol and trailing slashes
  const repo = remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
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
export function parseRemoteSpaceId(spaceId: string): { repo: string; branch: string; subPath?: string } | null {
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
  return newSpace;
}

/** Update the lastSyncedAt timestamp for a space. */
export async function updateSpaceSyncTimestamp(
  backend: StorageBackend,
  spaceId: string,
): Promise<void> {
  const manifest = await loadSpaces(backend);
  const space = manifest.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error(`Space not found: ${spaceId}`);
  space.lastSyncedAt = new Date().toISOString();
  await saveSpaces(backend, manifest);
}

/** Switch the active space. */
export async function switchSpace(backend: StorageBackend, spaceId: string): Promise<void> {
  const manifest = await loadSpaces(backend);
  if (!manifest.spaces.find((s) => s.id === spaceId)) {
    throw new Error(`Space not found: ${spaceId}`);
  }
  manifest.activeSpaceId = spaceId;
  await saveSpaces(backend, manifest);
}

/** Delete a space by id. Cannot delete the last space. */
export async function deleteSpace(backend: StorageBackend, spaceId: string): Promise<void> {
  const manifest = await loadSpaces(backend);
  if (manifest.spaces.length <= 1) {
    throw new Error('Cannot delete the last space');
  }
  manifest.spaces = manifest.spaces.filter((s) => s.id !== spaceId);

  // Delete the space's data directory (for non-default spaces)
  if (spaceId !== DEFAULT_SPACE_ID) {
    try {
      await backend.deleteFile(`.cept/spaces/${spaceId}`);
    } catch {
      // Ignore if not found
    }
  }

  // If active space was deleted, switch to first remaining
  if (manifest.activeSpaceId === spaceId) {
    manifest.activeSpaceId = manifest.spaces[0].id;
  }
  await saveSpaces(backend, manifest);
}

/** Rename a space. */
export async function renameSpace(
  backend: StorageBackend,
  spaceId: string,
  name: string,
): Promise<void> {
  const manifest = await loadSpaces(backend);
  const space = manifest.spaces.find((s) => s.id === spaceId);
  if (!space) throw new Error(`Space not found: ${spaceId}`);
  space.name = name;
  await saveSpaces(backend, manifest);
}

/**
 * Get the workspace state file path for a given space.
 * The default space uses the root path for backward compatibility.
 */
export function spaceWorkspaceFile(spaceId: string): string {
  if (spaceId === DEFAULT_SPACE_ID) return '.cept/workspace-state.json';
  return `.cept/spaces/${spaceId}/workspace-state.json`;
}

/**
 * Get the pages directory for a given space.
 * The default space uses the root 'pages/' for backward compatibility.
 */
export function spacePagesDir(spaceId: string): string {
  if (spaceId === DEFAULT_SPACE_ID) return 'pages';
  return `.cept/spaces/${spaceId}/pages`;
}
