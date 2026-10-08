/**
 * The web app's FolderHost (REQ-WS-012, REQ-WEB-023): folders on this device
 * through the File System Access API. Built here because ui never constructs
 * a concrete backend (CLAUDE.md rule 3).
 */

import { WebFsBackend, createFolderHandleStore, pickDirectory } from '@cept/core';
import type { FolderHost } from '@cept/ui';

/**
 * A FolderHost when this browser can open folders (`showDirectoryPicker`,
 * Chromium on desktop), otherwise null, so the app offers no "Open folder".
 * Picked folders are kept in the IndexedDB database `handlesDb`.
 */
export function createFolderHost(
  handlesDb: string,
  scope: { showDirectoryPicker?: unknown } = globalThis as { showDirectoryPicker?: unknown },
): FolderHost | null {
  if (typeof scope.showDirectoryPicker !== 'function') return null;
  return {
    pick: () => pickDirectory(scope),
    open: (handle) => new WebFsBackend(handle),
    handles: createFolderHandleStore(handlesDb),
  };
}
