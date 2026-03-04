import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import {
  loadSpaces,
  createSpace,
  switchSpace,
  deleteSpace,
  renameSpace,
  spaceWorkspaceFile,
  spacePagesDir,
} from './SpaceManager.js';

describe('SpaceManager', () => {
  let backend: MemoryBackend;

  beforeEach(() => {
    backend = new MemoryBackend();
  });

  describe('loadSpaces', () => {
    it('creates default manifest if none exists', async () => {
      const manifest = await loadSpaces(backend);
      expect(manifest.spaces.length).toBe(1);
      expect(manifest.spaces[0].id).toBe('default');
      expect(manifest.spaces[0].name).toBe('My Space');
      expect(manifest.activeSpaceId).toBe('default');

      // Should be persisted
      expect(backend.hasFile('.cept/spaces.json')).toBe(true);
    });

    it('loads existing manifest', async () => {
      backend.seedFile('.cept/spaces.json', {
        activeSpaceId: 's1',
        spaces: [
          { id: 's1', name: 'Space 1', createdAt: '2026-01-01' },
          { id: 's2', name: 'Space 2', createdAt: '2026-01-02' },
        ],
      });
      const manifest = await loadSpaces(backend);
      expect(manifest.spaces.length).toBe(2);
      expect(manifest.activeSpaceId).toBe('s1');
    });
  });

  describe('createSpace', () => {
    it('creates a new space and sets it active', async () => {
      const space = await createSpace(backend, 'Work Notes');
      expect(space.name).toBe('Work Notes');
      expect(space.id).toMatch(/^space-/);

      const manifest = await loadSpaces(backend);
      expect(manifest.spaces.length).toBe(2);
      expect(manifest.activeSpaceId).toBe(space.id);
    });

    it('creates space with icon', async () => {
      const space = await createSpace(backend, 'Projects', '\u{1F4CB}');
      expect(space.icon).toBe('\u{1F4CB}');
    });
  });

  describe('switchSpace', () => {
    it('changes the active space', async () => {
      const space = await createSpace(backend, 'Other');
      await switchSpace(backend, 'default');
      const manifest = await loadSpaces(backend);
      expect(manifest.activeSpaceId).toBe('default');

      await switchSpace(backend, space.id);
      const manifest2 = await loadSpaces(backend);
      expect(manifest2.activeSpaceId).toBe(space.id);
    });

    it('throws for non-existent space', async () => {
      await expect(switchSpace(backend, 'nope')).rejects.toThrow('Space not found');
    });
  });

  describe('deleteSpace', () => {
    it('deletes a space', async () => {
      const space = await createSpace(backend, 'To Delete');
      await switchSpace(backend, 'default');
      await deleteSpace(backend, space.id);
      const manifest = await loadSpaces(backend);
      expect(manifest.spaces.length).toBe(1);
      expect(manifest.spaces[0].id).toBe('default');
    });

    it('switches active if deleted space was active', async () => {
      const space = await createSpace(backend, 'Active Delete');
      // space is now active
      await deleteSpace(backend, space.id);
      const manifest = await loadSpaces(backend);
      expect(manifest.activeSpaceId).toBe('default');
    });

    it('throws when trying to delete the last space', async () => {
      await expect(deleteSpace(backend, 'default')).rejects.toThrow('Cannot delete the last space');
    });
  });

  describe('renameSpace', () => {
    it('renames a space', async () => {
      await renameSpace(backend, 'default', 'My Renamed Space');
      const manifest = await loadSpaces(backend);
      expect(manifest.spaces[0].name).toBe('My Renamed Space');
    });

    it('throws for non-existent space', async () => {
      await expect(renameSpace(backend, 'nope', 'x')).rejects.toThrow('Space not found');
    });
  });

  describe('path helpers', () => {
    it('default space uses root paths', () => {
      expect(spaceWorkspaceFile('default')).toBe('.cept/workspace-state.json');
      expect(spacePagesDir('default')).toBe('pages');
    });

    it('non-default spaces use nested paths', () => {
      expect(spaceWorkspaceFile('space-123')).toBe('.cept/spaces/space-123/workspace-state.json');
      expect(spacePagesDir('space-123')).toBe('.cept/spaces/space-123/pages');
    });
  });
});
