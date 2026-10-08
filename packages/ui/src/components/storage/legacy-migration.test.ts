import { describe, it, expect } from 'vitest';
import { ScopedBackend } from '@cept/core';
import { MemoryBackend } from './test-helpers.js';
import { appSpaceStore, ownSpaceStore } from './space-store.js';
import type { SpaceStore } from './space-store.js';
import {
  BACKUP_DIR,
  confirmFlatMigration,
  finishInterruptedUndo,
  hasMigrationBackup,
  migrateFlatSpace,
  MIGRATION_MAP_FILE,
  undoFlatMigration,
} from './legacy-migration.js';
import { readFolderPage, readFolderTree, toPageTree } from './folder-space.js';

const STATE = {
  pages: [
    {
      id: 'page-1',
      title: 'Guides',
      icon: '📘',
      isExpanded: true,
      children: [
        { id: 'page-2', title: 'Setup / Install', children: [] },
        { id: 'page-3', title: 'setup / install', children: [] },
      ],
    },
    { id: 'page-4', title: 'README', children: [] },
    { id: 'page-5', title: '', cover: 'c.png', children: [] },
    { id: 'page-6', title: 'Old HTML', children: [] },
  ],
  favorites: [
    { id: 'page-2', title: 'Setup / Install' },
    { id: 'gone', title: 'Gone' },
  ],
  recentPages: [{ id: 'page-1', title: 'Guides', icon: '📘' }],
  selectedPageId: 'page-2',
  spaceName: 'My Notes',
};

/** A flat space as the app wrote it: state file plus `pages/<id>.md` (one legacy `.html`). */
function seedFlat(backend: MemoryBackend, stateFile: string, prefix = ''): void {
  backend.seedFile(`${prefix}${stateFile}`, STATE);
  backend.seedText(`${prefix}pages/page-1.md`, '<p>Guides home</p>');
  backend.seedText(`${prefix}pages/page-2.md`, '<p>Install it</p>');
  backend.seedText(`${prefix}pages/page-3.md`, '<p>Lower case twin</p>');
  backend.seedText(`${prefix}pages/page-4.md`, '<p>Read me</p>');
  backend.seedText(`${prefix}pages/page-6.html`, '<p>From HTML</p>');
  backend.seedText(`${prefix}pages/orphan.md`, '<p>Deleted before a reload</p>');
}

/** Every file path in `backend`, depth first. */
async function allFiles(backend: MemoryBackend, dir = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await backend.listDirectory(dir || '/')) {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory) out.push(...(await allFiles(backend, path)));
    else out.push(path);
  }
  return out;
}

/** Every file and its text, leaving out the migration backup. */
async function filesOf(backend: MemoryBackend): Promise<Map<string, string>> {
  const paths = (await allFiles(backend)).filter((p) => !p.includes('.cept/migration-backup/'));
  return new Map(paths.map((p) => [p, backend.readText(p) ?? '']));
}

