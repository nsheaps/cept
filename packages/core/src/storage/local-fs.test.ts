import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalFsBackend } from './local-fs.js';

describe('LocalFsBackend', () => {
  let backend: LocalFsBackend;
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cept-test-'));
    backend = new LocalFsBackend(testDir);
  });

  afterEach(async () => {
    await backend.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('type and capabilities', () => {
    it('should have type "local"', () => {
      expect(backend.type).toBe('local');
    });

    it('should have correct capabilities', () => {
      expect(backend.capabilities).toEqual({
        history: false,
        collaboration: false,
        sync: false,
        branching: false,
        externalEditing: true,
        watchForExternalChanges: true,
      });
    });
  });

  describe('readFile / writeFile', () => {
    it('should return null for non-existent file', async () => {
      const result = await backend.readFile('nonexistent.txt');
      expect(result).toBeNull();
    });

    it('should write and read a file', async () => {
      const data = new TextEncoder().encode('hello world');
      await backend.writeFile('test.txt', data);

      const result = await backend.readFile('test.txt');
      expect(result).not.toBeNull();
      expect(new TextDecoder().decode(result!)).toBe('hello world');
    });

    it('should overwrite existing file', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('first'));
      await backend.writeFile('test.txt', new TextEncoder().encode('second'));

      const result = await backend.readFile('test.txt');
      expect(new TextDecoder().decode(result!)).toBe('second');
    });

    it('should create parent directories automatically', async () => {
      const data = new TextEncoder().encode('nested');
      await backend.writeFile('a/b/c/file.txt', data);

      const result = await backend.readFile('a/b/c/file.txt');
      expect(new TextDecoder().decode(result!)).toBe('nested');
    });

    it('should handle paths with or without leading slash', async () => {
      const data = new TextEncoder().encode('content');
      await backend.writeFile('/test.txt', data);

      const result = await backend.readFile('test.txt');
      expect(new TextDecoder().decode(result!)).toBe('content');
    });

    it('should write file to actual filesystem', async () => {
      await backend.writeFile('fs-test.txt', new TextEncoder().encode('fs check'));
      const raw = await fs.readFile(path.join(testDir, 'fs-test.txt'), 'utf-8');
      expect(raw).toBe('fs check');
    });
  });

  describe('deleteFile', () => {
    it('should not throw when deleting non-existent file', async () => {
      await expect(backend.deleteFile('nonexistent.txt')).resolves.toBeUndefined();
    });

    it('should delete an existing file', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.deleteFile('test.txt');

      const result = await backend.readFile('test.txt');
      expect(result).toBeNull();
    });

    it('should delete a directory recursively', async () => {
      await backend.writeFile('dir/a.txt', new TextEncoder().encode('a'));
      await backend.writeFile('dir/b.txt', new TextEncoder().encode('b'));
      await backend.deleteFile('dir');

      expect(await backend.exists('dir')).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent path', async () => {
      expect(await backend.exists('nonexistent.txt')).toBe(false);
    });

    it('should return true for existing file', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      expect(await backend.exists('test.txt')).toBe(true);
    });

    it('should return true for existing directory', async () => {
      await backend.writeFile('dir/file.txt', new TextEncoder().encode('data'));
      expect(await backend.exists('dir')).toBe(true);
    });
  });

  describe('listDirectory', () => {
    it('should return empty array for non-existent directory', async () => {
      const entries = await backend.listDirectory('nonexistent');
      expect(entries).toEqual([]);
    });

    it('should list files and directories', async () => {
      await backend.writeFile('dir/file1.txt', new TextEncoder().encode('a'));
      await backend.writeFile('dir/file2.txt', new TextEncoder().encode('b'));
      await backend.writeFile('dir/sub/file3.txt', new TextEncoder().encode('c'));

      const entries = await backend.listDirectory('dir');
      const names = entries.map((e) => e.name).sort();
      expect(names).toEqual(['file1.txt', 'file2.txt', 'sub']);

      const subDir = entries.find((e) => e.name === 'sub');
      expect(subDir?.isDirectory).toBe(true);
      expect(subDir?.isFile).toBe(false);

      const file = entries.find((e) => e.name === 'file1.txt');
      expect(file?.isDirectory).toBe(false);
      expect(file?.isFile).toBe(true);
    });
  });

  describe('stat', () => {
    it('should return null for non-existent file', async () => {
      const result = await backend.stat('nonexistent.txt');
      expect(result).toBeNull();
    });

    it('should return stats for an existing file', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('hello'));

      const result = await backend.stat('test.txt');
      expect(result).not.toBeNull();
      expect(result!.isFile).toBe(true);
      expect(result!.isDirectory).toBe(false);
      expect(result!.size).toBe(5);
      expect(result!.modifiedAt).toBeInstanceOf(Date);
      expect(result!.createdAt).toBeInstanceOf(Date);
    });

    it('should return stats for a directory', async () => {
      await backend.writeFile('dir/file.txt', new TextEncoder().encode('data'));

      const result = await backend.stat('dir');
      expect(result).not.toBeNull();
      expect(result!.isDirectory).toBe(true);
      expect(result!.isFile).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should create workspace structure', async () => {
      await backend.initialize({ name: 'Test Workspace' });

      expect(await backend.exists('pages')).toBe(true);
      expect(await backend.exists('.cept')).toBe(true);
      expect(await backend.exists('.cept/databases')).toBe(true);
      expect(await backend.exists('.cept/assets')).toBe(true);
      expect(await backend.exists('.cept/templates')).toBe(true);
      expect(await backend.exists('.cept/config.yaml')).toBe(true);
      expect(await backend.exists('pages/index.md')).toBe(true);
    });

    it('should create config with workspace name', async () => {
      await backend.initialize({ name: 'My Notes', icon: '📚' });

      const config = await backend.readFile('.cept/config.yaml');
      expect(config).not.toBeNull();
      const text = new TextDecoder().decode(config!);
      expect(text).toContain('name: "My Notes"');
      expect(text).toContain('icon: "📚"');
    });

    it('should create root page', async () => {
      await backend.initialize({ name: 'My Workspace' });

      const page = await backend.readFile('pages/index.md');
      expect(page).not.toBeNull();
      const text = new TextDecoder().decode(page!);
      expect(text).toContain('title: "My Workspace"');
      expect(text).toContain('# My Workspace');
    });

    it('should not overwrite existing root page', async () => {
      await backend.writeFile(
        'pages/index.md',
        new TextEncoder().encode('# Existing Content'),
      );
      await backend.initialize({ name: 'New Name' });

      const page = await backend.readFile('pages/index.md');
      const text = new TextDecoder().decode(page!);
      expect(text).toBe('# Existing Content');
    });

    it('should create actual files on disk', async () => {
      await backend.initialize({ name: 'Disk Test' });

      const configPath = path.join(testDir, '.cept', 'config.yaml');
      const raw = await fs.readFile(configPath, 'utf-8');
      expect(raw).toContain('name: "Disk Test"');
    });
  });
});
