import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from './browser-fs.js';
import { GitBackend } from './git-backend.js';
import type { GitFs, GitHttp } from './git-backend.js';

describe('GitBackend', () => {
  // The same wiring the browser app uses: BrowserFsBackend over lightning-fs, whose raw
  // fs instance is also what isomorphic-git operates on.
  const dir = '/';
  let underlying: BrowserFsBackend;
  let rawFs: GitFs;
  let backend: GitBackend;

  beforeEach(async () => {
    underlying = new BrowserFsBackend(`git-test-${crypto.randomUUID()}`);
    rawFs = underlying.getRawFs() as unknown as GitFs;
    backend = new GitBackend({
      underlying,
      dir,
      fs: rawFs,
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    });
  });

  afterEach(async () => {
    await backend.close();
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
      const gitStat = await underlying.stat('.git');
      expect(gitStat?.isDirectory).toBe(true);
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

    it('keeps an excluded settings file out of commits (ensureExcluded)', async () => {
      await backend.writeFile('first.md', new TextEncoder().encode('# First'));
      const first = await backend.commit('first', ['first.md']);
      await backend.ensureExcluded('.cept/sync.local.json');
      await backend.ensureExcluded('.cept/sync.local.json');
      await backend.writeFile('page.md', new TextEncoder().encode('# Page'));
      await backend.writeFile('.cept/sync.local.json', new TextEncoder().encode('{}'));
      const second = await backend.commit('commit all');

      const exclude = String(await rawFs.promises!.readFile('/.git/info/exclude', 'utf8'));
      expect(exclude.split('\n').filter((l) => l === '.cept/sync.local.json')).toHaveLength(1);
      const diff = await backend.diff(first, second);
      const paths = diff.files.map((f) => f.path);
      expect(paths).toContain('page.md');
      expect(paths).not.toContain('.cept/sync.local.json');
    });

    it('keeps a queued push in .git until it is marked sent', async () => {
      await backend.initialize({ name: 'Queue' });
      expect(await backend.pushQueued()).toBe(false);
      await backend.setPushQueued(true);
      expect(await backend.pushQueued()).toBe(true);
      await backend.setPushQueued(false);
      await backend.setPushQueued(false);
      expect(await backend.pushQueued()).toBe(false);
    });

    it('reports an fs error reading the push queue instead of calling it empty', async () => {
      const failing = new GitBackend({
        underlying,
        dir,
        fs: {
          ...rawFs,
          promises: {
            ...rawFs.promises!,
            lstat: () => Promise.reject(Object.assign(new Error('boom'), { code: 'EIO' })),
          },
        },
        authorName: 'Test User',
        authorEmail: 'test@example.com',
      });
      await expect(failing.pushQueued()).rejects.toThrow('boom');
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

    it('should produce non-empty hunks for added files', async () => {
      await backend.writeFile('first.txt', new TextEncoder().encode('first'));
      const sha1 = await backend.commit('first', ['first.txt']);

      await backend.writeFile('new.txt', new TextEncoder().encode('line1\nline2\n'));
      const sha2 = await backend.commit('add new', ['new.txt']);

      const result = await backend.diff(sha1, sha2);
      const added = result.files.find((f) => f.path === 'new.txt');
      expect(added).toBeDefined();
      expect(added!.hunks.length).toBeGreaterThan(0);
      expect(added!.hunks[0]).toContain('+line1');
    });

    it('should produce hunks with context for modified files', async () => {
      await backend.writeFile('file.txt', new TextEncoder().encode('old content'));
      const sha1 = await backend.commit('v1', ['file.txt']);

      await backend.writeFile('file.txt', new TextEncoder().encode('new content'));
      const sha2 = await backend.commit('v2', ['file.txt']);

      const result = await backend.diff(sha1, sha2);
      const modified = result.files.find((f) => f.path === 'file.txt');
      expect(modified).toBeDefined();
      expect(modified!.hunks.length).toBeGreaterThan(0);
      expect(modified!.hunks[0]).toContain('-old content');
      expect(modified!.hunks[0]).toContain('+new content');
    });

    it('should produce hunks for deleted files', async () => {
      await backend.writeFile('gone.txt', new TextEncoder().encode('deleted content'));
      const sha1 = await backend.commit('add', ['gone.txt']);

      await backend.deleteFile('gone.txt');
      const sha2 = await backend.commit('remove');

      const result = await backend.diff(sha1, sha2);
      const deleted = result.files.find((f) => f.path === 'gone.txt');
      expect(deleted).toBeDefined();
      expect(deleted!.hunks.length).toBeGreaterThan(0);
      expect(deleted!.hunks[0]).toContain('-deleted content');
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

  describe('clone', () => {
    it('should throw without http client', async () => {
      // backend has no http client configured
      await expect(backend.clone('https://github.com/test/repo')).rejects.toThrow(
        'http client required',
      );
    });

    it('should accept http and corsProxy options', () => {
      const mockHttp: GitHttp = { request: () => Promise.reject(new Error('mock')) };
      const gitWithHttp = new GitBackend({
        underlying,
        dir,
        fs: rawFs,
        http: mockHttp,
        corsProxy: 'https://cors.example.com',
      });
      // Should not throw — options are stored for later use
      expect(gitWithHttp.type).toBe('git');
    });
  });

  describe('fetch', () => {
    it('should throw without http client', async () => {
      await backend.initialize({ name: 'Test' });
      await expect(backend.fetch()).rejects.toThrow('http client required');
    });
  });

  describe('push', () => {
    it('should throw without http client', async () => {
      await backend.initialize({ name: 'Test' });
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.commit('test', ['test.txt']);
      await expect(backend.push()).rejects.toThrow('http client required');
    });
  });

  describe('pull', () => {
    it('should throw without http client', async () => {
      await backend.initialize({ name: 'Test' });
      await backend.writeFile('test.txt', new TextEncoder().encode('data'));
      await backend.commit('test', ['test.txt']);
      await expect(backend.pull()).rejects.toThrow('http client required');
    });
  });
});
