import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GitFs, GitHttp } from '../storage/git-backend.js';
import { MemoryBackend } from '../storage/memory.js';
import { ScopedBackend } from '../storage/scoped.js';
import type { FileChange } from './auto-commit.js';
import { GitSpaceSession, RecordingBackend } from './git-space-session.js';
import type { SyncStatus } from './sync-engine.js';
import { DEFAULT_SYNC_SETTINGS } from './sync-policy.js';

const encode = (text: string) => new TextEncoder().encode(text);

function setup(subPath: string) {
  const host = new MemoryBackend();
  const changes: [string, FileChange['type']][] = [];
  const root = ['repo', subPath].filter(Boolean).join('/');
  const backend = new RecordingBackend(new ScopedBackend(host, root), subPath, (path, type) =>
    changes.push([path, type]),
  );
  return { host, backend, changes };
}

describe('RecordingBackend', () => {
  it('reports new, changed and deleted files relative to the repository root', async () => {
    const { host, backend, changes } = setup('docs');

    await backend.writeFile('guide.md', encode('# Guide\n'));
    await backend.writeFile('guide.md', encode('# Guide\n\nMore.\n'));
    await backend.deleteFile('guide.md');

    expect(changes).toEqual([
      ['docs/guide.md', 'add'],
      ['docs/guide.md', 'modify'],
      ['docs/guide.md', 'delete'],
    ]);
    expect(await host.exists('repo/docs/guide.md')).toBe(false);
  });

  it('uses space paths as repository paths for a space at the root', async () => {
    const { host, backend, changes } = setup('');

    await backend.writeFile('/notes/a.md', encode('a'));

    expect(changes).toEqual([['notes/a.md', 'add']]);
    expect(await host.exists('repo/notes/a.md')).toBe(true);
  });

  it('does not report deleting a file that is not there', async () => {
    const { backend, changes } = setup('');

    await backend.deleteFile('missing.md').catch(() => undefined);

    expect(changes).toEqual([]);
  });

  it('reads through without reporting', async () => {
    const { backend, changes } = setup('');
    await backend.writeFile('a.md', encode('a'));
    changes.length = 0;

    expect(new TextDecoder().decode((await backend.readFile('a.md')) ?? undefined)).toBe('a');
    expect(await backend.exists('a.md')).toBe(true);
    expect((await backend.listDirectory('')).map((e) => e.name)).toEqual(['a.md']);
    expect(changes).toEqual([]);
  });
});

/** A filesystem that is enough for opening a session (writing `.git/info/exclude`). */
function fakeFs(): GitFs {
  const ok = () => Promise.resolve(undefined);
  const missing = () => Promise.reject(new Error('ENOENT'));
  const sync = () => undefined;
  return {
    readFile: sync,
    writeFile: sync,
    unlink: sync,
    readdir: sync,
    mkdir: sync,
    rmdir: sync,
    stat: sync,
    lstat: sync,
    promises: {
      readFile: missing,
      writeFile: ok,
      unlink: ok,
      readdir: ok,
      mkdir: ok,
      rmdir: ok,
      stat: missing,
      lstat: missing,
    },
  };
}

const noHttp: GitHttp = {
  request: () => Promise.reject(new Error('no network in unit tests')),
};

const synced: SyncStatus = {
  state: 'synced',
  enabled: true,
  lastSyncTime: 1,
  lastError: null,
  lastErrorKind: null,
  pendingPush: false,
  conflicts: [],
};

/** A session whose syncs wait until the test settles them, one by one. */
async function controlledSession(intervalMs = 10_000) {
  const session = await GitSpaceSession.open({
    host: new MemoryBackend(),
    fs: fakeFs(),
    dir: 'repo',
    http: noHttp,
    identity: { name: 'Octo', email: 'octo@users.noreply.github.com' },
    settings: { ...DEFAULT_SYNC_SETTINGS, intervalMs },
  });
  const log: string[] = [];
  const waiting: (() => void)[] = [];
  vi.spyOn(session.git, 'head').mockResolvedValue('abc');
  vi.spyOn(session.autoCommit, 'flushNow').mockImplementation(async () => {
    log.push('flush');
    return null;
  });
  vi.spyOn(session.sync, 'sync').mockImplementation(() => {
    log.push('sync-start');
    return new Promise<SyncStatus>((resolve) =>
      waiting.push(() => {
        log.push('sync-end');
        resolve(synced);
      }),
    );
  });
  const settleSync = async () => {
    waiting.shift()?.();
    // Let the settled sync's callbacks run.
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return { session, log, settleSync, syncs: () => log.filter((l) => l === 'sync-start').length };
}

describe('GitSpaceSession scheduling', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules the next automatic sync only after the current one settles', async () => {
    vi.useFakeTimers();
    const { session, settleSync, syncs } = await controlledSession(1000);
    const onSynced = vi.fn();

    session.start(onSynced);
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncs()).toBe(1);

    await settleSync();
    expect(onSynced).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(syncs()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(syncs()).toBe(2);

    session.stop();
    await settleSync();
    await vi.advanceTimersByTimeAsync(5000);
    expect(syncs()).toBe(2);
  });

  it('runs a manual sync after the one in flight, not alongside it', async () => {
    const { session, log, settleSync } = await controlledSession();

    const first = session.syncNow();
    const second = session.syncNow();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(log.filter((l) => l === 'sync-start')).toHaveLength(1);

    await settleSync();
    await settleSync();
    await Promise.all([first, second]);
    expect(log).toEqual(['flush', 'sync-start', 'sync-end', 'flush', 'sync-start', 'sync-end']);
  });

  it('waits for a sync in flight before the final commit on dispose', async () => {
    const { session, log, settleSync } = await controlledSession();
    session.start();
    for (let i = 0; i < 10; i++) await Promise.resolve();

    let disposed = false;
    const disposing = session.dispose().then(() => {
      disposed = true;
    });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(disposed).toBe(false);
    expect(log).toEqual(['flush', 'sync-start']);

    await settleSync();
    await disposing;
    expect(log).toEqual(['flush', 'sync-start', 'sync-end', 'flush']);
    await expect(session.syncNow()).rejects.toThrow(/closed/);
  });

  it('counts edits not committed yet and commits not pushed yet', async () => {
    const { session } = await controlledSession();
    vi.spyOn(session.git, 'unpushedCommits').mockResolvedValue(2);

    await session.backend.writeFile('a.md', encode('a'));

    expect(await session.localChanges()).toEqual({ pending: 1, unpushed: 2 });
  });
});
