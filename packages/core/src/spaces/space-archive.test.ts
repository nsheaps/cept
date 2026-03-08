import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  StorageBackend,
  BackendCapabilities,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
  WorkspaceConfig,
} from '../storage/backend.js';
import type { ArchiveZipEntry, ArchiveZipReader, ArchiveManifest } from './space-archive.js';
import {
  exportSpace,
  importSpace,
  previewImportConflicts,
  generateRenamedPath,
  sha256Hex,
} from './space-archive.js';

// ─── Test Helpers ──────────────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * In-memory StorageBackend that supports listDirectory properly.
 * Files are stored with normalized paths (leading / stripped).
 */
class MockBackend implements StorageBackend {
  readonly type = 'browser' as const;
  readonly capabilities: BackendCapabilities = {
    history: false,
    collaboration: false,
    sync: false,
    branching: false,
    externalEditing: false,
    watchForExternalChanges: false,
  };

  private files = new Map<string, Uint8Array>();

  private norm(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  async readFile(path: string): Promise<Uint8Array | null> {
    return this.files.get(this.norm(path)) ?? null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(this.norm(path), data);
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.norm(path);
    for (const key of [...this.files.keys()]) {
      if (key === normalized || key.startsWith(normalized + '/')) {
        this.files.delete(key);
      }
    }
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    const dir = this.norm(path);
    const prefix = dir ? dir + '/' : '';
    const seen = new Set<string>();
    const entries: DirEntry[] = [];

    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const parts = rest.split('/');
      const name = parts[0];
      if (seen.has(name)) continue;
      seen.add(name);

      if (parts.length === 1) {
        entries.push({ name, isDirectory: false, isFile: true });
      } else {
        entries.push({ name, isDirectory: true, isFile: false });
      }
    }

    return entries;
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.norm(path);
    if (this.files.has(normalized)) return true;
    // Check if it's a directory (any file starts with this prefix)
    for (const key of this.files.keys()) {
      if (key.startsWith(normalized + '/')) return true;
    }
    return false;
  }

  watch(_path: string, _callback: (event: FsEvent) => void): Unsubscribe {
    return () => {};
  }

  async stat(path: string): Promise<FileStat | null> {
    const data = this.files.get(this.norm(path));
    if (!data) return null;
    const now = new Date();
    return { size: data.length, isDirectory: false, isFile: true, modifiedAt: now, createdAt: now };
  }

  async initialize(_config: WorkspaceConfig): Promise<void> {}
  async close(): Promise<void> {}

  // Test helpers
  seed(path: string, content: string): void {
    this.files.set(this.norm(path), encoder.encode(content));
  }

  seedBytes(path: string, data: Uint8Array): void {
    this.files.set(this.norm(path), data);
  }

  seedJson(path: string, value: unknown): void {
    this.seed(path, JSON.stringify(value));
  }

  getText(path: string): string | null {
    const data = this.files.get(this.norm(path));
    return data ? decoder.decode(data) : null;
  }

  getJson<T>(path: string): T | null {
    const text = this.getText(path);
    return text ? (JSON.parse(text) as T) : null;
  }

  getAllPaths(): string[] {
    return [...this.files.keys()].sort();
  }
}

/**
 * Create a mock ArchiveZipReader from a map of path -> content.
 */
function createMockZipReader(files: Record<string, string | Uint8Array>): ArchiveZipReader {
  const entries: ArchiveZipEntry[] = Object.entries(files).map(([path, content]) => ({
    path,
    isDirectory: false,
    getData: async () => typeof content === 'string' ? encoder.encode(content) : content,
  }));

  return {
    getEntries: async () => entries,
    close: async () => {},
  };
}

/**
 * Create a valid manifest for testing.
 */
