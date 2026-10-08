/**
 * useGitSpaceSync — the editing session of the active writable GitHub space
 * (REQ-WS-027): opens one session per space, keeps its sync status for the
 * indicator, syncs on demand, and closes the session when the space, the
 * account or the component goes away.
 *
 * Automatic syncs run only while the page is in the foreground (visible), so
 * two tabs left open do not both push (until one sync leader is elected per
 * origin, PR 38). A manual sync always runs. The browser events are wired here
 * rather than in `@cept/core`, which knows nothing of documents and windows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GitSpaceLocalChanges,
  GitSpaceSession,
  GitSpaceSyncResult,
  StorageBackend,
  SyncState,
} from '@cept/core';

/** The parts of a `GitSpaceSession` the app uses; tests pass a fake. */
export interface SpaceSyncSession {
  readonly backend: StorageBackend;
  syncNow(): Promise<GitSpaceSyncResult>;
  pushNow(): Promise<GitSpaceSyncResult>;
  start(onSynced?: (result: GitSpaceSyncResult) => void): void;
  stop(): void;
  dispose(): Promise<void>;
  localChanges(): Promise<GitSpaceLocalChanges>;
  readonly sync: Pick<GitSpaceSession['sync'], 'getStatus' | 'on' | 'reportOnline'>;
  readonly autoCommit: Pick<GitSpaceSession['autoCommit'], 'on'>;
}

/** What the sync indicator shows. */
export type GitSyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';

export interface GitSyncStatus {
  state: GitSyncState;
  /** Edited files not committed yet. */
  pending: number;
  /** Commits not pushed yet. */
  unpushed: number;
  /** When the last sync went through (ms since epoch), or null. */
  lastSyncTime: number | null;
  lastError: string | null;
}

/** The indicator's state for a sync engine state. */
export function syncStateOf(state: SyncState): GitSyncState {
  return state === 'pulling' || state === 'pushing' ? 'syncing' : state;
}

/** Whether automatic syncs may run now, and how to hear when that changes. */
export interface Foreground {
  isActive(): boolean;
  /** Call `onChange` whenever the answer may have changed; returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Call `onOnline` when the network comes back; returns an unsubscribe. */
  onOnline(onOnline: () => void): () => void;
}

/** The page is in the foreground while it is visible. */
export const documentForeground: Foreground = {
  isActive: () => typeof document === 'undefined' || document.visibilityState === 'visible',
  subscribe(onChange) {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  },
  onOnline(onOnline) {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  },
};

export interface UseGitSpaceSyncOptions {
  /**
   * The space to keep a session for, and what identifies the account it is
   * opened with; null for none. A new key closes the old session first.
   */
  sessionKey: string | null;
  /** Open the session for `key` (the `sessionKey`). */
  open: (key: string) => Promise<SpaceSyncSession>;
  /** The session for `key` is open: bind its backend to the space. */
  onOpened: (session: SpaceSyncSession, key: string) => void;
  /**
   * The session for `key` is closing: finish the writes in flight and stop
   * using its backend. The session is disposed (committing what is pending)
   * once this settles.
   */
  onClosed: (key: string) => void | Promise<void>;
  /** A sync settled; `manual` for "Sync now". */
  onSynced: (result: GitSpaceSyncResult, manual: boolean) => void;
  /** The session could not be opened, or `onClosed` failed while it was closing. */
  onError?: (err: unknown, phase: 'open' | 'close') => void;
  foreground?: Foreground;
}

export interface GitSpaceSync {
  /** The open session, or null. */
  session: SpaceSyncSession | null;
  /** The sync status for the indicator, or null without a session. */
  status: GitSyncStatus | null;
  /** Whether a manual sync is running. */
  syncing: boolean;
  /** Commit what is pending, pull, then push; null without a session. */
  syncNow(): Promise<GitSpaceSyncResult | null>;
  /** Close the session now (waiting for a running sync and committing what is pending). */
  close(): Promise<void>;
}

export function useGitSpaceSync(options: UseGitSpaceSyncOptions): GitSpaceSync {
  const { sessionKey } = options;
  const [session, setSession] = useState<SpaceSyncSession | null>(null);
  const [status, setStatus] = useState<GitSyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  // The latest callbacks, so a new render's closures never reopen the session.
  const latest = useRef(options);
  latest.current = options;
  const sessionRef = useRef<SpaceSyncSession | null>(null);
  /** Closes the open session; set while one is open. */
  const closeRef = useRef<(() => Promise<void>) | null>(null);
  /** The close in progress, so the next session waits for it. */
  const closingRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!sessionKey) return;
    const key = sessionKey;
    const foreground = latest.current.foreground ?? documentForeground;
    let cancelled = false;
    let opened: SpaceSyncSession | null = null;
    const unsubscribe: (() => void)[] = [];

    const refresh = async (s: SpaceSyncSession) => {
      const engine = s.sync.getStatus();
      const changes = await s.localChanges().catch(() => ({ pending: 0, unpushed: 0 }));
      if (cancelled || sessionRef.current !== s) return;
      setStatus({
        state: syncStateOf(engine.state),
        pending: changes.pending,
        unpushed: changes.unpushed,
        lastSyncTime: engine.lastSyncTime,
        lastError: engine.lastError,
      });
    };

    const close = async () => {
      cancelled = true;
      for (const off of unsubscribe.splice(0)) off();
      const s = opened;
      opened = null;
      if (!s) return;
      s.stop();
      if (sessionRef.current === s) {
        sessionRef.current = null;
        closeRef.current = null;
        setSession(null);
        setStatus(null);
        setSyncing(false);
      }
      try {
        await latest.current.onClosed(key);
      } catch (err) {
        latest.current.onError?.(err, 'close');
      }
      await s.dispose().catch(() => undefined);
    };

    void (async () => {
      await closingRef.current;
      let s: SpaceSyncSession;
      try {
        s = await latest.current.open(key);
      } catch (err) {
        if (!cancelled) latest.current.onError?.(err, 'open');
        return;
      }
      if (cancelled) {
        await s.dispose().catch(() => undefined);
        return;
      }
      opened = s;
      sessionRef.current = s;
      closeRef.current = close;
      latest.current.onOpened(s, key);
      setSession(s);
      void refresh(s);

      unsubscribe.push(s.sync.on(() => void refresh(s)));
      unsubscribe.push(s.autoCommit.on(() => void refresh(s)));
      const onAuto = (result: GitSpaceSyncResult) => {
        if (!cancelled) latest.current.onSynced(result, false);
      };
      const follow = () => {
        if (cancelled) return;
        if (foreground.isActive()) s.start(onAuto);
        else s.stop();
      };
      unsubscribe.push(foreground.subscribe(follow));
      unsubscribe.push(
        foreground.onOnline(() => {
          s.sync.reportOnline();
          if (!cancelled && foreground.isActive()) s.start(onAuto);
        }),
      );
      follow();
    })();

    return () => {
      closingRef.current = close();
    };
  }, [sessionKey]);

  const syncNow = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return null;
    setSyncing(true);
    try {
      const result = await s.pushNow();
      if (sessionRef.current === s) latest.current.onSynced(result, true);
      return result;
    } finally {
      if (sessionRef.current === s) setSyncing(false);
    }
  }, []);

  const close = useCallback(async () => {
    const closing = closeRef.current;
    if (closing) closingRef.current = closing();
    await closingRef.current;
  }, []);

  return { session, status, syncing, syncNow, close };
}
