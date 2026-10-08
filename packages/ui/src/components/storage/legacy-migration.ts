/**
 * One-time migration of legacy flat spaces to the folder layout (REQ-WS-025, D-30).
 *
 * A flat space keeps its page tree in a state file (`workspace-state.json`)
 * and each page's content in `pages/<id>.md` (or a legacy `.html`). The
 * migration writes the same tree as Markdown files and folders with a
 * `space.cept.yaml` at the root, so the space is read like every other folder
 * space. It is safe to run again: everything is read from a backup taken
 * first, the marker is written last, and a run that stopped half way finishes
 * the next time the space opens.
 *
 * The backup (`.cept/migration-backup/`) holds the old state file and page
 * files at their old paths. It stays until the user confirms the migration,
 * and until then {@link undoFlatMigration} puts the flat layout back. Page
 * files no page in the tree points to (pages deleted to the trash before a
 * reload) are not converted; they are kept only in the backup.
 *
 * `.cept/migration-map.json` records the old id and new path of every page,
 * so links and URLs that use old ids can be followed later. It is kept after
 * the migration is confirmed.
 */

import { isPageFile, SPACE_MARKER_YAML } from '@cept/core';
import type { StorageBackend } from '@cept/core';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';
import type { SidebarPageRef } from '../sidebar/Sidebar.js';
import type { PersistedState } from './StorageContext.js';
import { initFolderSpace, pageNameFromTitle } from './folder-space.js';
import { SPACE_PAGES_DIR, SPACE_STATE_FILE } from './space-store.js';
import type { SpaceStore } from './space-store.js';

export const BACKUP_DIR = '.cept/migration-backup';
const BACKUP_MANIFEST = `${BACKUP_DIR}/manifest.json`;
export const MIGRATION_MAP_FILE = '.cept/migration-map.json';
/** Written by an undo, so the space stays flat instead of being migrated again. */
export const KEEP_FLAT_FILE = '.cept/keep-flat-layout';

/** What the backup holds: the old state file's path and every file copied, by old path. */
interface BackupManifest {
  version: 1;
  stateFile: string;
  files: string[];
}

/** Old page ids and the paths they moved to, plus every file the migration wrote. */
export interface MigrationMap {
  version: 1;
  pages: Record<string, string>;
  files: string[];
}

