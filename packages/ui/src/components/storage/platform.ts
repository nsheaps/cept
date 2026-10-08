/**
 * What this device can do for storage (REQ-WS-017), so the UI offers only the
 * kinds of space that work here. Probes browser APIs, never the backend's
 * `type` (architecture rule 4).
 */

import type { StorageBackend } from '@cept/core';
import { canHostGitClone } from './git-space.js';

/** Browser storage APIs present on this device. */
export interface PlatformFeatures {
  /** `showDirectoryPicker`, for opening a folder on disk (Chromium on desktop). */
  fileSystemAccess: boolean;
  /** IndexedDB, which holds spaces stored in the browser. */
  indexedDB: boolean;
}

/** The kinds of space that can be added on this device. */
export interface SpaceSources {
  /** A new space stored in the browser. */
  browser: boolean;
  /** A folder on disk opened as a space. */
  folder: boolean;
  /** A space cloned from a Git repository. */
  git: boolean;
}

/** Probe `scope` (the window by default) for the storage APIs Cept uses. */
export function probePlatform(
  scope: { showDirectoryPicker?: unknown; indexedDB?: unknown } = globalThis,
): PlatformFeatures {
  return {
    fileSystemAccess: typeof scope.showDirectoryPicker === 'function',
    indexedDB: typeof scope.indexedDB === 'object' && scope.indexedDB !== null,
  };
}

/** Which kinds of space can be added, given the device and the app's backend. */
export function spaceSources(platform: PlatformFeatures, backend: StorageBackend): SpaceSources {
  return {
    browser: platform.indexedDB,
    folder: platform.fileSystemAccess,
    git: canHostGitClone(backend),
  };
}
