import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import { SpaceManager } from './SpaceManager.js';
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
    // Ids come from Date.now(); keep the two creates in different milliseconds.
    await new Promise((r) => setTimeout(r, 2));
    const { space: home } = await spaces.create('Home');
    const { active } = await spaces.delete(work.id);
    expect(active.id).toBe(home.id);
  });

  it('refuses to delete the last space', async () => {
    await expect(spaces.delete('default')).rejects.toThrow(/last space/);
  });

  it('saves and reopens a space with its selected page content', async () => {
    const { space } = await spaces.create('Work');
    await spaces.saveState(space.id, snapshot('Work', ['a', 'b'], 'b'), {
      a: '# A',
      b: '# B',
      c: '',
    });
    const opened = await spaces.open(space.id, 'fallback');
    expect(opened.snapshot).toEqual(snapshot('Work', ['a', 'b'], 'b'));
    expect(opened.selectedContent).toBe('# B');
    expect(await spaces.readPage(space.id, 'a')).toBe('# A');
    expect(await spaces.readPage(space.id, 'c')).toBeNull();
  });

  it('opens a space with no saved pages as empty', async () => {
    const { space } = await spaces.create('Empty');
    expect(await spaces.open(space.id, 'Empty')).toEqual({ snapshot: null, selectedContent: null });
  });

  it('keeps each space’s pages apart, and the default space uses the root pages folder', async () => {
    const { space } = await spaces.create('Work');
    await spaces.writePage('default', 'p', 'default text');
    await spaces.writePage(space.id, 'p', 'work text');
    expect(backend.readText('pages/p.md')).toBe('default text');
    expect(await spaces.readPage(space.id, 'p')).toBe('work text');
    await spaces.deletePage(space.id, 'p');
    expect(await spaces.readPage(space.id, 'p')).toBeNull();
    expect(await spaces.readPage('default', 'p')).toBe('default text');
  });

  it('records a sync time', async () => {
    const { space } = await spaces.createRemote('Repo', 'https://github.com/a/b', 'main');
    const before = space.lastSyncedAt;
    await new Promise((r) => setTimeout(r, 2));
    const manifest = await spaces.markSynced(space.id);
    expect(manifest.spaces.find((s) => s.id === space.id)?.lastSyncedAt).not.toBe(before);
  });
});
