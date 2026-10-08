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
});
