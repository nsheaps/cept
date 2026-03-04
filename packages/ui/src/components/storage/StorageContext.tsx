/**
 * StorageContext — React context providing access to the active StorageBackend.
 *
 * This replaces direct localStorage usage throughout the app. Components
 * use `useStorage()` to get the backend, or `useWorkspaceState()` for the
 * higher-level workspace persistence API.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import type { SidebarPageRef } from '../sidebar/Sidebar.js';
import { DEFAULT_SETTINGS } from '../settings/SettingsModal.js';
import type { CeptSettings } from '../settings/SettingsModal.js';

/** Shape of the persisted workspace state stored via the backend */
export interface PersistedState {
  pages: PageTreeNode[];
  pageContents: Record<string, string>;
  favorites: SidebarPageRef[];
  recentPages: SidebarPageRef[];
  selectedPageId?: string;
  spaceName?: string;
}

const WORKSPACE_FILE = '.cept/workspace-state.json';
const SETTINGS_FILE = '.cept/settings.json';
const LEGACY_STORAGE_KEY = 'cept-workspace';
const LEGACY_SETTINGS_KEY = 'cept-settings';

const StorageContext = createContext<StorageBackend | null>(null);

export function StorageProvider({
  backend,
  children,
}: {
  backend: StorageBackend;
  children: ReactNode;
}) {
  return <StorageContext.Provider value={backend}>{children}</StorageContext.Provider>;
}

export function useStorage(): StorageBackend {
  const backend = useContext(StorageContext);
  if (!backend) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return backend;
}

/** Encode a JS value to UTF-8 bytes */
function encode(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/** Decode UTF-8 bytes to a JS value, or return null */
function decode<T>(data: Uint8Array | null): T | null {
  if (!data) return null;
  try {
    return JSON.parse(new TextDecoder().decode(data)) as T;
  } catch {
    return null;
  }
}

/**
 * Load persisted workspace state from the storage backend.
 * Falls back to legacy localStorage if backend has no data (migration).
 */
export async function loadPersistedState(backend: StorageBackend): Promise<PersistedState | null> {
  // Try loading from backend
  const data = await backend.readFile(WORKSPACE_FILE);
  if (data) {
    return decode<PersistedState>(data);
  }

  // Migrate from localStorage if available
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as PersistedState;
        // Save to backend for future loads
        await backend.writeFile(WORKSPACE_FILE, encode(state));
        // Clean up legacy storage
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return state;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  return null;
}

/** Save workspace state to the storage backend */
export async function savePersistedState(
  backend: StorageBackend,
  state: PersistedState,
): Promise<void> {
  await backend.writeFile(WORKSPACE_FILE, encode(state));
}

/** Load settings from the storage backend (with localStorage migration) */
export async function loadSettingsFromBackend(
  backend: StorageBackend,
  defaults: CeptSettings,
): Promise<CeptSettings> {
  const data = await backend.readFile(SETTINGS_FILE);
  if (data) {
    const parsed = decode<CeptSettings>(data);
    return parsed ? { ...defaults, ...parsed } : { ...defaults };
  }

  // Migrate from localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
      if (raw) {
        const settings = { ...defaults, ...JSON.parse(raw) } as CeptSettings;
        await backend.writeFile(SETTINGS_FILE, encode(settings));
        localStorage.removeItem(LEGACY_SETTINGS_KEY);
        return settings;
      }
    } catch {
      // Ignore
    }
  }

  return { ...defaults };
}

/** Save settings to the storage backend */
export async function saveSettingsToBackend(
  backend: StorageBackend,
  settings: CeptSettings,
): Promise<void> {
  await backend.writeFile(SETTINGS_FILE, encode(settings));
}

/** Reset settings on the backend */
export async function resetSettingsOnBackend(backend: StorageBackend): Promise<void> {
  try {
    await backend.deleteFile(SETTINGS_FILE);
  } catch {
    // Ignore if file doesn't exist
  }
}

/** Clear all workspace data from the backend */
export async function clearAllData(backend: StorageBackend): Promise<void> {
  try {
    await backend.deleteFile(WORKSPACE_FILE);
  } catch {
    // Ignore
  }
  try {
    await backend.deleteFile(SETTINGS_FILE);
  } catch {
    // Ignore
  }
}

/**
 * Hook that manages loading and saving workspace state via the storage backend.
 * Returns loaded state and a debounced save function.
 */
export function useWorkspacePersistence(backend: StorageBackend) {
  const [loaded, setLoaded] = useState<{
    state: PersistedState | null;
    settings: CeptSettings;
    ready: boolean;
  }>({ state: null, settings: { autoSave: true, showDemoContent: false }, ready: false });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [state, settings] = await Promise.all([
        loadPersistedState(backend),
        loadSettingsFromBackend(backend, DEFAULT_SETTINGS),
      ]);
      if (!cancelled) {
        setLoaded({ state, settings, ready: true });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [backend]);

  const save = useCallback(
    (state: PersistedState) => {
      void savePersistedState(backend, state);
    },
    [backend],
  );

  return { ...loaded, save };
}
