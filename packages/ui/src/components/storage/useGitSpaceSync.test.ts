import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { GitSpaceSyncResult, SyncStatus } from '@cept/core';
import { MemoryBackend } from './test-helpers.js';
import {
  canPushToNewBranch,
  syncStateOf,
  useGitSpaceSync,
  type Foreground,
  type SpaceSyncSession,
  type UseGitSpaceSyncOptions,
} from './useGitSpaceSync.js';

const idle: SyncStatus = {
  state: 'idle',
  enabled: true,
  lastSyncTime: null,
  lastError: null,
  lastErrorKind: null,
  pendingPush: false,
  conflicts: [],
  conflictDetails: [],
};

const synced: GitSpaceSyncResult = {
  status: { ...idle, state: 'synced', lastSyncTime: 1 },
  changed: true,
};

function fakeSession(name = 's') {
  let status: SyncStatus = idle;
  const syncListeners = new Set<() => void>();
  let autoTick: ((r: GitSpaceSyncResult) => void) | undefined;
  const session = {
    name,
    backend: new MemoryBackend(),
    syncNow: vi.fn(async () => synced),
    pushNow: vi.fn(async () => synced),
    start: vi.fn((onSynced?: (r: GitSpaceSyncResult) => void) => {
      autoTick = onSynced;
    }),
    stop: vi.fn(),
    dispose: vi.fn(async () => undefined),
    localChanges: vi.fn(async () => ({ pending: 2, unpushed: 1 })),
    resolveConflicts: vi.fn(async () => synced),
    pushToNewBranch: vi.fn(async () => ({ branch: 'cept/octo/2026-10-08-abc1234', sync: synced })),
    sync: {
      getStatus: () => status,
      on: (fn: () => void) => {
        syncListeners.add(fn);
        return () => syncListeners.delete(fn);
      },
      reportOnline: vi.fn(),
      reportOffline: vi.fn(),
    },
    autoCommit: { on: () => () => undefined },
  } satisfies SpaceSyncSession & { name: string };
  return {
    session,
    setStatus(next: Partial<SyncStatus>) {
      status = { ...status, ...next };
      for (const fn of syncListeners) fn();
    },
    tick: (r: GitSpaceSyncResult) => autoTick?.(r),
    listeners: syncListeners,
  };
}

function fakeForeground(active = true) {
  let isActive = active;
  const changes = new Set<() => void>();
  const online = new Set<() => void>();
  const offline = new Set<() => void>();
  const fg: Foreground = {
    isActive: () => isActive,
    subscribe: (fn) => {
      changes.add(fn);
      return () => changes.delete(fn);
    },
    onOnline: (fn) => {
      online.add(fn);
      return () => online.delete(fn);
    },
    onOffline: (fn) => {
      offline.add(fn);
      return () => offline.delete(fn);
    },
  };
  return {
    fg,
    set(next: boolean) {
      isActive = next;
      for (const fn of changes) fn();
    },
    goOnline: () => {
      for (const fn of online) fn();
    },
    goOffline: () => {
      for (const fn of offline) fn();
    },
    changes,
  };
}

function options(over: Partial<UseGitSpaceSyncOptions>): UseGitSpaceSyncOptions {
  return {
    sessionKey: 'space|me',
    open: async () => fakeSession().session,
    onOpened: () => undefined,
    onClosed: () => undefined,
    onSynced: () => undefined,
    ...over,
  };
}

describe('syncStateOf', () => {
  it('shows pulling and pushing as syncing', () => {
    expect(syncStateOf('pulling')).toBe('syncing');
    expect(syncStateOf('pushing')).toBe('syncing');
    expect(syncStateOf('conflict')).toBe('conflict');
    expect(syncStateOf('offline')).toBe('offline');
  });
});

