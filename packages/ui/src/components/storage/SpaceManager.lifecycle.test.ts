/**
 * Space lifecycle (REQ-WS-024): stats for spaces that are not open, renaming
 * through `space.cept.yaml`, and removing the last and the default space.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageBackend } from '@cept/core';
import { MemoryBackend } from './test-helpers.js';
import { SpaceManager } from './SpaceManager.js';
import type { SpaceSnapshot } from './SpaceManager.js';

const bytes = (text: string) => new TextEncoder().encode(text).length;

function snapshot(name: string, ids: string[]): SpaceSnapshot {
  return {
    pages: ids.map((id) => ({ id, title: id, children: [] })),
    favorites: [],
    recentPages: [],
    spaceName: name,
  };
}

/** `inner` with every write and delete recorded. */
function writeSpy(inner: StorageBackend) {
  const writes: string[] = [];
  const backend = new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown;
      if (prop === 'writeFile' || prop === 'deleteFile') {
        return (path: string, ...rest: unknown[]) => {
          writes.push(`${String(prop)} ${path}`);
          return (value as (...a: unknown[]) => unknown).call(target, path, ...rest);
        };
      }
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
  return { backend, writes };
}

function notesFolder() {
  const folder = new MemoryBackend();
  folder.seedText('space.cept.yaml', '# mine\nversion: 1\nname: Notes\nslug: notes\n');
  folder.seedText('Welcome.md', '# Welcome\n');
  folder.seedText('Guides/Setup.md', '# Setup\n\nSteps.\n');
  return folder;
}

