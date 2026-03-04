import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from './browser-fs.js';

describe('BrowserFsBackend', () => {
  let backend: BrowserFsBackend;

  beforeEach(() => {
    // Use unique DB name per test to avoid cross-test contamination
    backend = new BrowserFsBackend(`test-${Date.now()}-${Math.random()}`);
  });

  afterEach(async () => {
    await backend.close();
  });

  describe('type and capabilities', () => {
    it('should have type "browser"', () => {
      expect(backend.type).toBe('browser');
    });

    it('should have correct capabilities', () => {
      expect(backend.capabilities).toEqual({
        history: false,
        collaboration: false,
        sync: false,
        branching: false,
        externalEditing: false,
        watchForExternalChanges: false,
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
      const data1 = new TextEncoder().encode('first');
      const data2 = new TextEncoder().encode('second');

      await backend.writeFile('test.txt', data1);
      await backend.writeFile('test.txt', data2);

      const result = await backend.readFile('test.txt');
      expect(new TextDecoder().decode(result!)).toBe('second');
    });

    it('should create parent directories automatically', async () => {
      const data = new TextEncoder().encode('nested content');
      await backend.writeFile('a/b/c/file.txt', data);

      const result = await backend.readFile('a/b/c/file.txt');
      expect(new TextDecoder().decode(result!)).toBe('nested content');
    });

    it('should handle paths with or without leading slash', async () => {
      const data = new TextEncoder().encode('content');
      await backend.writeFile('/test.txt', data);

      const result = await backend.readFile('test.txt');
      expect(new TextDecoder().decode(result!)).toBe('content');
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
      expect(await backend.exists('dir/a.txt')).toBe(false);
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
      const data = new TextEncoder().encode('hello');
      await backend.writeFile('test.txt', data);

      const result = await backend.stat('test.txt');
      expect(result).not.toBeNull();
      expect(result!.isFile).toBe(true);
      expect(result!.isDirectory).toBe(false);
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

  describe('watch', () => {
    it('should notify on file write', async () => {
      const events: Array<{ type: string; path: string }> = [];
      const unsubscribe = backend.watch('test.txt', (event) => {
        events.push(event);
      });

      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('modify');

      unsubscribe();
    });

    it('should notify parent directory watchers', async () => {
      const events: Array<{ type: string; path: string }> = [];
      const unsubscribe = backend.watch('dir', (event) => {
        events.push(event);
      });

      await backend.writeFile('dir/file.txt', new TextEncoder().encode('data'));
      expect(events.length).toBe(1);

      unsubscribe();
    });

    it('should stop notifying after unsubscribe', async () => {
      const events: Array<{ type: string; path: string }> = [];
      const unsubscribe = backend.watch('test.txt', (event) => {
        events.push(event);
      });

      await backend.writeFile('test.txt', new TextEncoder().encode('data1'));
      expect(events.length).toBe(1);

      unsubscribe();

      await backend.writeFile('test.txt', new TextEncoder().encode('data2'));
      expect(events.length).toBe(1); // still 1, no new event
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

    it('should create config.yaml with workspace name', async () => {
      await backend.initialize({ name: 'My Notes', icon: '📚' });

      const config = await backend.readFile('.cept/config.yaml');
      expect(config).not.toBeNull();
      const text = new TextDecoder().decode(config!);
      expect(text).toContain('name: "My Notes"');
      expect(text).toContain('icon: "📚"');
    });

    it('should create root page with workspace title', async () => {
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
  });
});
