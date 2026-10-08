/**
 * Opening a folder on this device as a space (REQ-WS-012, REQ-WEB-023).
 *
 * Everything here only reads the folder (REQ-WS-019). Making a folder a space
 * (writing its `space.cept.yaml`) is a separate step the user asks for
 * ({@link initFolderSpace}), never part of opening.
 */

import { discoverSpaces, restoreFolders } from '@cept/core';
import type { FolderHandleStore, StorageBackend } from '@cept/core';
import type { FolderHost } from './folder-host.js';
import type { SpaceManager, SpaceMeta, SpacesManifest } from './SpaceManager.js';

/** How deep below the opened folder to look for spaces. */
export const FOLDER_DISCOVERY_DEPTH = 10;

/** A space found in an opened folder. */
export interface FolderSpaceChoice {
  /** The space's folder, relative to the opened folder (`''` for the folder itself). */
  path: string;
  /** The space's name from its marker, or its folder's name when the marker cannot be read. */
  name: string;
  /** Why the space cannot be opened as is (an invalid marker, a duplicate slug). */
  error?: string;
}

/** What an opened folder holds. */
export interface FolderContents {
  /** The folder itself, when it is a space. */
  root: FolderSpaceChoice | null;
  /** Spaces in its subfolders. Empty when the folder itself is a space. */
  nested: FolderSpaceChoice[];
}

/** Look for spaces in an opened folder named `folderName`. Reads only. */
export async function inspectFolder(
  backend: StorageBackend,
  folderName: string,
): Promise<FolderContents> {
  const { spaces } = await discoverSpaces(backend, { maxDepth: FOLDER_DISCOVERY_DEPTH });
  const choices = spaces.map((s): FolderSpaceChoice => ({
    path: s.path,
    name: s.config?.name ?? (s.path.split('/').filter(Boolean).at(-1) || folderName),
    ...(s.errors.length > 0 ? { error: s.errors.join('; ') } : {}),
  }));
  const root = choices.find((c) => c.path === '') ?? null;
  return { root, nested: root ? [] : choices };
}

/** A directory handle that can say whether it is the same folder as another. */
type ComparableHandle = FileSystemDirectoryHandle & {
  isSameEntry?: (other: FileSystemHandle) => Promise<boolean>;
};

/**
 * The id of the saved folder space that opens `handle` at `subPath`, so
 * picking the same folder again goes back to its space instead of adding
 * another. Null when there is none or the browser cannot compare handles.
 */
export async function findSavedFolder(
  manifest: SpacesManifest,
  handles: FolderHandleStore,
  handle: FileSystemDirectoryHandle,
  subPath = '',
): Promise<string | null> {
  const isSame = (handle as ComparableHandle).isSameEntry;
  if (typeof isSame !== 'function') return null;
  let saved: { id: string; handle: FileSystemDirectoryHandle }[];
  try {
    saved = await handles.list();
  } catch {
    return null;
  }
  for (const entry of saved) {
    const space = manifest.spaces.find((s) => s.id === entry.id);
    if (!space || space.backend !== 'folder' || (space.subPath ?? '') !== subPath) continue;
    try {
      if (await isSame.call(handle, entry.handle)) return space.id;
    } catch {
      // A handle whose folder is gone does not match.
    }
  }
  return null;
}

/**
 * Connect the folders of saved folder spaces that the browser still lets the
 * app use, without asking (asking needs a click). Returns the handles of the
 * others, by space id, so the app can ask for them from a click.
 */
export async function restoreFolderSpaces(
  manager: SpaceManager,
  manifest: SpacesManifest,
  host: FolderHost,
): Promise<Map<string, FileSystemDirectoryHandle>> {
  const waiting = new Map<string, FileSystemDirectoryHandle>();
  const folderSpaces = new Map<string, SpaceMeta>(
    manifest.spaces.filter((s) => s.backend === 'folder').map((s) => [s.id, s]),
  );
  if (folderSpaces.size === 0) return waiting;
  for (const { id, handle, permission } of await restoreFolders(host.handles)) {
    const space = folderSpaces.get(id);
    if (!space) continue;
    if (permission === 'granted') manager.connectFolder(space, host.open(handle));
    else waiting.set(id, handle);
  }
  return waiting;
}