describe('canPushToNewBranch', () => {
  const status = {
    state: 'error' as const,
    pending: 0,
    unpushed: 1,
    lastSyncTime: null,
    lastError: 'refused',
    lastErrorKind: 'protected-branch' as const,
    conflicts: [],
  };
  it('is offered on a conflict or a refused push, not on other failures', () => {
    expect(canPushToNewBranch(null)).toBe(false);
    expect(canPushToNewBranch(status)).toBe(true);
    expect(canPushToNewBranch({ ...status, lastErrorKind: 'rejected' })).toBe(true);
    expect(canPushToNewBranch({ ...status, state: 'conflict', lastErrorKind: null })).toBe(true);
    expect(canPushToNewBranch({ ...status, lastErrorKind: 'auth' })).toBe(false);
    expect(canPushToNewBranch({ ...status, state: 'synced', lastErrorKind: null })).toBe(false);
  });
});

describe('useGitSpaceSync', () => {
  it('opens no session without a key', () => {
    const open = vi.fn(async () => fakeSession().session);
    const { result } = renderHook(() => useGitSpaceSync(options({ sessionKey: null, open })));
    expect(open).not.toHaveBeenCalled();
    expect(result.current.session).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it('opens the session, binds it, reports status and starts auto sync in the foreground', async () => {
    const f = fakeSession();
    const fg = fakeForeground(true);
    const onOpened = vi.fn();
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, onOpened, foreground: fg.fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    expect(onOpened).toHaveBeenCalledWith(f.session, 'space|me');
    await waitFor(() =>
      expect(result.current.status).toEqual({
        state: 'idle',
        pending: 2,
        unpushed: 1,
        lastSyncTime: null,
        lastError: null,
        lastErrorKind: null,
        conflicts: [],
      }),
    );
    expect(f.session.start).toHaveBeenCalledTimes(1);

    act(() => f.setStatus({ state: 'pushing' }));
    await waitFor(() => expect(result.current.status?.state).toBe('syncing'));
  });

  it('runs automatic syncs only while the page is in the foreground', async () => {
    const f = fakeSession();
    const fg = fakeForeground(false);
    const onSynced = vi.fn();
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, onSynced, foreground: fg.fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    expect(f.session.start).not.toHaveBeenCalled();
    expect(f.session.stop).toHaveBeenCalled();

    act(() => fg.set(true));
    expect(f.session.start).toHaveBeenCalledTimes(1);
    act(() => f.tick(synced));
    expect(onSynced).toHaveBeenCalledWith(synced, false);

    const stops = f.session.stop.mock.calls.length;
    act(() => fg.set(false));
    expect(f.session.stop.mock.calls.length).toBe(stops + 1);

    // Back online while hidden: the engine hears it, auto sync stays off.
    act(() => fg.goOnline());
    expect(f.session.sync.reportOnline).toHaveBeenCalled();
    expect(f.session.start).toHaveBeenCalledTimes(1);
  });

  it('reports going offline at once and flushes from the leader when back online (PR 39)', async () => {
    const f = fakeSession();
    const fg = fakeForeground(true);
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, foreground: fg.fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    expect(f.session.start).toHaveBeenCalledTimes(1);

    act(() => fg.goOffline());
    expect(f.session.sync.reportOffline).toHaveBeenCalledTimes(1);

    act(() => fg.goOnline());
    expect(f.session.sync.reportOnline).toHaveBeenCalledTimes(1);
    expect(f.session.start).toHaveBeenCalledTimes(2);
  });

  it('makes a foreground per session, shares syncs with other tabs and leaves on close', async () => {
    const f = fakeSession();
    const fg = fakeForeground(true);
    let peerSynced: (() => void) | undefined;
    const tab = {
      ...fg.fg,
      dispose: vi.fn(),
      announceSynced: vi.fn(),
      onPeerSynced: (listener: () => void) => {
        peerSynced = listener;
        return () => (peerSynced = undefined);
      },
    };
    const make = vi.fn(() => tab);
    const { result, rerender } = renderHook(
      (key: string | null) =>
        useGitSpaceSync(
          options({ sessionKey: key, open: async () => f.session, foreground: make }),
        ),
      { initialProps: 'space|me' as string | null },
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    expect(make).toHaveBeenCalledWith('space|me');

    act(() => f.tick(synced));
    expect(tab.announceSynced).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.syncNow();
    });
    expect(tab.announceSynced).toHaveBeenCalledTimes(2);

    // Another tab synced: the status is read again.
    const reads = f.session.localChanges.mock.calls.length;
    act(() => peerSynced?.());
    await waitFor(() => expect(f.session.localChanges.mock.calls.length).toBe(reads + 1));

    rerender(null);
    await waitFor(() => expect(f.session.dispose).toHaveBeenCalled());
    expect(tab.dispose).toHaveBeenCalledTimes(1);
    expect(peerSynced).toBeUndefined();
  });

  it('keeps a shared foreground when the session closes', async () => {
    const f = fakeSession();
    const shared = { ...fakeForeground(true).fg, dispose: vi.fn() };
    const { result, rerender } = renderHook(
      (key: string | null) =>
        useGitSpaceSync(
          options({ sessionKey: key, open: async () => f.session, foreground: shared }),
        ),
      { initialProps: 'space|me' as string | null },
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    rerender(null);
    await waitFor(() => expect(f.session.dispose).toHaveBeenCalled());
    expect(shared.dispose).not.toHaveBeenCalled();
  });

  it('syncs now (commit, pull, push) even in the background', async () => {
    const f = fakeSession();
    const fg = fakeForeground(false);
    const onSynced = vi.fn();
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, onSynced, foreground: fg.fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    let got: GitSpaceSyncResult | null = null;
    await act(async () => {
      got = await result.current.syncNow();
    });
    expect(got).toBe(synced);
    expect(f.session.pushNow).toHaveBeenCalledTimes(1);
    expect(onSynced).toHaveBeenCalledWith(synced, true);
    expect(result.current.syncing).toBe(false);
  });

  it('reports the conflicts the last sync stopped on', async () => {
    const f = fakeSession();
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, foreground: fakeForeground().fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    const conflict = { path: 'a.md', type: 'content' as const, ours: 'x', theirs: 'y', base: 'z' };
    act(() => f.setStatus({ state: 'conflict', conflictDetails: [conflict] }));
    await waitFor(() => expect(result.current.status?.conflicts).toEqual([conflict]));
    expect(result.current.status?.state).toBe('conflict');
  });

  it('resolves conflicts and pushes to a new branch as manual syncs', async () => {
    const f = fakeSession();
    const onSynced = vi.fn();
    const { result } = renderHook(() =>
      useGitSpaceSync(
        options({ open: async () => f.session, onSynced, foreground: fakeForeground().fg }),
      ),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    const resolutions = [{ path: 'a.md', choice: 'mine' as const }];
    await act(async () => {
      await result.current.resolveConflicts(resolutions);
    });
    expect(f.session.resolveConflicts).toHaveBeenCalledWith(resolutions);
    expect(onSynced).toHaveBeenLastCalledWith(synced, true);

    let branch: string | undefined;
    await act(async () => {
      branch = (await result.current.pushToNewBranch())?.branch;
    });
    expect(branch).toBe('cept/octo/2026-10-08-abc1234');
    expect(onSynced).toHaveBeenLastCalledWith(synced, true);
    expect(result.current.syncing).toBe(false);
  });

  it('syncNow without a session does nothing', async () => {
    const { result } = renderHook(() => useGitSpaceSync(options({ sessionKey: null })));
    await expect(result.current.syncNow()).resolves.toBeNull();
  });

  it('closes the old session before opening one for a new key', async () => {
    const a = fakeSession('a');
    const b = fakeSession('b');
    const order: string[] = [];
    let releaseA: () => void = () => undefined;
    a.session.dispose.mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          releaseA = () => {
            order.push('dispose a');
            resolve(undefined);
          };
        }),
    );
    const sessions: Record<string, SpaceSyncSession> = { a: a.session, b: b.session };
    const onClosed = vi.fn(() => order.push('closed'));
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useGitSpaceSync(
          options({
            sessionKey: key,
            open: async () => {
              order.push(`open ${key}`);
              return sessions[key];
            },
            onClosed,
            foreground: fakeForeground(true).fg,
          }),
        ),
      { initialProps: { key: 'a' } },
    );
    await waitFor(() => expect(result.current.session).toBe(a.session));
    rerender({ key: 'b' });
    expect(a.session.stop).toHaveBeenCalled();
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(order).not.toContain('open b');
    releaseA();
    await waitFor(() => expect(result.current.session).toBe(b.session));
    expect(order).toEqual(['open a', 'closed', 'dispose a', 'open b']);
  });

  it('waits for onClosed (writes in flight) before disposing the session', async () => {
    const f = fakeSession();
    const order: string[] = [];
    let finishWrites: () => void = () => undefined;
    f.session.dispose.mockImplementation(async () => {
      order.push('dispose');
    });
    const { result } = renderHook(() =>
      useGitSpaceSync(
        options({
          open: async () => f.session,
          onClosed: (key) =>
            new Promise<void>((resolve) => {
              order.push(`closed ${key}`);
              finishWrites = () => {
                order.push('writes done');
                resolve();
              };
            }),
          foreground: fakeForeground().fg,
        }),
      ),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    let closed = false;
    const closing = result.current.close().then(() => {
      closed = true;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(closed).toBe(false);
    expect(order).toEqual(['closed space|me']);
    finishWrites();
    await act(async () => {
      await closing;
    });
    expect(order).toEqual(['closed space|me', 'writes done', 'dispose']);
  });

  it('close() disposes the session and stops listening', async () => {
    const f = fakeSession();
    const fg = fakeForeground(true);
    const onClosed = vi.fn();
    const { result } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, onClosed, foreground: fg.fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    await act(async () => {
      await result.current.close();
    });
    expect(f.session.dispose).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
    expect(fg.changes.size).toBe(0);
    expect(f.listeners.size).toBe(0);
  });

  it('reports onClosed failing, and still disposes the session', async () => {
    const f = fakeSession();
    const onError = vi.fn();
    const err = new Error('save failed');
    const { result } = renderHook(() =>
      useGitSpaceSync(
        options({
          open: async () => f.session,
          onClosed: async () => {
            throw err;
          },
          onError,
          foreground: fakeForeground().fg,
        }),
      ),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    await act(async () => {
      await result.current.close();
    });
    expect(onError).toHaveBeenCalledWith(err, 'close');
    expect(f.session.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the session on unmount', async () => {
    const f = fakeSession();
    const { result, unmount } = renderHook(() =>
      useGitSpaceSync(options({ open: async () => f.session, foreground: fakeForeground().fg })),
    );
    await waitFor(() => expect(result.current.session).toBe(f.session));
    unmount();
    await waitFor(() => expect(f.session.dispose).toHaveBeenCalledTimes(1));
  });

  it('reports a session that cannot open', async () => {
    const onError = vi.fn();
    const err = new Error('no clone');
    renderHook(() =>
      useGitSpaceSync(
        options({
          open: async () => {
            throw err;
          },
          onError,
        }),
      ),
    );
    await waitFor(() => expect(onError).toHaveBeenCalledWith(err, 'open'));
  });

  it('disposes a session that finished opening after its key went away', async () => {
    const f = fakeSession();
    let release: () => void = () => undefined;
    const open = () =>
      new Promise<SpaceSyncSession>((resolve) => {
        release = () => resolve(f.session);
      });
    const onOpened = vi.fn();
    const { rerender } = renderHook(
      ({ key }: { key: string | null }) =>
        useGitSpaceSync(options({ sessionKey: key, open, onOpened })),
      { initialProps: { key: 'a' as string | null } },
    );
    await new Promise((r) => setTimeout(r, 0));
    rerender({ key: null });
    release();
    await waitFor(() => expect(f.session.dispose).toHaveBeenCalledTimes(1));
    expect(onOpened).not.toHaveBeenCalled();
  });
});
