import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import { SpaceManager } from './SpaceManager.js';
import type { SpaceSnapshot } from './SpaceManager.js';

function snapshot(name: string, ids: string[]): SpaceSnapshot {
  return {
    pages: ids.map((id) => ({ id, title: id, children: [] })),
    favorites: [],
    recentPages: [],
    selectedPageId: ids[0],
    spaceName: name,
  };
}

describe('SpaceManager per-space backends', () => {
  let app: MemoryBackend;
  let spaces: SpaceManager;

  beforeEach(() => {
    app = new MemoryBackend();
    spaces = new SpaceManager(app);
  });

  it('keeps two memory spaces apart: writes to one never appear in the other', async () => {
    const memA = new MemoryBackend();
    const memB = new MemoryBackend();
    const { space: a } = await spaces.create('A', undefined, { kind: 'memory', backend: memA });
    const { space: b } = await spaces.create('B', undefined, { kind: 'memory', backend: memB });

    await spaces.saveState(a.id, snapshot('A', ['p']), { p: 'from A' });
    await spaces.writePage(b.id, 'q', 'from B');

    expect(await spaces.readPage(a.id, 'p')).toBe('from A');
    expect(await spaces.readPage(b.id, 'p')).toBeNull();
    expect(await spaces.readPage(a.id, 'q')).toBeNull();
    expect(memA.readText('pages/p.md')).toBe('from A');
    expect(memA.hasFile('.cept/workspace-state.json')).toBe(true);
    expect(memB.hasFile('pages/p.md')).toBe(false);
    expect(memB.readText('pages/q.md')).toBe('from B');
    // Nothing of either space lands in the app backend.
    expect(app.hasFile(`.cept/spaces/${a.id}/pages/p.md`)).toBe(false);
    expect(app.hasFile('pages/p.md')).toBe(false);
  });

  it('records the backend kind in the manifest', async () => {
    const { space: mem } = await spaces.create('Mem', undefined, {
      kind: 'memory',
      backend: new MemoryBackend(),
    });
    const { space: local, manifest } = await spaces.create('Local');
    expect(manifest.spaces.find((s) => s.id === mem.id)?.backend).toBe('memory');
    expect(local.backend).toBeUndefined();
    expect(spaces.kindOf(local)).toBe('app');
  });

  it('keeps the default and app spaces on the paths they used before', async () => {
    const { space } = await spaces.create('Work');
    await spaces.writePage('default', 'p', 'default');
    await spaces.saveState(space.id, snapshot('Work', ['p']), { p: 'work' });
    expect(app.readText('pages/p.md')).toBe('default');
    expect(app.readText(`.cept/spaces/${space.id}/pages/p.md`)).toBe('work');
    expect(app.hasFile(`.cept/spaces/${space.id}/workspace-state.json`)).toBe(true);
  });

  it('drops a memory space whose backend is gone after a reload', async () => {
    const { space } = await spaces.create('Mem', undefined, {
      kind: 'memory',
      backend: new MemoryBackend(),
    });
    const reloaded = new SpaceManager(app);
    const manifest = await reloaded.load();
    expect(manifest.spaces.map((s) => s.id)).not.toContain(space.id);
    expect(manifest.activeSpaceId).toBe('default');
    expect((await spaces.load()).spaces.map((s) => s.id)).toContain(space.id);
  });

  it('refuses to switch to or rename a dropped memory space without touching disk', async () => {
    const { space } = await spaces.create('Mem', undefined, {
      kind: 'memory',
      backend: new MemoryBackend(),
    });
    await spaces.switch('default');
    const reloaded = new SpaceManager(app);
    const before = app.readText('.cept/spaces.json');
    await expect(reloaded.switch(space.id)).rejects.toThrow('Space not found');
    await expect(reloaded.rename(space.id, 'Renamed')).rejects.toThrow('Space not found');
    expect(app.readText('.cept/spaces.json')).toBe(before);
  });

  it('forgets a deleted memory space', async () => {
    const backend = new MemoryBackend();
    const { space } = await spaces.create('Mem', undefined, { kind: 'memory', backend });
    await spaces.writePage(space.id, 'p', 'x');
    await spaces.delete(space.id);
    expect(spaces.store(space.id).backend).not.toBe(backend);
  });

  it('gives two spaces created in the same millisecond different ids', async () => {
    const x = await spaces.create('X');
    const y = await spaces.create('Y');
    expect(x.space.id).not.toBe(y.space.id);
  });

  describe('memory spaces are session-only', () => {
    let before: string | null;

    beforeEach(async () => {
      await spaces.create('Work');
      await spaces.switch('default');
      before = app.readText('.cept/spaces.json');
    });

    it('creating one leaves .cept/spaces.json untouched but shows it as active', async () => {
      const { space, manifest } = await spaces.create('Demo', undefined, {
        kind: 'memory',
        backend: new MemoryBackend(),
      });
      expect(app.readText('.cept/spaces.json')).toBe(before);
      expect(manifest.activeSpaceId).toBe(space.id);
      expect(manifest.spaces.map((s) => s.id)).toContain(space.id);
      expect((await spaces.load()).activeSpaceId).toBe(space.id);
    });

    it('switching into one and back writes only the switch back', async () => {
      const { space } = await spaces.create('Demo', undefined, {
        kind: 'memory',
        backend: new MemoryBackend(),
      });
      const into = await spaces.switch(space.id);
      expect(into.manifest.activeSpaceId).toBe(space.id);
      expect(app.readText('.cept/spaces.json')).toBe(before);
      const back = await spaces.switch('default');
      expect(back.manifest.activeSpaceId).toBe('default');
      expect(app.readText('.cept/spaces.json')).toBe(before);
    });

    it('renaming and deleting one never writes the manifest', async () => {
      const { space } = await spaces.create('Demo', undefined, {
        kind: 'memory',
        backend: new MemoryBackend(),
      });
      const renamed = await spaces.rename(space.id, 'Renamed');
      expect(renamed.spaces.find((s) => s.id === space.id)?.name).toBe('Renamed');
      const { manifest, active } = await spaces.delete(space.id);
      expect(manifest.spaces.map((s) => s.id)).not.toContain(space.id);
      expect(active.id).toBe('default');
      expect(app.readText('.cept/spaces.json')).toBe(before);
    });

    it('saving a manifest that lists one does not persist it', async () => {
      const { space, manifest } = await spaces.create('Demo', undefined, {
        kind: 'memory',
        backend: new MemoryBackend(),
      });
      await spaces.save(manifest);
      const stored = JSON.parse(app.readText('.cept/spaces.json') ?? '{}') as {
        activeSpaceId: string;
        spaces: { id: string }[];
      };
      expect(stored.spaces.map((s) => s.id)).not.toContain(space.id);
      expect(stored.activeSpaceId).toBe('default');
    });

    it('creating one with a fixed id replaces the earlier one and its data', async () => {
      const first = new MemoryBackend();
      await spaces.create('Demo', undefined, { kind: 'memory', backend: first, id: 'demo' });
      await spaces.writePage('demo', 'p', 'edited');
      const { manifest } = await spaces.create('Demo', undefined, {
        kind: 'memory',
        backend: new MemoryBackend(),
        id: 'demo',
      });
      expect(manifest.spaces.filter((s) => s.id === 'demo')).toHaveLength(1);
      expect(await spaces.readPage('demo', 'p')).toBeNull();
    });
  });
});
