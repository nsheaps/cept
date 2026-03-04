import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalFsBackend } from './local-fs.js';
import { GitBackend } from './git-backend.js';

describe('GitBackend', () => {
  let testDir: string;
  let underlying: LocalFsBackend;
  let backend: GitBackend;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cept-git-test-'));
    underlying = new LocalFsBackend(testDir);
    backend = new GitBackend({
      underlying,
      dir: testDir,
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    });
  });

  afterEach(async () => {
    await backend.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('type and capabilities', () => {
    it('should have type "git"', () => {
      expect(backend.type).toBe('git');
    });

    it('should have all capabilities enabled', () => {
      expect(backend.capabilities).toEqual({
        history: true,
        collaboration: true,
        sync: true,
        branching: true,
        externalEditing: true,
        watchForExternalChanges: true,
      });
    });
  });

  describe('initialize', () => {
    it('should create workspace structure and init git repo', async () => {
      await backend.initialize({ name: 'Test Workspace' });

      // Verify workspace dirs exist
      expect(await backend.exists('pages')).toBe(true);
      expect(await backend.exists('.cept')).toBe(true);

      // Verify git repo exists
      const gitDir = path.join(testDir, '.git');
      const gitStat = await fs.stat(gitDir);
      expect(gitStat.isDirectory()).toBe(true);
    });

    it('should not re-init if already a git repo', async () => {
      await backend.initialize({ name: 'First' });

      // Write and commit a file
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.commit('initial commit', ['test.txt']);

      // Re-initialize should not wipe the repo
      await backend.initialize({ name: 'Second' });

      const logs = await backend.log();
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('StorageBackend delegation', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
    });

    it('should delegate readFile to underlying backend', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('hello'));
      const result = await backend.readFile('test.txt');
      expect(new TextDecoder().decode(result!)).toBe('hello');
    });

    it('should delegate exists to underlying backend', async () => {
      expect(await backend.exists('nonexistent')).toBe(false);
      await backend.writeFile('exists.txt', new TextEncoder().encode('yes'));
      expect(await backend.exists('exists.txt')).toBe(true);
    });

    it('should delegate listDirectory to underlying backend', async () => {
      await backend.writeFile('dir/a.txt', new TextEncoder().encode('a'));
      await backend.writeFile('dir/b.txt', new TextEncoder().encode('b'));

      const entries = await backend.listDirectory('dir');
      expect(entries.map((e) => e.name).sort()).toEqual(['a.txt', 'b.txt']);
    });
  });

  describe('commit', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
    });

    it('should commit specific files', async () => {
      await backend.writeFile('file1.txt', new TextEncoder().encode('content1'));
      const sha = await backend.commit('test commit', ['file1.txt']);

      expect(sha).toBeTruthy();
      expect(sha.length).toBeGreaterThan(10);
    });

    it('should commit all changes when no paths specified', async () => {
      await backend.writeFile('a.txt', new TextEncoder().encode('a'));
      await backend.writeFile('b.txt', new TextEncoder().encode('b'));
      const sha = await backend.commit('commit all');

      expect(sha).toBeTruthy();

      const logs = await backend.log();
      expect(logs[0].message).toBe('commit all');
    });

    it('should record author information', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.commit('authored commit', ['test.txt']);

      const logs = await backend.log();
      expect(logs[0].author.name).toBe('Test User');
      expect(logs[0].author.email).toBe('test@example.com');
    });
  });

  describe('log', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
    });

    it('should return commit history', async () => {
      await backend.writeFile('f1.txt', new TextEncoder().encode('1'));
      await backend.commit('first', ['f1.txt']);

      await backend.writeFile('f2.txt', new TextEncoder().encode('2'));
      await backend.commit('second', ['f2.txt']);

      const logs = await backend.log();
      expect(logs.length).toBe(2);
      expect(logs[0].message).toBe('second');
      expect(logs[1].message).toBe('first');
    });

    it('should support limit option', async () => {
      await backend.writeFile('f1.txt', new TextEncoder().encode('1'));
      await backend.commit('first', ['f1.txt']);
      await backend.writeFile('f2.txt', new TextEncoder().encode('2'));
      await backend.commit('second', ['f2.txt']);
      await backend.writeFile('f3.txt', new TextEncoder().encode('3'));
      await backend.commit('third', ['f3.txt']);

      const logs = await backend.log(undefined, { limit: 2 });
      expect(logs.length).toBe(2);
    });

    it('should include hash, message, author, and parent', async () => {
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.commit('test commit', ['test.txt']);

      const logs = await backend.log();
      expect(logs[0]).toHaveProperty('hash');
      expect(logs[0]).toHaveProperty('message');
      expect(logs[0]).toHaveProperty('author');
      expect(logs[0]).toHaveProperty('parent');
      expect(logs[0].author).toHaveProperty('name');
      expect(logs[0].author).toHaveProperty('email');
      expect(logs[0].author).toHaveProperty('timestamp');
    });
  });

  describe('branches', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
      // Need an initial commit before branching
      await backend.writeFile('init.txt', new TextEncoder().encode('init'));
      await backend.commit('initial', ['init.txt']);
    });

    it('should list branches', async () => {
      const branches = await backend.branch.list();
      expect(branches.length).toBeGreaterThanOrEqual(1);
      expect(branches.some((b) => b.current)).toBe(true);
    });

    it('should report current branch', async () => {
      const current = await backend.branch.current();
      expect(current).toBe('main');
    });

    it('should create a new branch', async () => {
      await backend.branch.create('feature-1');
      const branches = await backend.branch.list();
      expect(branches.some((b) => b.name === 'feature-1')).toBe(true);
    });

    it('should switch branches', async () => {
      await backend.branch.create('feature-2');
      await backend.branch.switch('feature-2');
      const current = await backend.branch.current();
      expect(current).toBe('feature-2');
    });

    it('should delete a branch', async () => {
      await backend.branch.create('to-delete');
      await backend.branch.delete('to-delete');
      const branches = await backend.branch.list();
      expect(branches.some((b) => b.name === 'to-delete')).toBe(false);
    });
  });

  describe('diff', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
    });

    it('should detect added files', async () => {
      await backend.writeFile('first.txt', new TextEncoder().encode('first'));
      const sha1 = await backend.commit('first commit', ['first.txt']);

      await backend.writeFile('second.txt', new TextEncoder().encode('second'));
      const sha2 = await backend.commit('second commit', ['second.txt']);

      const result = await backend.diff(sha1, sha2);
      expect(result.files.some((f) => f.path === 'second.txt' && f.type === 'add')).toBe(true);
    });

    it('should detect modified files', async () => {
      await backend.writeFile('file.txt', new TextEncoder().encode('v1'));
      const sha1 = await backend.commit('v1', ['file.txt']);

      await backend.writeFile('file.txt', new TextEncoder().encode('v2'));
      const sha2 = await backend.commit('v2', ['file.txt']);

      const result = await backend.diff(sha1, sha2);
      expect(result.files.some((f) => f.path === 'file.txt' && f.type === 'modify')).toBe(true);
    });

    it('should detect deleted files', async () => {
      await backend.writeFile('file.txt', new TextEncoder().encode('data'));
      const sha1 = await backend.commit('add', ['file.txt']);

      await backend.deleteFile('file.txt');
      const sha2 = await backend.commit('delete');

      const result = await backend.diff(sha1, sha2);
      expect(result.files.some((f) => f.path === 'file.txt' && f.type === 'delete')).toBe(true);
    });
  });

  describe('remotes', () => {
    beforeEach(async () => {
      await backend.initialize({ name: 'Test' });
    });

    it('should add a remote', async () => {
      await backend.remote.add('origin', 'https://github.com/test/repo.git');
      const remotes = await backend.remote.list();
      expect(remotes).toContainEqual({ name: 'origin', url: 'https://github.com/test/repo.git' });
    });

    it('should list remotes', async () => {
      await backend.remote.add('origin', 'https://example.com/repo.git');
      await backend.remote.add('upstream', 'https://example.com/upstream.git');
      const remotes = await backend.remote.list();
      expect(remotes.length).toBe(2);
    });

    it('should remove a remote', async () => {
      await backend.remote.add('origin', 'https://example.com/repo.git');
      await backend.remote.remove('origin');
      const remotes = await backend.remote.list();
      expect(remotes.length).toBe(0);
    });
  });
});