describe('migrateFlatSpace', () => {
  it('turns the page tree into files and folders, keeping content', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    const store = ownSpaceStore(backend);

    expect(await migrateFlatSpace(store, 'Fallback')).toBe(true);

    expect(backend.readText('space.cept.yaml')).toContain('name: My Notes');
    expect(backend.readText('Guides/index.md')).toBe('<p>Guides home</p>');
    expect(backend.readText('Guides/Setup - Install.md')).toBe('<p>Install it</p>');
    expect(backend.readText('Guides/setup - install 2.md')).toBe('<p>Lower case twin</p>');
    expect(backend.readText('README 2.md')).toBe('<p>Read me</p>');
    expect(backend.readText('Untitled.md')).toBe('');
    expect(backend.readText('Old HTML.md')).toBe('<p>From HTML</p>');
    expect(backend.hasFile('pages/page-1.md')).toBe(false);
    expect(backend.hasFile('pages/orphan.md')).toBe(false);
    expect(backend.readText(`${BACKUP_DIR}/pages/orphan.md`)).toBe(
      '<p>Deleted before a reload</p>',
    );
  });

  it('carries icons, covers, favourites, recent pages and the selection over to path ids', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    await migrateFlatSpace(ownSpaceStore(backend), 'Fallback');

    const state = JSON.parse(backend.readText('.cept/workspace-state.json')!);
    expect(state.selectedPageId).toBe('Guides/Setup - Install.md');
    expect(state.favorites).toEqual([
      { id: 'Guides/Setup - Install.md', title: 'Setup - Install' },
    ]);
    expect(state.recentPages).toEqual([{ id: 'Guides', title: 'Guides', icon: '📘' }]);
    expect(state.spaceName).toBe('My Notes');

    const pages = toPageTree(await readFolderTree(backend), state.pages);
    expect(pages.find((p) => p.id === 'Guides')).toMatchObject({ icon: '📘', isExpanded: true });
    expect(pages.find((p) => p.id === 'Untitled.md')).toMatchObject({ cover: 'c.png' });
    expect(await readFolderPage(backend, 'Guides')).toBe('<p>Guides home</p>');

    const map = JSON.parse(backend.readText(MIGRATION_MAP_FILE)!);
    expect(map.pages).toMatchObject({ 'page-1': 'Guides', 'page-6': 'Old HTML.md' });
  });

  it('does nothing for a folder space, a space with no state, or one kept flat', async () => {
    const folder = new MemoryBackend();
    folder.seedText('space.cept.yaml', 'version: "1"\nname: X\nslug: x\n');
    expect(await migrateFlatSpace(ownSpaceStore(folder), 'X')).toBe(false);

    const empty = new MemoryBackend();
    expect(await migrateFlatSpace(ownSpaceStore(empty), 'X')).toBe(false);
    expect(await allFiles(empty)).toEqual([]);
  });

  it('finishes a migration that stopped half way, from the backup', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    await migrateFlatSpace(ownSpaceStore(backend), 'Fallback');
    const done = await filesOf(backend);

    // Simulate a crash before the marker was written: the originals are gone,
    // some new files are there, the backup is complete.
    await backend.deleteFile('space.cept.yaml');
    await backend.deleteFile('Guides/index.md');
    expect(await migrateFlatSpace(ownSpaceStore(backend), 'Fallback')).toBe(true);
    expect(await filesOf(backend)).toEqual(done);

    // And running it again on a migrated space changes nothing.
    expect(await migrateFlatSpace(ownSpaceStore(backend), 'Fallback')).toBe(false);
    expect(await filesOf(backend)).toEqual(done);
  });

  it('migrates a space kept under .cept/spaces/<id>/ and leaves other spaces alone', async () => {
    const app = new MemoryBackend();
    seedFlat(app, 'workspace-state.json', '.cept/spaces/space-1/');
    seedFlat(app, '.cept/workspace-state.json');
    const store: SpaceStore = appSpaceStore(app, 'space-1');

    await migrateFlatSpace(store, 'Fallback');

    expect(app.readText('.cept/spaces/space-1/Guides/index.md')).toBe('<p>Guides home</p>');
    expect(app.hasFile('.cept/spaces/space-1/.cept/workspace-state.json')).toBe(true);
    expect(app.hasFile('.cept/spaces/space-1/workspace-state.json')).toBe(false);
    expect(app.hasFile('pages/page-1.md')).toBe(true);
    expect(app.hasFile('space.cept.yaml')).toBe(false);
  });

  it('keeps content an older state file held inline', async () => {
    const backend = new MemoryBackend();
    backend.seedFile('.cept/workspace-state.json', {
      pages: [
        { id: 'a', title: 'Inline', children: [] },
        { id: 'b', title: 'Both', children: [] },
      ],
      pageContents: { a: '<p>Inline only</p>', b: '<p>Stale</p>' },
    });
    backend.seedText('pages/b.md', '<p>Newer file</p>');
    await migrateFlatSpace(ownSpaceStore(backend), 'Fallback');
    expect(backend.readText('Inline.md')).toBe('<p>Inline only</p>');
    expect(backend.readText('Both.md')).toBe('<p>Newer file</p>');
    expect(backend.readText('.cept/workspace-state.json')).not.toContain('pageContents');
  });

  it('uses the fallback name when the state has none', async () => {
    const backend = new MemoryBackend();
    backend.seedFile('.cept/workspace-state.json', { pages: [], favorites: [], recentPages: [] });
    await migrateFlatSpace(ownSpaceStore(backend), 'Fallback');
    expect(backend.readText('space.cept.yaml')).toContain('name: Fallback');
  });
});

describe('confirming and undoing a migration', () => {
  it('keeps the backup until confirmed', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    await migrateFlatSpace(ownSpaceStore(backend), 'Fallback');
    expect(await hasMigrationBackup(backend)).toBe(true);

    await confirmFlatMigration(backend);
    expect(await hasMigrationBackup(backend)).toBe(false);
    expect((await allFiles(backend)).some((p) => p.startsWith(BACKUP_DIR))).toBe(false);
    expect(backend.hasFile(MIGRATION_MAP_FILE)).toBe(true);
  });

  it('restores the flat layout byte for byte and does not migrate again', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    const before = await filesOf(backend);
    const store = ownSpaceStore(backend);
    await migrateFlatSpace(store, 'Fallback');

    await undoFlatMigration(store);

    const after = await filesOf(backend);
    after.delete('.cept/keep-flat-layout');
    expect(after).toEqual(before);
    expect(await hasMigrationBackup(backend)).toBe(false);
    expect(await migrateFlatSpace(store, 'Fallback')).toBe(false);
  });

  it('restores a space kept under .cept/spaces/<id>/', async () => {
    const app = new MemoryBackend();
    seedFlat(app, 'workspace-state.json', '.cept/spaces/space-1/');
    const before = await filesOf(app);
    const store = appSpaceStore(app, 'space-1');
    await migrateFlatSpace(store, 'Fallback');
    await undoFlatMigration(store);
    const after = await filesOf(app);
    after.delete('.cept/spaces/space-1/.cept/keep-flat-layout');
    expect(after).toEqual(before);
    expect(store.backend).toBeInstanceOf(ScopedBackend);
  });

  it('finishes an undo that stopped half way', async () => {
    const backend = new MemoryBackend();
    seedFlat(backend, '.cept/workspace-state.json');
    const before = await filesOf(backend);
    const store = ownSpaceStore(backend);
    await migrateFlatSpace(store, 'Fallback');
    expect(await finishInterruptedUndo(store)).toBe(false);

    // The undo marked the space flat and removed the marker, then stopped.
    await backend.writeFile('.cept/keep-flat-layout', new Uint8Array());
    await backend.deleteFile('space.cept.yaml');

    expect(await finishInterruptedUndo(store)).toBe(true);
    const after = await filesOf(backend);
    after.delete('.cept/keep-flat-layout');
    expect(after).toEqual(before);
    expect(await finishInterruptedUndo(store)).toBe(false);
  });

  it('refuses to undo without a backup', async () => {
    const backend = new MemoryBackend();
    await expect(undoFlatMigration(ownSpaceStore(backend))).rejects.toThrow(/backup/);
  });
});
