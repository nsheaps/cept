/**
 * Space stores — where one space's state file and pages live.
 *
 * Each space is read and written through a backend of its own whose root is
 * the space's folder. A space with its own backend (a memory space, later a
 * local folder) keeps `.cept/workspace-state.json` and `pages/` at that root.
 * Spaces kept inside the app's backend keep the paths they had before
 * per-space backends existed, so existing data still loads:
 * - the default space is the app backend's root;
 * - every other space is a ScopedBackend over `.cept/spaces/{id}/`, with its
 *   state file at that folder's root.
 */

import { ScopedBackend } from '@cept/core';
import type { StorageBackend } from '@cept/core';
import type { PersistedState } from './StorageContext.js';
import { DEFAULT_SPACE_ID, spaceDataDir } from './space-paths.js';

export const SPACE_STATE_FILE = '.cept/workspace-state.json';
export const SPACE_PAGES_DIR = 'pages';

/** One space's backend and the path of its state file in that backend. */
export interface SpaceStore {
  readonly backend: StorageBackend;
  readonly stateFile: string;
}

/** The store for a space held in its own backend. */
export function ownSpaceStore(backend: StorageBackend): SpaceStore {
  return { backend, stateFile: SPACE_STATE_FILE };
}

/** The store for a space kept inside the app's backend. */
export function appSpaceStore(appBackend: StorageBackend, spaceId: string): SpaceStore {
  if (spaceId === DEFAULT_SPACE_ID) return ownSpaceStore(appBackend);
  return {
    backend: new ScopedBackend(appBackend, spaceDataDir(spaceId)),
    stateFile: 'workspace-state.json',
  };
}

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

function pagePath(pageId: string, ext: 'md' | 'html'): string {
  return `${SPACE_PAGES_DIR}/${pageId}.${ext}`;
}

export async function saveStoreState(store: SpaceStore, state: PersistedState): Promise<void> {
  await store.backend.writeFile(store.stateFile, encode(state));
}

/**
 * Load a space's state. Older states kept page contents inline; those move to
 * page files and the state is saved without them.
 */
export async function loadStoreState(store: SpaceStore): Promise<PersistedState | null> {
  const data = await store.backend.readFile(store.stateFile);
  if (!data) return null;
  let state: PersistedState;
  try {
    state = JSON.parse(new TextDecoder().decode(data)) as PersistedState;
  } catch {
    return null;
  }
  if (state.pageContents && Object.keys(state.pageContents).length > 0) {
    await Promise.all(
      Object.entries(state.pageContents).map(([pageId, content]) =>
        store.backend.writeFile(pagePath(pageId, 'md'), new TextEncoder().encode(content)),
      ),
    );
    delete state.pageContents;
    await saveStoreState(store, state);
  }
  return state;
}

/** Read a page's content; falls back to the legacy `.html` file. */
export async function readStorePage(store: SpaceStore, pageId: string): Promise<string | null> {
  const md = await store.backend.readFile(pagePath(pageId, 'md'));
  if (md) return new TextDecoder().decode(md);
  const html = await store.backend.readFile(pagePath(pageId, 'html'));
  return html ? new TextDecoder().decode(html) : null;
}

/** Write a page's content as Markdown and drop any legacy `.html` copy. */
export async function writeStorePage(
  store: SpaceStore,
  pageId: string,
  content: string,
): Promise<void> {
  await store.backend.writeFile(pagePath(pageId, 'md'), new TextEncoder().encode(content));
  await store.backend.deleteFile(pagePath(pageId, 'html')).catch(() => undefined);
}

export async function deleteStorePage(store: SpaceStore, pageId: string): Promise<void> {
  await store.backend.deleteFile(pagePath(pageId, 'md')).catch(() => undefined);
  await store.backend.deleteFile(pagePath(pageId, 'html')).catch(() => undefined);
}
