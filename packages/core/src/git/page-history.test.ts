import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import { GitBackend } from '../storage/git-backend.js';
import type { GitFs } from '../storage/git-backend.js';
import type { CommitInfo } from '../storage/backend.js';
import { listPageHistory, pageVersionContent, pageVersionDiff } from './page-history.js';

const encode = (text: string) => new TextEncoder().encode(text);

describe('page history', () => {
  let git: GitBackend;

  beforeEach(async () => {
    const underlying = new BrowserFsBackend(`page-history-${crypto.randomUUID()}`);
    git = new GitBackend({
      underlying,
      dir: '/',
      fs: underlying.getRawFs() as unknown as GitFs,
      authorName: 'Test User',
      authorEmail: 'test@example.com',
    });
    await git.initialize({ name: 'Test' });
  });

  afterEach(async () => {
    await git.close();
  });

  async function save(path: string, text: string, message: string): Promise<string> {
    await git.writeFile(path, encode(text));
    return git.commit(message, [path]);
  }

  it('lists only the commits that changed the page, newest first', async () => {
    await save('a.md', '# A1\n', 'a1');
    await save('b.md', '# B1\n', 'b1');
    await save('a.md', '# A2\n', 'a2');

    const history = await listPageHistory(git, 'a.md');
    expect(history.commits.map((c) => c.message)).toEqual(['a2', 'a1']);
    expect(history).toMatchObject({ more: false, truncated: false });
  });

  it('pages a long history', async () => {
    for (let i = 1; i <= 5; i++) await save('a.md', `# A${i}\n`, `a${i}`);

    const first = await listPageHistory(git, 'a.md', 2);
    expect(first.commits.map((c) => c.message)).toEqual(['a5', 'a4']);
    expect(first.more).toBe(true);
    const all = await listPageHistory(git, 'a.md', 5);
    expect(all.commits).toHaveLength(5);
    expect(all.more).toBe(false);
  });

  it('diffs a version against the one before, and the first against nothing', async () => {
    await save('other.md', 'x\n', 'other');
    await save('a.md', 'one\n', 'first');
    await save('a.md', 'two\n', 'second');
    const [second, first] = (await listPageHistory(git, 'a.md')).commits;

    const change = await pageVersionDiff(git, 'a.md', second!);
    expect(change?.files).toHaveLength(1);
    expect(change?.files[0]).toMatchObject({ path: 'a.md', type: 'modify' });
    expect(change?.files[0]?.hunks[0]).toContain('-one');
    expect(change?.files[0]?.hunks[0]).toContain('+two');

    const created = await pageVersionDiff(git, 'a.md', first!);
    expect(created?.files).toEqual([expect.objectContaining({ path: 'a.md', type: 'add' })]);
  });

  it('reads the page as it was at a version, or null before it existed', async () => {
    const before = await save('other.md', 'x\n', 'other');
    const v1 = await save('a.md', 'one\n', 'first');
    await save('a.md', 'two\n', 'second');

    expect(await pageVersionContent(git, 'a.md', v1)).toBe('one\n');
    expect(await pageVersionContent(git, 'a.md', before)).toBeNull();
  });

  it('path-scoped diff ignores other files', async () => {
    const sha1 = await save('a.md', 'one\n', 'first');
    await git.writeFile('b.md', encode('b\n'));
    await git.writeFile('a.md', encode('two\n'));
    const sha2 = await git.commit('both', ['a.md', 'b.md']);

    const result = await git.diff(sha1, sha2, 'a.md');
    expect(result.files.map((f) => f.path)).toEqual(['a.md']);
    expect((await git.diff(sha1, sha2, 'c.md')).files).toEqual([]);
  });

  it('reports no shallow boundary for a full repository', async () => {
    expect(await git.shallowCommits()).toEqual(new Set());
  });
});

describe('page history in a shallow clone', () => {
  const commit = (hash: string, parent: string[]): CommitInfo => ({
    hash,
    message: hash,
    author: { name: 'Test', email: 'test@example.com', timestamp: 0 },
    parent,
  });

  /** A clone whose log of the page ends at `oldest`, reading the page's parent through `readParent`. */
  function shallowClone(
    oldest: CommitInfo,
    shallow: string[],
    readParent: () => Promise<string | null>,
  ): GitBackend {
    return {
      log: async () => [commit('head', [oldest.hash]), oldest],
      shallowCommits: async () => new Set(shallow),
      readFileAt: readParent,
    } as unknown as GitBackend;
  }

  it('is truncated when the oldest version is a boundary commit', async () => {
    const git = shallowClone(commit('edge', ['gone']), ['edge'], async () => 'x');
    expect((await listPageHistory(git, 'a.md')).truncated).toBe(true);
  });

  it('is truncated when the page existed before the oldest version and the boundary did not change it', async () => {
    const git = shallowClone(commit('older', ['mid']), ['edge'], async () => 'older text');
    expect((await listPageHistory(git, 'a.md')).truncated).toBe(true);
  });

  it('is truncated when the parent of the oldest version is not downloaded', async () => {
    const git = shallowClone(commit('older', ['gone']), ['edge'], () =>
      Promise.reject(new Error('missing')),
    );
    expect((await listPageHistory(git, 'a.md')).truncated).toBe(true);
  });

  it('is complete when the oldest version created the page', async () => {
    const git = shallowClone(commit('created', ['mid']), ['edge'], async () => null);
    expect((await listPageHistory(git, 'a.md')).truncated).toBe(false);
  });
});
