import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBackend } from './test-helpers.js';
import {
  loadSpaces,
  createSpace,
  createRemoteSpace,
  switchSpace,
  deleteSpace,
  renameSpace,
  updateSpaceSyncTimestamp,
  spaceWorkspaceFile,
  spacePagesDir,
  generateRemoteSpaceId,
  parseRemoteSpaceId,
  resolveRouteToSpace,
} from './SpaceManager.js';
import type { SpacesManifest } from './SpaceManager.js';

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

  describe('createRemoteSpace', () => {
    it('creates a remote space with repo-path-based ID', async () => {
      const space = await createRemoteSpace(backend, 'Docs', 'https://github.com/user/repo', 'main', 'docs/');
      expect(space.id).toBe('github.com/user/repo@main::docs');
      expect(space.remoteUrl).toBe('https://github.com/user/repo');
      expect(space.branch).toBe('main');
      expect(space.subPath).toBe('docs/');
      expect(space.readOnly).toBe(true);
      expect(space.lastSyncedAt).toBeDefined();
    });

    it('replaces existing space with same ID on re-clone', async () => {
      await createRemoteSpace(backend, 'Docs v1', 'https://github.com/user/repo', 'main');
      const space2 = await createRemoteSpace(backend, 'Docs v2', 'https://github.com/user/repo', 'main');
      const manifest = await loadSpaces(backend);
      const matching = manifest.spaces.filter((s) => s.id === space2.id);
      expect(matching.length).toBe(1);
      expect(matching[0].name).toBe('Docs v2');
    });
  });

  describe('generateRemoteSpaceId', () => {
    it('generates ID from URL and branch', () => {
      expect(generateRemoteSpaceId('https://github.com/nsheaps/cept', 'main')).toBe('github.com/nsheaps/cept@main');
    });

    it('generates ID with subpath using :: separator', () => {
      expect(generateRemoteSpaceId('https://github.com/nsheaps/cept', 'main', 'docs/')).toBe('github.com/nsheaps/cept@main::docs');
    });

    it('strips .git suffix', () => {
      expect(generateRemoteSpaceId('https://github.com/nsheaps/cept.git', 'main')).toBe('github.com/nsheaps/cept@main');
    });

    it('handles URL without protocol', () => {
      expect(generateRemoteSpaceId('github.com/nsheaps/cept', 'main')).toBe('github.com/nsheaps/cept@main');
    });

    it('handles branch names with / in them', () => {
      expect(generateRemoteSpaceId('https://github.com/nsheaps/cept', 'claude/setup-fix')).toBe('github.com/nsheaps/cept@claude/setup-fix');
    });

    it('handles branch with / and subpath', () => {
      expect(generateRemoteSpaceId('https://github.com/nsheaps/cept', 'claude/fix', 'docs/')).toBe('github.com/nsheaps/cept@claude/fix::docs');
    });
  });

  describe('parseRemoteSpaceId', () => {
    it('parses ID without subpath', () => {
      expect(parseRemoteSpaceId('github.com/nsheaps/cept@main')).toEqual({
        repo: 'github.com/nsheaps/cept',
        branch: 'main',
      });
    });

    it('parses ID with :: subpath separator', () => {
      expect(parseRemoteSpaceId('github.com/nsheaps/cept@main::docs')).toEqual({
        repo: 'github.com/nsheaps/cept',
        branch: 'main',
        subPath: 'docs',
      });
    });

    it('parses branch with / correctly when using :: separator', () => {
      expect(parseRemoteSpaceId('github.com/nsheaps/cept@claude/setup-fix::docs')).toEqual({
        repo: 'github.com/nsheaps/cept',
        branch: 'claude/setup-fix',
        subPath: 'docs',
      });
    });

    it('parses legacy ID with / subpath separator (backward compat)', () => {
      expect(parseRemoteSpaceId('github.com/nsheaps/cept@main/docs')).toEqual({
        repo: 'github.com/nsheaps/cept',
        branch: 'main',
        subPath: 'docs',
      });
    });

    it('returns null for non-remote IDs', () => {
      expect(parseRemoteSpaceId('default')).toBeNull();
      expect(parseRemoteSpaceId('space-1234567890')).toBeNull();
    });
  });

  describe('updateSpaceSyncTimestamp', () => {
    it('updates the lastSyncedAt timestamp', async () => {
      const space = await createRemoteSpace(backend, 'Docs', 'https://github.com/user/repo', 'main');
      const originalTimestamp = space.lastSyncedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));
      await updateSpaceSyncTimestamp(backend, space.id);

      const manifest = await loadSpaces(backend);
      const updated = manifest.spaces.find((s) => s.id === space.id);
      expect(updated?.lastSyncedAt).toBeDefined();
      expect(updated?.lastSyncedAt).not.toBe(originalTimestamp);
    });

    it('throws for non-existent space', async () => {
      await expect(updateSpaceSyncTimestamp(backend, 'nope')).rejects.toThrow('Space not found');
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

  describe('resolveRouteToSpace', () => {
    const testManifest: SpacesManifest = {
      activeSpaceId: 'default',
      spaces: [
        { id: 'default', name: 'Default', createdAt: '2024-01-01' },
        { id: 'github.com/nsheaps/cept@main::docs', name: 'Cept Docs', createdAt: '2024-01-01', branch: 'main', subPath: 'docs' },
        { id: 'github.com/nsheaps/cept@main', name: 'Cept Root', createdAt: '2024-01-01', branch: 'main' },
        { id: 'github.com/other/repo@dev', name: 'Other Repo', createdAt: '2024-01-01', branch: 'dev' },
        { id: 'github.com/nsheaps/cept@claude/setup-fix::docs', name: 'Feature Branch', createdAt: '2024-01-01', branch: 'claude/setup-fix', subPath: 'docs' },
      ],
    };

    it('returns exact match for local spaces', () => {
      const result = resolveRouteToSpace(testManifest, 'default', undefined);
      expect(result).toEqual({ spaceId: 'default', pageId: undefined });
    });

    it('returns exact match when spaceId matches directly with :: separator', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@main::docs', 'getting-started.md');
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@main::docs', pageId: 'getting-started.md' });
    });

    it('resolves minimal spaceId to space with matching subPath', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@main', 'docs/getting-started.md');
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@main::docs', pageId: 'getting-started.md' });
    });

    it('resolves nested file path with subPath prefix', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@main', 'docs/guides/quick-start.md');
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@main::docs', pageId: 'guides/quick-start.md' });
    });

    it('falls back to space without subPath when file path does not match subPath', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@main', 'README.md');
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@main', pageId: 'README.md' });
    });

    it('returns original values when no matching space is found', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/unknown/repo@main', 'file.md');
      expect(result).toEqual({ spaceId: 'github.com/unknown/repo@main', pageId: 'file.md' });
    });

    it('handles undefined pageId with exact match', () => {
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@main', undefined);
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@main', pageId: undefined });
    });

    it('resolves multi-segment branch names (branch with /)', () => {
      // The router parses the first segment as branch, so branch="claude" and
      // pageId="setup-fix/docs/getting-started.md". The resolver should match
      // the space with branch "claude/setup-fix".
      const result = resolveRouteToSpace(testManifest, 'github.com/nsheaps/cept@claude', 'setup-fix/docs/getting-started.md');
      expect(result).toEqual({ spaceId: 'github.com/nsheaps/cept@claude/setup-fix::docs', pageId: 'getting-started.md' });
    });
  });
});