describe('SpaceManager lifecycle (REQ-WS-024)', () => {
  let backend: MemoryBackend;
  let spaces: SpaceManager;

  beforeEach(() => {
    backend = new MemoryBackend();
    spaces = new SpaceManager(backend);
  });

  describe('inspect', () => {
    it('counts the pages and bytes of a folder-layout space that is not open', async () => {
      const { space } = await spaces.create('Work');
      await spaces.addPage(space.id, undefined, 'Plan', '# Plan\n\nShip it.\n');
      await spaces.create('Other');

      const fresh = new SpaceManager(backend);
      const stats = await fresh.inspect(space.id);
      expect(stats).toEqual({
        pageCount: 1,
        contentSize: bytes('# Plan\n\nShip it.\n'),
        slug: 'work',
      });
    });

    it('counts a folder space by its files and reads its slug', async () => {
      const folder = notesFolder();
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      const stats = await spaces.inspect(space.id);
      // Guides is a folder page holding Setup.
      expect(stats).toEqual({
        pageCount: 3,
        contentSize: bytes('# Welcome\n') + bytes('# Setup\n\nSteps.\n'),
        slug: 'notes',
      });
    });

    it('counts a flat space from its saved state and page files', async () => {
      spaces.bind('own', new MemoryBackend());
      await spaces.saveState('own', snapshot('Own', ['a', 'b']), { a: '# A', b: '# Bee' });
      expect(await spaces.inspect('own')).toEqual({
        pageCount: 2,
        contentSize: bytes('# A') + bytes('# Bee'),
      });
    });

    it('knows nothing about a folder space whose folder is not connected', async () => {
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: notesFolder(),
      });
      const after = new SpaceManager(backend);
      await after.load();
      expect(await after.inspect(space.id)).toBeNull();
    });

    it('writes nothing, not even to a flat space it would convert on open', async () => {
      const { backend: spied, writes } = writeSpy(backend);
      backend.seedText(
        '.cept/spaces/space-1/workspace-state.json',
        JSON.stringify(snapshot('Flat', ['x'])),
      );
      backend.seedText('.cept/spaces/space-1/pages/x.md', '# X');
      backend.seedText(
        '.cept/spaces.json',
        JSON.stringify({
          activeSpaceId: 'default',
          spaces: [
            { id: 'default', name: 'My Space', createdAt: '2026-01-01T00:00:00Z' },
            { id: 'space-1', name: 'Flat', createdAt: '2026-01-01T00:00:00Z' },
          ],
        }),
      );
      const watched = new SpaceManager(spied);
      await watched.load();
      expect(await watched.inspect('space-1')).toEqual({ pageCount: 1, contentSize: bytes('# X') });
      expect(writes).toEqual([]);
    });
  });

  describe('rename', () => {
    it("edits the name in a folder-layout space's marker and keeps its slug and comments", async () => {
      const folder = notesFolder();
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      const manifest = await spaces.rename(space.id, 'Lab notes');
      expect(manifest.spaces.find((s) => s.id === space.id)?.name).toBe('Lab notes');
      expect(folder.readText('space.cept.yaml')).toBe(
        '# mine\nversion: 1\nname: Lab notes\nslug: notes\n',
      );
    });

    it('changes the slug only when asked', async () => {
      const folder = notesFolder();
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      await spaces.rename(space.id, 'Notes', 'lab');
      expect(folder.readText('space.cept.yaml')).toContain('slug: lab');
      expect((await spaces.inspect(space.id))?.slug).toBe('lab');
    });

    it('refuses an invalid slug and leaves the name and the marker alone', async () => {
      const folder = notesFolder();
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      await expect(spaces.rename(space.id, 'Other', 'Not A Slug')).rejects.toThrow(/slug/);
      expect((await spaces.load()).spaces.find((s) => s.id === space.id)?.name).toBe('Notes');
      expect(folder.readText('space.cept.yaml')).toContain('name: Notes');
    });

    it('refuses to rename a space whose marker Cept cannot read', async () => {
      const folder = notesFolder();
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      folder.seedText('space.cept.yaml', 'name: [unclosed');
      await expect(spaces.rename(space.id, 'Other')).rejects.toThrow(/space\.cept\.yaml/);
      expect((await spaces.load()).spaces.find((s) => s.id === space.id)?.name).toBe('Notes');
    });

    it('refuses to rename a folder space whose folder is not connected', async () => {
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: notesFolder(),
      });
      const after = new SpaceManager(backend);
      await expect(after.rename(space.id, 'Other')).rejects.toThrow(/Reconnect/);
      expect((await after.load()).spaces.find((s) => s.id === space.id)?.name).toBe('Notes');
    });

    it('edits the marker of a new app space', async () => {
      const { space } = await spaces.create('Work');
      await spaces.rename(space.id, 'Office');
      expect(backend.readText(`.cept/spaces/${space.id}/space.cept.yaml`)).toContain(
        'name: Office',
      );
    });
  });

  describe('delete', () => {
    it('removing the last space leaves a new, empty default space', async () => {
      const { space } = await spaces.create('Work');
      await spaces.delete('default');
      const { manifest, active } = await spaces.delete(space.id);
      expect(manifest.spaces).toHaveLength(1);
      expect(active).toMatchObject({ id: 'default', name: 'My Space' });
      expect(manifest.activeSpaceId).toBe('default');
    });

    it('deleting the default space removes its pages and state, and nothing else', async () => {
      await spaces.open('default', 'My Space');
      await spaces.startFolder('default', 'My Space');
      await spaces.addPage('default', undefined, 'Home', '# Home');
      await spaces.saveState('default', snapshot('My Space', ['Home.md']));
      backend.seedText('.cept/settings.json', '{}');
      const { space: work } = await spaces.create('Work');
      await spaces.addPage(work.id, undefined, 'Plan', '# Plan');

      await spaces.delete('default');
      expect(backend.hasFile('space.cept.yaml')).toBe(false);
      expect(backend.hasFile('Home.md')).toBe(false);
      expect(backend.hasFile('.cept/workspace-state.json')).toBe(false);
      expect(backend.hasFile('.cept/settings.json')).toBe(true);
      expect(await spaces.readPage(work.id, 'Plan.md')).toBe('# Plan');

      // A later default space starts empty instead of finding the old pages.
      await spaces.delete(work.id);
      const reopened = await new SpaceManager(backend).open('default', 'My Space');
      expect(reopened.snapshot?.pages ?? []).toEqual([]);
    });

    it('removing a folder space writes nothing to its folder', async () => {
      const { backend: folder, writes } = writeSpy(notesFolder());
      const { space } = await spaces.create('Notes', undefined, {
        kind: 'folder',
        backend: folder,
      });
      await spaces.open(space.id, 'Notes');
      await spaces.delete(space.id);
      expect(writes).toEqual([]);
    });
  });
});