/** Where one page of the tree goes: its new id and the file holding its content. */
interface Placed {
  oldId: string;
  id: string;
  file: string;
  title: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (value: unknown) => encoder.encode(JSON.stringify(value, null, 2));
const backupPath = (path: string) => `${BACKUP_DIR}/${path}`;

async function readJson<T>(backend: StorageBackend, path: string): Promise<T | null> {
  const bytes = await backend.readFile(path);
  if (!bytes) return null;
  try {
    return JSON.parse(decoder.decode(bytes)) as T;
  } catch {
    return null;
  }
}

/** Every file below `dir`, depth first; nothing when `dir` does not exist. */
async function filesUnder(backend: StorageBackend, dir: string): Promise<string[]> {
  if (!(await backend.exists(dir))) return [];
  const out: string[] = [];
  for (const entry of await backend.listDirectory(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) out.push(...(await filesUnder(backend, path)));
    else out.push(path);
  }
  return out;
}

async function copy(backend: StorageBackend, from: string, to: string): Promise<void> {
  const bytes = await backend.readFile(from);
  if (bytes) await backend.writeFile(to, bytes);
}

/**
 * The backup to migrate from, taken now if there is none yet. The manifest is
 * written after every copy, so a backup without one is incomplete and is
 * taken again. `null` when the space has no state file to migrate.
 */
async function ensureBackup(store: SpaceStore): Promise<BackupManifest | null> {
  const { backend } = store;
  const existing = await readJson<BackupManifest>(backend, BACKUP_MANIFEST);
  if (existing) return existing;
  if (!(await backend.exists(store.stateFile))) return null;
  const files = [store.stateFile, ...(await filesUnder(backend, SPACE_PAGES_DIR))];
  for (const file of files) await copy(backend, file, backupPath(file));
  const manifest: BackupManifest = { version: 1, stateFile: store.stateFile, files };
  await backend.writeFile(BACKUP_MANIFEST, encode(manifest));
  return manifest;
}

const stripPageExtension = (name: string) => name.replace(/\.(md|markdown)$/i, '');
const RESERVED = new Set(['index', 'readme']);
const ROOT_RESERVED = new Set(['space.cept.yaml', 'space.cept.yml', SPACE_PAGES_DIR]);

/**
 * Give every page in `nodes` a file or folder name from its title, unique
 * among its siblings without regard to case (`Notes`, `Notes 2`, …). `index`
 * and `readme` hold folder pages, so a page with that title is numbered too.
 */
function place(nodes: readonly PageTreeNode[], parent: string, into: Placed[]): void {
  const taken = new Set<string>();
  const free = (base: string) => {
    for (let n = 1; ; n++) {
      const name = n === 1 ? base : `${base} ${n}`;
      const key = stripPageExtension(name).toLowerCase();
      const reserved = RESERVED.has(key) || (!parent && ROOT_RESERVED.has(name.toLowerCase()));
      if (!reserved && !taken.has(key)) {
        taken.add(key);
        return name;
      }
    }
  };
  for (const node of nodes) {
    const name = free(pageNameFromTitle(node.title) || 'Untitled');
    const path = parent ? `${parent}/${name}` : name;
    if (node.children.length > 0) {
      into.push({ oldId: node.id, id: path, file: `${path}/index.md`, title: name });
      place(node.children, path, into);
    } else {
      const file = isPageFile(name) ? path : `${path}.md`;
      into.push({ oldId: node.id, id: file, file, title: stripPageExtension(name) });
    }
  }
}

/** The state with every page id moved to its new path; pages that are gone are dropped. */
function remapState(state: PersistedState, placed: readonly Placed[], name: string) {
  const byOld = new Map(placed.map((p) => [p.oldId, p]));
  const tree = (nodes: readonly PageTreeNode[]): PageTreeNode[] =>
    nodes.flatMap((node) => {
      const to = byOld.get(node.id);
      if (!to) return [];
      return [{ ...node, id: to.id, title: to.title, children: tree(node.children) }];
    });
  const refs = (list: readonly SidebarPageRef[] | undefined): SidebarPageRef[] =>
    (list ?? []).flatMap((ref) => {
      const to = byOld.get(ref.id);
      if (!to) return [];
      const { parentId: _parentId, ...rest } = ref;
      return [{ ...rest, id: to.id, title: to.title }];
    });
  return {
    pages: tree(state.pages ?? []),
    favorites: refs(state.favorites),
    recentPages: refs(state.recentPages),
    selectedPageId: state.selectedPageId ? byOld.get(state.selectedPageId)?.id : undefined,
    spaceName: state.spaceName ?? name,
  };
}

/**
 * A page's content from the backup: `pages/<id>.md`, else the legacy `.html`,
 * else the content an older state file held inline, else empty.
 */
async function backedUpContent(
  backend: StorageBackend,
  state: PersistedState,
  oldId: string,
): Promise<Uint8Array> {
  for (const ext of ['md', 'html']) {
    const bytes = await backend.readFile(backupPath(`${SPACE_PAGES_DIR}/${oldId}.${ext}`));
    if (bytes) return bytes;
  }
  return encoder.encode(state.pageContents?.[oldId] ?? '');
}

/**
 * Migrate the flat space in `store` to the folder layout. Returns `false`
 * (and changes nothing) when it is already a folder space, has no state file,
 * or was migrated and then undone; `true` once the migration is complete.
 */
export async function migrateFlatSpace(store: SpaceStore, name: string): Promise<boolean> {
  const { backend } = store;
  if (await backend.exists(SPACE_MARKER_YAML)) return false;
  if (await backend.exists(KEEP_FLAT_FILE)) return false;
  const backup = await ensureBackup(store);
  if (!backup) return false;
  const state = await readJson<PersistedState>(backend, backupPath(backup.stateFile));
  if (!state) throw new Error('Cannot migrate this space: its saved state is not valid JSON');

  const placed: Placed[] = [];
  place(state.pages ?? [], '', placed);

  // The backup holds every original, so they can go before the new files are
  // written; a page called "pages" then does not meet the old folder.
  for (const file of backup.files) await backend.deleteFile(file);
  await backend.deleteFile(SPACE_PAGES_DIR);

  for (const page of placed)
    await backend.writeFile(page.file, await backedUpContent(backend, state, page.oldId));
  const remapped = remapState(state, placed, name);
  await backend.writeFile(SPACE_STATE_FILE, encode(remapped));
  const map: MigrationMap = {
    version: 1,
    pages: Object.fromEntries(placed.map((p) => [p.oldId, p.id])),
    files: placed.map((p) => p.file),
  };
  await backend.writeFile(MIGRATION_MAP_FILE, encode(map));
  await initFolderSpace(backend, remapped.spaceName);
  return true;
}

/** Whether a migration's backup is still kept, waiting for the user to confirm. */
export function hasMigrationBackup(backend: StorageBackend): Promise<boolean> {
  return backend.exists(BACKUP_MANIFEST);
}

/** Keep the migration: delete its backup. The migration map stays. */
export async function confirmFlatMigration(backend: StorageBackend): Promise<void> {
  await backend.deleteFile(BACKUP_DIR);
}

/**
 * Put the flat layout back from the backup. The files the migration wrote are
 * deleted, so changes made since the migration are lost; pages added since
 * stay on disk but are no longer shown. The space is then kept flat and not
 * migrated again.
 */
export async function undoFlatMigration(store: SpaceStore): Promise<void> {
  const { backend } = store;
  const backup = await readJson<BackupManifest>(backend, BACKUP_MANIFEST);
  if (!backup) throw new Error('Cannot undo the migration: its backup is gone');
  // Mark the space flat first, so a stop half way through is never migrated again.
  await backend.writeFile(KEEP_FLAT_FILE, new Uint8Array());
  await backend.deleteFile(SPACE_MARKER_YAML);
  const map = await readJson<MigrationMap>(backend, MIGRATION_MAP_FILE);
  for (const file of map?.files ?? []) await backend.deleteFile(file);
  if (backup.stateFile !== SPACE_STATE_FILE) await backend.deleteFile(SPACE_STATE_FILE);
  for (const file of backup.files) await copy(backend, backupPath(file), file);
  await backend.deleteFile(MIGRATION_MAP_FILE);
  await backend.deleteFile(BACKUP_DIR);
}

/**
 * Finish an undo that stopped half way (the space is marked flat but the
 * backup is still there). Every step of the undo can run again, so this just
 * reruns it. Returns whether there was one to finish.
 */
export async function finishInterruptedUndo(store: SpaceStore): Promise<boolean> {
  const { backend } = store;
  if (!(await backend.exists(KEEP_FLAT_FILE))) return false;
  if (!(await hasMigrationBackup(backend))) return false;
  await undoFlatMigration(store);
  return true;
}
