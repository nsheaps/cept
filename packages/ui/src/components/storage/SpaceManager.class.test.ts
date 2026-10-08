import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import { SpaceManager, createSpace } from './SpaceManager.js';
import type { SpaceSnapshot } from './SpaceManager.js';

function snapshot(name: string, ids: string[], selected?: string): SpaceSnapshot {
  return {
    pages: ids.map((id) => ({ id, title: id, children: [] })),
    favorites: [],
    recentPages: [],
    selectedPageId: selected,
    spaceName: name,
  };
}

describe('SpaceManager class', () => {
  let backend: MemoryBackend;
  let spaces: SpaceManager;

  beforeEach(() => {
    backend = new MemoryBackend();
    spaces = new SpaceManager(backend);
  });

  it('creates a space, makes it active and returns the saved manifest', async () => {
    const { space, manifest } = await spaces.create('Work', '💼');
    expect(space).toMatchObject({ name: 'Work', icon: '💼' });
    expect(manifest.activeSpaceId).toBe(space.id);
    expect(manifest.spaces.map((s) => s.name)).toEqual(['My Space', 'Work']);
    expect(await spaces.load()).toEqual(manifest);
  });

  it('switches the active space and returns its metadata', async () => {
    const { space: work } = await spaces.create('Work');
    const { space, manifest } = await spaces.switch('default');
    expect(space.id).toBe('default');
    expect(manifest.activeSpaceId).toBe('default');
    expect((await spaces.switch(work.id)).manifest.activeSpaceId).toBe(work.id);
  });

  it('refuses to switch to a missing space', async () => {
    await expect(spaces.switch('nope')).rejects.toThrow(/Space not found/);
  });

  it('renames a space', async () => {
    const { space } = await spaces.create('Work');
    const manifest = await spaces.rename(space.id, 'Office');
    expect(manifest.spaces.find((s) => s.id === space.id)?.name).toBe('Office');
  });

  it('deletes the active space with its data and falls back to the first space', async () => {
    const { space } = await spaces.create('Work');
    await spaces.saveState(space.id, snapshot('Work', ['a'], 'a'), { a: '# A' });
    const { manifest, active } = await spaces.delete(space.id);
    expect(manifest.spaces.map((s) => s.id)).toEqual(['default']);
    expect(active.id).toBe('default');
    expect(await spaces.readPage(space.id, 'a')).toBeNull();
  });

  it('deleting another space keeps the active one', async () => {
    const { space: work } = await spaces.create('Work');
    const { space: home } = await spaces.create('Home');
    const { active } = await spaces.delete(work.id);
    expect(active.id).toBe(home.id);
  });

  it('deleting the last space leaves a new default space', async () => {
    const { manifest, active } = await spaces.delete('default');
    expect(manifest.spaces.map((s) => s.id)).toEqual(['default']);
    expect(active.id).toBe('default');
  });

  it('flat layout: saves and reopens a space with its selected page content', async () => {
    // A space in its own backend stays flat; only app spaces are converted.
    spaces.bind('own', new MemoryBackend());
    await spaces.saveState('own', snapshot('Work', ['a', 'b'], 'b'), {
      a: '# A',
      b: '# B',
      c: '',
    });
    const opened = await spaces.open('own', 'fallback');
    expect(opened.snapshot).toEqual(snapshot('Work', ['a', 'b'], 'b'));
    expect(opened.selectedContent).toBe('# B');
    expect(opened.converted).toBe(false);
    expect(await spaces.readPage('own', 'a')).toBe('# A');
    expect(await spaces.readPage('own', 'c')).toBeNull();
  });

  it('flat layout: opens a space that was never saved as null', async () => {
    const space = await createSpace(backend, 'Empty');
    expect(await spaces.open(space.id, 'Empty')).toEqual({ snapshot: null, selectedContent: null });
  });

  it('flat layout: opens a saved space with no pages, keeping its name and sidebar lists', async () => {
    spaces.bind('own', new MemoryBackend());
    const fav = { id: 'gone', title: 'Gone' };
    await spaces.saveState('own', {
      pages: [],
      favorites: [fav],
      recentPages: [fav],
      spaceName: 'Renamed',
    });
    const { snapshot: opened } = await spaces.open('own', 'fallback');
    expect(opened).toMatchObject({ pages: [], favorites: [fav], recentPages: [fav] });
    expect(opened?.spaceName).toBe('Renamed');
  });

  it('converts a flat app space to folders when it opens, keeping a backup until confirmed', async () => {
    const space = await createSpace(backend, 'Work');
    await spaces.saveState(space.id, snapshot('Work', ['a', 'b'], 'b'), { a: '# A', b: '# B' });

    const opened = await spaces.open(space.id, 'fallback');
    expect(opened).toMatchObject({ converted: true, backupKept: true, selectedContent: '# B' });
    expect(opened.snapshot?.pages.map((p) => p.id)).toEqual(['a.md', 'b.md']);
    expect(opened.snapshot?.selectedPageId).toBe('b.md');
    expect(spaces.isFolder(space.id)).toBe(true);
    expect(await spaces.readPage(space.id, 'a.md')).toBe('# A');

    const again = await spaces.open(space.id, 'fallback');
    expect(again).toMatchObject({ converted: false, backupKept: true });
    await spaces.confirmConversion(space.id);
    expect((await spaces.open(space.id, 'fallback')).backupKept).toBe(false);
  });

  it('undoes a conversion and keeps the space flat afterwards', async () => {
    const space = await createSpace(backend, 'Work');
    await spaces.saveState(space.id, snapshot('Work', ['a'], 'a'), { a: '# A' });
    await spaces.open(space.id, 'fallback');

    await spaces.undoConversion(space.id);
    expect(spaces.isFolder(space.id)).toBe(false);
    const opened = await spaces.open(space.id, 'fallback');
    expect(opened).toMatchObject({ converted: false, backupKept: false });
    expect(opened.snapshot).toEqual(snapshot('Work', ['a'], 'a'));
    expect(opened.selectedContent).toBe('# A');
  });

  it('leaves remote and memory spaces flat', async () => {
    const remote = 'github.com/o/r@main';
    await spaces.saveState(remote, snapshot('R', ['a'], 'a'), { a: '# A' });
    expect((await spaces.open(remote, 'R')).converted).toBe(false);
    expect(spaces.isFolder(remote)).toBe(false);

    const memory = new MemoryBackend();
    const { space } = await spaces.create('Mem', undefined, { kind: 'memory', backend: memory });
    await spaces.saveState(space.id, snapshot('Mem', ['a'], 'a'), { a: '# A' });
    expect((await spaces.open(space.id, 'Mem')).converted).toBe(false);
  });

  it('flat layout: keeps each space’s pages apart, and the default space uses the root pages folder', async () => {
    const space = await createSpace(backend, 'Work');
    await spaces.writePage('default', 'p', 'default text');
    await spaces.writePage(space.id, 'p', 'work text');
    expect(backend.readText('pages/p.md')).toBe('default text');
    expect(await spaces.readPage(space.id, 'p')).toBe('work text');
    await spaces.deletePage(space.id, 'p');
    expect(await spaces.readPage(space.id, 'p')).toBeNull();
    expect(await spaces.readPage('default', 'p')).toBe('default text');
  });

  it('opens a folder space from its files, keeping saved icons and sidebar lists', async () => {
    const { space } = await spaces.create('Notes');
    const root = `.cept/spaces/${space.id}`;
    backend.seedText(`${root}/guides/index.md`, '# Guides');
    backend.seedText(`${root}/guides/setup.md`, '# Setup');
    await spaces.saveState(space.id, {
      pages: [{ id: 'guides', title: 'x', icon: '📘', children: [] }],
      favorites: [
        { id: 'guides/setup.md', title: 'old' },
        { id: 'gone.md', title: 'Gone' },
      ],
      recentPages: [],
      selectedPageId: 'guides',
      spaceName: 'Notes',
    });
    const reopened = new SpaceManager(backend);
    const { snapshot: opened, selectedContent } = await reopened.open(space.id, 'Notes');
    expect(opened?.pages).toEqual([
      {
        id: 'guides',
        title: 'guides',
        icon: '📘',
        children: [{ id: 'guides/setup.md', title: 'setup', children: [] }],
      },
    ]);
    expect(opened?.favorites).toEqual([{ id: 'guides/setup.md', title: 'setup' }]);
    expect(selectedContent).toBe('# Guides');
  });

  it('creates, renames and moves folder space pages as files at their paths', async () => {
    const { space } = await spaces.create('Notes');
    const root = `.cept/spaces/${space.id}`;
    const added = await spaces.addPage(space.id);
    expect(added.pageId).toBe('Untitled.md');
    const child = await spaces.addPage(space.id, added.pageId);
    expect(child).toEqual({
      pageId: 'Untitled/Untitled.md',
      moved: [{ from: 'Untitled.md', to: 'Untitled' }],
    });
    await spaces.writePage(space.id, child.pageId, '# Child');
    const renamed = await spaces.renamePage(space.id, 'Untitled', 'Plans');
    expect(renamed.pageId).toBe('Plans');
    const moved = await spaces.movePageToRoot(space.id, 'Plans/Untitled.md');
    expect(moved.pageId).toBe('Untitled.md');
    expect(backend.readText(`${root}/Untitled.md`)).toBe('# Child');
    expect(backend.hasFile(`${root}/Plans/index.md`)).toBe(true);
    expect((await spaces.pageTree(space.id)).map((p) => p.id)).toEqual(['Plans', 'Untitled.md']);
  });

  it('records a sync time', async () => {
    const { space } = await spaces.createRemote('Repo', 'https://github.com/a/b', 'main');
    const before = space.lastSyncedAt;
    await new Promise((r) => setTimeout(r, 2));
    const manifest = await spaces.markSynced(space.id);
    expect(manifest.spaces.find((s) => s.id === space.id)?.lastSyncedAt).not.toBe(before);
  });
});
