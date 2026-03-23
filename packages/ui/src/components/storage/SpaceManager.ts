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
 * Separator between branch and subPath in a remote space ID.
 * Using `::` avoids ambiguity with `/` in branch names like `claude/fix-issues`.
 *
 * Format: `repo@branch[::subPath]`
 * e.g., "github.com/nsheaps/cept@main::docs"
 * e.g., "github.com/nsheaps/cept@claude/setup-fix::docs"
 *
 * Legacy format (still supported for parsing): `repo@branch[/subPath]`
 */
const SUBPATH_SEPARATOR = '::';

/**
 * Generate a deterministic space ID from repo URL, branch, and optional sub-path.
 * Uses `@` to separate repo from branch and `::` to separate branch from subPath.
 * This avoids ambiguity when branch names contain `/` (e.g., "claude/fix-issues").
 *
 * e.g., "https://github.com/nsheaps/cept" + "main" + "docs/" → "github.com/nsheaps/cept@main::docs"
 * e.g., "https://github.com/nsheaps/cept" + "claude/fix" → "github.com/nsheaps/cept@claude/fix"
 */
export function generateRemoteSpaceId(remoteUrl: string, branch: string, subPath?: string): string {
  // Strip protocol and trailing slashes
  const repo = remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
  let id = `${repo}@${branch}`;
  // Append sub-path if present, using :: separator
  if (subPath) {
    const cleanSubPath = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (cleanSubPath) {
      id += `${SUBPATH_SEPARATOR}${cleanSubPath}`;
    }
  }
  return id;
}

/**
 * Parse a remote space ID back into its components.
 * Supports both new format (`repo@branch::subPath`) and legacy (`repo@branch/subPath`).
 * Returns null if the ID is not a valid remote space ID.
 */
export function parseRemoteSpaceId(spaceId: string): { repo: string; branch: string; subPath?: string } | null {
  const atIdx = spaceId.indexOf('@');
  if (atIdx < 0) return null;
  const repo = spaceId.substring(0, atIdx);
  const rest = spaceId.substring(atIdx + 1);

  // New format: branch::subPath (unambiguous even with / in branch names)
  const sepIdx = rest.indexOf(SUBPATH_SEPARATOR);
  if (sepIdx >= 0) {
    const branch = rest.substring(0, sepIdx);
    const subPath = rest.substring(sepIdx + SUBPATH_SEPARATOR.length);
    return subPath ? { repo, branch, subPath } : { repo, branch };
  }

  // Legacy format: branch/subPath (ambiguous for branches with /)
  // For backward compatibility, split on first /
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

/**
 * Resolve a route's space ID and page ID to a configured space.
 *
 * When the router parses a file URL (e.g., /g/.../blob/main/docs/getting-started.md),
 * it returns a minimal spaceId (repo@branch) and the full file path as pageId.
 * This function finds the best matching configured space (which may have a subPath)
 * and adjusts the pageId to be relative to that space's subPath.
 *
 * @returns The matched space ID and adjusted page ID, or the original values if no match.
 */
export function resolveRouteToSpace(
  manifest: SpacesManifest,
  routeSpaceId: string,
  routePageId: string | undefined,
): { spaceId: string; pageId: string | undefined } {
  // For non-remote spaces, do a simple exact match
  const routeParsed = parseRemoteSpaceId(routeSpaceId);
  if (!routeParsed) {
    return { spaceId: routeSpaceId, pageId: routePageId };
  }

  // If the exact space ID exists AND it has a subPath, return it directly
  const exact = manifest.spaces.find((s) => s.id === routeSpaceId);
  if (exact && routeParsed.subPath) {
    return { spaceId: routeSpaceId, pageId: routePageId };
  }

  // If no page ID, the URL is a space root — return as-is
  if (!routePageId) {
    return { spaceId: routeSpaceId, pageId: undefined };
  }

  // Build a combined path: everything after repo@.
  // The router may have split a multi-segment branch incorrectly
  // (e.g., branch="claude", pageId="setup-fix/docs/intro.md"
  //  when actual branch is "claude/setup-fix").
  const fullPath = `${routeParsed.branch}/${routePageId}`;

  // Find the best matching space using longest-prefix matching.
  // Longer matches (branch + subPath) are preferred over shorter ones.
  const repoCandidates = manifest.spaces.filter((s) => {
    const p = parseRemoteSpaceId(s.id);
    return p !== null && p.repo === routeParsed.repo;
  });

  let bestMatch: { space: SpaceMeta; pageId: string | undefined; matchLen: number } | null = null;

  for (const space of repoCandidates) {
    const spaceBranch = space.branch ?? parseRemoteSpaceId(space.id)?.branch;
    if (!spaceBranch) continue;

    if (!fullPath.startsWith(spaceBranch + '/') && fullPath !== spaceBranch) continue;

    const afterBranch = fullPath === spaceBranch ? '' : fullPath.substring(spaceBranch.length + 1);

    if (space.subPath) {
      const spPrefix = space.subPath.endsWith('/') ? space.subPath : space.subPath + '/';
      if (afterBranch.startsWith(spPrefix)) {
        const matchLen = spaceBranch.length + space.subPath.length;
        const adjustedPageId = afterBranch.substring(spPrefix.length) || undefined;
        if (!bestMatch || matchLen > bestMatch.matchLen) {
          bestMatch = { space, pageId: adjustedPageId, matchLen };
        }
      } else if (afterBranch === space.subPath) {
        const matchLen = spaceBranch.length + space.subPath.length;
        if (!bestMatch || matchLen > bestMatch.matchLen) {
          bestMatch = { space, pageId: undefined, matchLen };
        }
      }
    } else {
      const matchLen = spaceBranch.length;
      if (!bestMatch || matchLen > bestMatch.matchLen) {
        bestMatch = { space, pageId: afterBranch || undefined, matchLen };
      }
    }
  }

  if (bestMatch) {
    return { spaceId: bestMatch.space.id, pageId: bestMatch.pageId };
  }

  return { spaceId: routeSpaceId, pageId: routePageId };
}