function createManifest(
  overrides: Partial<ArchiveManifest> = {},
  files: Array<{ path: string; size: number; sha256?: string }> = [],
): ArchiveManifest {
  return {
    version: 1,
    exportedAt: '2026-03-08T00:00:00.000Z',
    space: { id: 'space-test', name: 'Test Space', ...overrides.space },
    files: files.map((f) => ({ path: f.path, size: f.size, sha256: f.sha256 ?? 'abc123' })),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('generateRenamedPath', () => {
  it('appends (imported) to simple filename', () => {
    expect(generateRenamedPath('pages/note.md')).toBe('pages/note (imported).md');
  });

  it('appends (imported) to filename without directory', () => {
    expect(generateRenamedPath('note.md')).toBe('note (imported).md');
  });

  it('increments (imported) to (imported 2)', () => {
    expect(generateRenamedPath('pages/note (imported).md')).toBe('pages/note (imported 2).md');
  });

  it('increments (imported 2) to (imported 3)', () => {
    expect(generateRenamedPath('pages/note (imported 2).md')).toBe('pages/note (imported 3).md');
  });

  it('handles files without extension', () => {
    expect(generateRenamedPath('Makefile')).toBe('Makefile (imported)');
  });

  it('handles deep path', () => {
    expect(generateRenamedPath('a/b/c/file.txt')).toBe('a/b/c/file (imported).txt');
  });

  it('handles dotfiles', () => {
    expect(generateRenamedPath('.gitignore')).toBe('.gitignore (imported)');
  });
});

describe('sha256Hex', () => {
  it('returns a hex string', async () => {
    const data = encoder.encode('hello');
    const hash = await sha256Hex(data);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('returns different hashes for different data', async () => {
    const h1 = await sha256Hex(encoder.encode('hello'));
    const h2 = await sha256Hex(encoder.encode('world'));
    expect(h1).not.toBe(h2);
  });

  it('returns same hash for same data', async () => {
    const data = encoder.encode('consistent');
    const h1 = await sha256Hex(data);
    const h2 = await sha256Hex(data);
    expect(h1).toBe(h2);
  });

  it('handles empty data', async () => {
    const hash = await sha256Hex(new Uint8Array(0));
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Export Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('exportSpace', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  describe('default space', () => {
    it('exports workspace-state.json', async () => {
      backend.seedJson('.cept/workspace-state.json', { pages: [], favorites: [] });
      const result = await exportSpace(backend, 'default', 'My Space', undefined);

      expect(result.errors).toHaveLength(0);
      const manifestFile = result.files.find((f) => f.archivePath === 'manifest.json');
      expect(manifestFile).toBeDefined();

      const wsFile = result.files.find((f) => f.archivePath === 'workspace-state.json');
      expect(wsFile).toBeDefined();
    });

    it('exports pages directory', async () => {
      backend.seed('pages/page1.md', '# Page 1');
      backend.seed('pages/page2.md', '# Page 2');
      backend.seedJson('.cept/workspace-state.json', { pages: [] });

      const result = await exportSpace(backend, 'default', 'My Space', undefined);
      expect(result.errors).toHaveLength(0);

      const pageFiles = result.files.filter((f) => f.archivePath.startsWith('pages/'));
      expect(pageFiles).toHaveLength(2);
      expect(pageFiles.map((f) => f.archivePath).sort()).toEqual([
        'pages/page1.md',
        'pages/page2.md',
      ]);
    });

    it('exports nested page directories', async () => {
      backend.seed('pages/parent/child.md', '# Child');
      backend.seed('pages/deep/nested/page.md', '# Deep');

      const result = await exportSpace(backend, 'default', 'My Space', undefined);
      const pageFiles = result.files.filter((f) => f.archivePath.startsWith('pages/'));
      expect(pageFiles).toHaveLength(2);
    });

    it('exports databases when includeDatabases is true', async () => {
      backend.seed('.cept/databases/tasks.yaml', 'name: Tasks');

      const result = await exportSpace(backend, 'default', 'My Space', undefined, {
        includeDatabases: true,
      });
      const dbFile = result.files.find((f) => f.archivePath === 'databases/tasks.yaml');
      expect(dbFile).toBeDefined();
    });

    it('skips databases when includeDatabases is false', async () => {
      backend.seed('.cept/databases/tasks.yaml', 'name: Tasks');

      const result = await exportSpace(backend, 'default', 'My Space', undefined, {
        includeDatabases: false,
      });
      const dbFile = result.files.find((f) => f.archivePath === 'databases/tasks.yaml');
      expect(dbFile).toBeUndefined();
    });

    it('exports assets when includeAssets is true', async () => {
      backend.seedBytes('assets/image.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

      const result = await exportSpace(backend, 'default', 'My Space', undefined, {
        includeAssets: true,
      });
      const assetFile = result.files.find((f) => f.archivePath === 'assets/image.png');
      expect(assetFile).toBeDefined();
    });

    it('skips assets when includeAssets is false', async () => {
      backend.seedBytes('assets/image.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

      const result = await exportSpace(backend, 'default', 'My Space', undefined, {
        includeAssets: false,
      });
      const assetFile = result.files.find((f) => f.archivePath === 'assets/image.png');
      expect(assetFile).toBeUndefined();
    });
  });

  describe('non-default space', () => {
    it('exports from space-specific directory', async () => {
      const sid = 'space-abc';
      backend.seedJson(`.cept/spaces/${sid}/workspace-state.json`, { pages: [] });
      backend.seed(`.cept/spaces/${sid}/pages/note.md`, '# Note');

      const result = await exportSpace(backend, sid, 'Work', undefined);
      expect(result.errors).toHaveLength(0);

      const wsFile = result.files.find((f) => f.archivePath === 'workspace-state.json');
      expect(wsFile).toBeDefined();

      const pageFile = result.files.find((f) => f.archivePath === 'pages/note.md');
      expect(pageFile).toBeDefined();
    });
  });

  describe('manifest', () => {
    it('includes correct version', async () => {
      backend.seed('pages/p.md', 'content');
      const result = await exportSpace(backend, 'default', 'Test', undefined);
      expect(result.manifest.version).toBe(1);
    });

    it('includes space metadata', async () => {
      backend.seed('pages/p.md', 'content');
      const result = await exportSpace(backend, 'default', 'My Notes', '\u{1F4D3}');
      expect(result.manifest.space).toEqual({
        id: 'default',
        name: 'My Notes',
        icon: '\u{1F4D3}',
      });
    });

    it('includes exportedAt timestamp', async () => {
      backend.seed('pages/p.md', 'content');
      const result = await exportSpace(backend, 'default', 'Test', undefined);
      expect(result.manifest.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('lists all files with size and sha256', async () => {
      const content = '# Hello';
      backend.seed('pages/hello.md', content);

      const result = await exportSpace(backend, 'default', 'Test', undefined);
      const entry = result.manifest.files.find((f) => f.path === 'pages/hello.md');
      expect(entry).toBeDefined();
      expect(entry!.size).toBe(encoder.encode(content).length);
      expect(entry!.sha256).toMatch(/^[0-9a-f]+$/);
    });

    it('manifest.json is the first file in the result', async () => {
      backend.seed('pages/p.md', 'content');
      const result = await exportSpace(backend, 'default', 'Test', undefined);
      expect(result.files[0].archivePath).toBe('manifest.json');
    });
  });

  describe('progress callback', () => {
    it('fires progress events', async () => {
      backend.seed('pages/a.md', 'a');
      backend.seed('pages/b.md', 'b');

      const progress: Array<{ phase: string; currentFile: string }> = [];
      await exportSpace(backend, 'default', 'Test', undefined, {
        onProgress: (p) => progress.push({ phase: p.phase, currentFile: p.currentFile }),
      });

      expect(progress.some((p) => p.phase === 'scanning')).toBe(true);
      expect(progress.some((p) => p.phase === 'reading')).toBe(true);
      expect(progress.some((p) => p.phase === 'packaging')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('captures read errors without crashing', async () => {
      backend.seed('pages/good.md', 'good');
      // Simulate a file that exists but fails to read
      const origRead = backend.readFile.bind(backend);
      vi.spyOn(backend, 'readFile').mockImplementation(async (path: string) => {
        if (path.includes('bad.md')) throw new Error('disk error');
        return origRead(path);
      });
      backend.seed('pages/bad.md', 'bad');

      const result = await exportSpace(backend, 'default', 'Test', undefined);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].message).toBe('disk error');
    });

    it('handles empty space gracefully', async () => {
      const result = await exportSpace(backend, 'default', 'Empty', undefined);
      expect(result.errors).toHaveLength(0);
      // Should still have manifest.json
      expect(result.files).toHaveLength(1);
      expect(result.files[0].archivePath).toBe('manifest.json');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Import Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('importSpace', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  function makeArchiveFiles(
    manifest: ArchiveManifest,
    fileContents: Record<string, string>,
  ): Record<string, string> {
    return {
      'manifest.json': JSON.stringify(manifest),
      ...fileContents,
    };
  }

  describe('basic import into new space', () => {
    it('imports all files from archive', async () => {
      const manifest = createManifest({}, [
        { path: 'workspace-state.json', size: 10 },
        { path: 'pages/note.md', size: 6 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'workspace-state.json': '{"pages":[]}',
          'pages/note.md': '# Note',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'space-new',
      });

      expect(result.errors).toHaveLength(0);
      expect(result.spaceId).toBe('space-new');
      expect(result.imported).toContain('workspace-state.json');
      expect(result.imported).toContain('pages/note.md');

      // Verify files were written to correct paths
      expect(backend.getText('.cept/spaces/space-new/workspace-state.json')).toBe('{"pages":[]}');
      expect(backend.getText('.cept/spaces/space-new/pages/note.md')).toBe('# Note');
    });

    it('generates a space ID when none provided', async () => {
      const manifest = createManifest({}, [
        { path: 'pages/p.md', size: 1 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, { 'pages/p.md': 'x' }),
      );

      const result = await importSpace(backend, zipReader);
      expect(result.spaceId).toMatch(/^space-\d+$/);
    });
  });

  describe('import into default space', () => {
    it('writes files to root paths', async () => {
      const manifest = createManifest({}, [
        { path: 'workspace-state.json', size: 10 },
        { path: 'pages/note.md', size: 6 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'workspace-state.json': '{"pages":[]}',
          'pages/note.md': '# Note',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.errors).toHaveLength(0);
      expect(backend.getText('.cept/workspace-state.json')).toBe('{"pages":[]}');
      expect(backend.getText('pages/note.md')).toBe('# Note');
    });
  });

  describe('import databases', () => {
    it('imports database YAML files', async () => {
      const manifest = createManifest({}, [
        { path: 'databases/tasks.yaml', size: 12 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'databases/tasks.yaml': 'name: Tasks',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.imported).toContain('databases/tasks.yaml');
      expect(backend.getText('.cept/databases/tasks.yaml')).toBe('name: Tasks');
    });
  });

  describe('conflict detection', () => {
    it('detects existing files as conflicts', async () => {
      backend.seed('pages/existing.md', '# Old content');

      const manifest = createManifest({}, [
        { path: 'pages/existing.md', size: 11 },
        { path: 'pages/new.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/existing.md': '# New stuff',
          'pages/new.md': '# New',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].archivePath).toBe('pages/existing.md');
    });
  });

  describe('conflict strategy: skip (default)', () => {
    it('skips conflicting files', async () => {
      backend.seed('pages/existing.md', '# Old');

      const manifest = createManifest({}, [
        { path: 'pages/existing.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/existing.md': '# New',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'skip',
      });

      expect(result.skipped).toContain('pages/existing.md');
      expect(backend.getText('pages/existing.md')).toBe('# Old');
    });
  });

  describe('conflict strategy: keep', () => {
    it('keeps existing file', async () => {
      backend.seed('pages/existing.md', '# Keep me');

      const manifest = createManifest({}, [
        { path: 'pages/existing.md', size: 10 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/existing.md': '# Replace',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'keep',
      });

      expect(result.skipped).toContain('pages/existing.md');
      expect(backend.getText('pages/existing.md')).toBe('# Keep me');
    });
  });

  describe('conflict strategy: replace', () => {
    it('overwrites existing file', async () => {
      backend.seed('pages/existing.md', '# Old');

      const manifest = createManifest({}, [
        { path: 'pages/existing.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/existing.md': '# New',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'replace',
      });

      expect(result.replaced).toContain('pages/existing.md');
      expect(result.imported).toContain('pages/existing.md');
      expect(backend.getText('pages/existing.md')).toBe('# New');
    });
  });

  describe('conflict strategy: rename', () => {
    it('renames incoming file to avoid conflict', async () => {
      backend.seed('pages/note.md', '# Existing');

      const manifest = createManifest({}, [
        { path: 'pages/note.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/note.md': '# New',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'rename',
      });

      expect(result.renamed).toHaveLength(1);
      expect(result.renamed[0].original).toBe('pages/note.md');
      expect(result.renamed[0].renamed).toContain('imported');
      // Original should be untouched
      expect(backend.getText('pages/note.md')).toBe('# Existing');
      // Renamed file should exist
      expect(backend.getText('pages/note (imported).md')).toBe('# New');
    });

    it('increments suffix when renamed path also conflicts', async () => {
      backend.seed('pages/note.md', '# V1');
      backend.seed('pages/note (imported).md', '# V2');

      const manifest = createManifest({}, [
        { path: 'pages/note.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/note.md': '# V3',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'rename',
      });

      expect(result.renamed[0].renamed).toContain('imported 2');
      expect(backend.getText('pages/note (imported 2).md')).toBe('# V3');
    });
  });

  describe('per-file conflict overrides', () => {
    it('uses per-file override instead of default strategy', async () => {
      backend.seed('pages/keep-me.md', '# Keep');
      backend.seed('pages/replace-me.md', '# Old');

      const manifest = createManifest({}, [
        { path: 'pages/keep-me.md', size: 5 },
        { path: 'pages/replace-me.md', size: 5 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/keep-me.md': '# New Keep',
          'pages/replace-me.md': '# New Replace',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        conflictStrategy: 'skip',
        fileConflictOverrides: {
          'pages/replace-me.md': 'replace',
        },
      });

      expect(result.skipped).toContain('pages/keep-me.md');
      expect(result.replaced).toContain('pages/replace-me.md');
      expect(backend.getText('pages/keep-me.md')).toBe('# Keep');
      expect(backend.getText('pages/replace-me.md')).toBe('# New Replace');
    });
  });

  describe('workspace-state import control', () => {
    it('skips workspace-state.json when importWorkspaceState is false', async () => {
      const manifest = createManifest({}, [
        { path: 'workspace-state.json', size: 10 },
        { path: 'pages/note.md', size: 6 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'workspace-state.json': '{"pages":[]}',
          'pages/note.md': '# Note',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        importWorkspaceState: false,
      });

      expect(result.skipped).toContain('workspace-state.json');
      expect(result.imported).toContain('pages/note.md');
      expect(backend.getText('.cept/workspace-state.json')).toBeNull();
    });

    it('imports workspace-state.json by default', async () => {
      const manifest = createManifest({}, [
        { path: 'workspace-state.json', size: 10 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'workspace-state.json': '{"pages":[]}',
        }),
      );

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.imported).toContain('workspace-state.json');
    });
  });

  describe('error handling', () => {
    it('returns error when ZIP cannot be read', async () => {
      const zipReader: ArchiveZipReader = {
        getEntries: async () => { throw new Error('corrupt zip'); },
        close: async () => {},
      };

      const result = await importSpace(backend, zipReader);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('corrupt zip');
    });

    it('returns error when manifest.json is missing', async () => {
      const zipReader = createMockZipReader({
        'pages/note.md': '# Note',
      });

      const result = await importSpace(backend, zipReader);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('missing manifest.json');
    });

    it('returns error when manifest.json is invalid JSON', async () => {
      const zipReader = createMockZipReader({
        'manifest.json': 'not json {{{',
      });

      const result = await importSpace(backend, zipReader);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });

    it('returns error for unsupported archive version', async () => {
      const zipReader = createMockZipReader({
        'manifest.json': JSON.stringify({
          version: 99,
          exportedAt: '2026-01-01',
          space: { id: 'x', name: 'x' },
          files: [],
        }),
      });

      const result = await importSpace(backend, zipReader);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Unsupported archive version');
    });

    it('reports files listed in manifest but missing from archive', async () => {
      const manifest = createManifest({}, [
        { path: 'pages/ghost.md', size: 5 },
      ]);
      const zipReader = createMockZipReader({
        'manifest.json': JSON.stringify(manifest),
        // note: pages/ghost.md is NOT in the zip
      });

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('pages/ghost.md');
      expect(result.errors[0].message).toContain('not found in archive');
    });

    it('reports write errors without crashing', async () => {
      const manifest = createManifest({}, [
        { path: 'pages/good.md', size: 4 },
        { path: 'pages/bad.md', size: 3 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/good.md': 'good',
          'pages/bad.md': 'bad',
        }),
      );

      const origWrite = backend.writeFile.bind(backend);
      vi.spyOn(backend, 'writeFile').mockImplementation(async (path: string, data: Uint8Array) => {
        if (path.includes('bad.md')) throw new Error('write failed');
        return origWrite(path, data);
      });

      const result = await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
      });

      expect(result.imported).toContain('pages/good.md');
      expect(result.errors.some((e) => e.path === 'pages/bad.md')).toBe(true);
    });
  });

  describe('progress callback', () => {
    it('fires progress events for each phase', async () => {
      const manifest = createManifest({}, [
        { path: 'pages/a.md', size: 1 },
        { path: 'pages/b.md', size: 1 },
      ]);
      const zipReader = createMockZipReader(
        makeArchiveFiles(manifest, {
          'pages/a.md': 'a',
          'pages/b.md': 'b',
        }),
      );

      const phases: string[] = [];
      await importSpace(backend, zipReader, {
        targetSpaceId: 'default',
        onProgress: (p) => phases.push(p.phase),
      });

      expect(phases).toContain('validating');
      expect(phases).toContain('scanning-conflicts');
      expect(phases).toContain('importing');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Preview Conflicts Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('previewImportConflicts', () => {
  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  it('returns manifest and empty conflicts when no files exist', async () => {
    const manifest = createManifest({}, [
      { path: 'pages/new.md', size: 5 },
    ]);
    const zipReader = createMockZipReader({
      'manifest.json': JSON.stringify(manifest),
      'pages/new.md': '# New',
    });

    const result = await previewImportConflicts(backend, zipReader, 'default');
    expect(result.manifest.version).toBe(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it('detects conflicts for existing files', async () => {
    backend.seed('pages/existing.md', '# Old');

    const manifest = createManifest({}, [
      { path: 'pages/existing.md', size: 5 },
      { path: 'pages/new.md', size: 5 },
    ]);
    const zipReader = createMockZipReader({
      'manifest.json': JSON.stringify(manifest),
      'pages/existing.md': '# New',
      'pages/new.md': '# New',
    });

    const result = await previewImportConflicts(backend, zipReader, 'default');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].archivePath).toBe('pages/existing.md');
    expect(result.conflicts[0].incomingSize).toBe(5);
  });

  it('throws when manifest.json is missing', async () => {
    const zipReader = createMockZipReader({ 'pages/x.md': 'x' });
    await expect(
      previewImportConflicts(backend, zipReader, 'default'),
    ).rejects.toThrow('missing manifest.json');
  });

  it('throws for unsupported version', async () => {
    const zipReader = createMockZipReader({
      'manifest.json': JSON.stringify({ version: 42, exportedAt: '', space: { id: 'x', name: 'x' }, files: [] }),
    });
    await expect(
      previewImportConflicts(backend, zipReader, 'default'),
    ).rejects.toThrow('Unsupported archive version');
  });

  it('works for non-default space paths', async () => {
    const sid = 'space-xyz';
    backend.seed(`.cept/spaces/${sid}/pages/note.md`, '# Old');

    const manifest = createManifest({}, [
      { path: 'pages/note.md', size: 5 },
    ]);
    const zipReader = createMockZipReader({
      'manifest.json': JSON.stringify(manifest),
      'pages/note.md': '# New',
    });

    const result = await previewImportConflicts(backend, zipReader, sid);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].targetPath).toBe(`.cept/spaces/${sid}/pages/note.md`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Round-Trip Tests (export then import)
// ═══════════════════════════════════════════════════════════════════════════

describe('round-trip: export then import', () => {
  it('re-creates space content after export + import', async () => {
    // Set up source space
    const source = new MockBackend();
    source.seedJson('.cept/workspace-state.json', { pages: [{ id: 'p1', title: 'Hello' }] });
    source.seed('pages/p1.md', '# Hello World\nThis is a test page.');
    source.seed('pages/p2.md', '# Second Page');

    // Export
    const exportResult = await exportSpace(source, 'default', 'Round Trip', undefined);
    expect(exportResult.errors).toHaveLength(0);

    // Build a zip reader from the exported files
    const zipFiles: Record<string, Uint8Array> = {};
    for (const file of exportResult.files) {
      zipFiles[file.archivePath] = file.data;
    }
    const zipReader: ArchiveZipReader = {
      getEntries: async () =>
        Object.entries(zipFiles).map(([path, data]) => ({
          path,
          isDirectory: false,
          getData: async () => data,
        })),
      close: async () => {},
    };

    // Import into a fresh backend
    const target = new MockBackend();
    const importResult = await importSpace(target, zipReader, {
      targetSpaceId: 'default',
    });

    expect(importResult.errors).toHaveLength(0);
    expect(importResult.imported.length).toBeGreaterThanOrEqual(3); // ws + 2 pages

    // Verify content
    expect(target.getText('.cept/workspace-state.json')).toContain('Hello');
    expect(target.getText('pages/p1.md')).toBe('# Hello World\nThis is a test page.');
    expect(target.getText('pages/p2.md')).toBe('# Second Page');
  });

  it('preserves binary data through round-trip', async () => {
    const source = new MockBackend();
    const binaryData = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x42, 0x00]);
    source.seedBytes('assets/binary.bin', binaryData);

    const exportResult = await exportSpace(source, 'default', 'Bin', undefined);
    const zipFiles: Record<string, Uint8Array> = {};
    for (const file of exportResult.files) {
      zipFiles[file.archivePath] = file.data;
    }
    const zipReader: ArchiveZipReader = {
      getEntries: async () =>
        Object.entries(zipFiles).map(([path, data]) => ({
          path,
          isDirectory: false,
          getData: async () => data,
        })),
      close: async () => {},
    };

    const target = new MockBackend();
    await importSpace(target, zipReader, { targetSpaceId: 'default' });

    const imported = await target.readFile('assets/binary.bin');
    expect(imported).not.toBeNull();
    expect(Array.from(imported!)).toEqual(Array.from(binaryData));
  });

  it('handles export from non-default space then import to different non-default space', async () => {
    const source = new MockBackend();
    source.seed('.cept/spaces/space-A/pages/note.md', '# From A');
    source.seedJson('.cept/spaces/space-A/workspace-state.json', { pages: [] });

    const exportResult = await exportSpace(source, 'space-A', 'Space A', undefined);

    const zipFiles: Record<string, Uint8Array> = {};
    for (const file of exportResult.files) {
      zipFiles[file.archivePath] = file.data;
    }
    const zipReader: ArchiveZipReader = {
      getEntries: async () =>
        Object.entries(zipFiles).map(([path, data]) => ({
          path,
          isDirectory: false,
          getData: async () => data,
        })),
      close: async () => {},
    };

    const target = new MockBackend();
    const importResult = await importSpace(target, zipReader, {
      targetSpaceId: 'space-B',
    });

    expect(importResult.errors).toHaveLength(0);
    expect(target.getText('.cept/spaces/space-B/pages/note.md')).toBe('# From A');
  });
});
