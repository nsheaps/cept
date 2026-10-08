/**
 * useSpaces — React state for the spaces manifest and the active space,
 * backed by a {@link SpaceManager} for the given backend.
 */

import { useCallback, useMemo, useState } from 'react';
import type { StorageBackend } from '@cept/core';
import { SpaceManager } from './SpaceManager.js';
import type { SpacesManifest } from './SpaceManager.js';
import { DEFAULT_SPACE_ID } from './space-paths.js';

export interface UseSpaces {
  manager: SpaceManager;
  /** The manifest as last loaded or saved, or `null` before the first load. */
  manifest: SpacesManifest | null;
  setManifest: (manifest: SpacesManifest) => void;
  /** The space whose pages the app shows. */
  activeId: string;
  setActiveId: (id: string) => void;
  /** Reload the manifest from the backend and return it. */
  refresh: () => Promise<SpacesManifest>;
}

export function useSpaces(backend: StorageBackend): UseSpaces {
  const manager = useMemo(() => new SpaceManager(backend), [backend]);
  const [manifest, setManifest] = useState<SpacesManifest | null>(null);
  const [activeId, setActiveId] = useState(DEFAULT_SPACE_ID);
  const refresh = useCallback(async () => {
    const loaded = await manager.load();
    setManifest(loaded);
    return loaded;
  }, [manager]);
  return { manager, manifest, setManifest, activeId, setActiveId, refresh };
}
