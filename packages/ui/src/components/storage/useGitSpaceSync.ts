/**
 * useGitSpaceSync — the editing session of the active writable GitHub space
 * (REQ-WS-027): opens one session per space, keeps its sync status for the
 * indicator, syncs on demand, and closes the session when the space, the
 * account or the component goes away.
 *
 * Automatic syncs run only in the tab elected sync leader for the space
 * (`sync-leader.ts`), so two tabs left open do not both push; a manual sync
 * always runs. The browser APIs are used here rather than in `@cept/core`,
 * which knows nothing of documents and windows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { electSyncLeader } from './sync-leader.js';
import type { Foreground } from './sync-leader.js';
import type {
  ConflictResolution,
  GitSpaceLocalChanges,
  GitSpaceNewBranchResult,
  GitSpaceSession,
  GitSpaceSyncResult,
  MergeConflict,
  StorageBackend,
  SyncErrorKind,
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
  resolveConflicts(resolutions: readonly ConflictResolution[]): Promise<GitSpaceSyncResult>;
  pushToNewBranch(): Promise<GitSpaceNewBranchResult>;
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
  lastErrorKind: SyncErrorKind | null;
  /** The files the last sync stopped on (REQ-WS-026). */
  conflicts: MergeConflict[];
}

/**
 * Whether to offer "push to a new branch": the sync stopped on a conflict, or
 * the remote refused the push (a protected branch, a rule, or a branch that
 * moved and cannot be merged).
 */
export function canPushToNewBranch(status: GitSyncStatus | null): boolean {
  if (!status) return false;
  if (status.state === 'conflict') return true;
  return (
    status.state === 'error' &&
    (status.lastErrorKind === 'protected-branch' ||
      status.lastErrorKind === 'rejected' ||
      status.lastErrorKind === 'not-fast-forward')
  );
}

/** The indicator's state for a sync engine state. */
export function syncStateOf(state: SyncState): GitSyncState {
  return state === 'pulling' || state === 'pushing' ? 'syncing' : state;
}

export type { Foreground } from './sync-leader.js';
export { documentForeground } from './sync-leader.js';

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
  /**
   * When automatic syncs may run: a fixed `Foreground`, or one made per
   * session key (and disposed with the session). Defaults to electing one
   * sync leader per space across the origin's tabs.
   */
  foreground?: Foreground | ((key: string) => Foreground);
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
  /** Finish the stopped merge with the user's resolutions, then sync; null without a session. */
  resolveConflicts(resolutions: readonly ConflictResolution[]): Promise<GitSpaceSyncResult | null>;
  /** Push the local work to a new branch and follow the tracked one again; null without a session. */
  pushToNewBranch(): Promise<GitSpaceNewBranchResult | null>;
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
  /** The open session's foreground, so manual syncs reach the other tabs too. */
  const foregroundRef = useRef<Foreground | null>(null);

  useEffect(() => {
    if (!sessionKey) return;
    const key = sessionKey;
    const choice = latest.current.foreground ?? electSyncLeader;
    const foreground = typeof choice === 'function' ? choice(key) : choice;
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
        lastErrorKind: engine.lastErrorKind,
        conflicts: engine.conflictDetails,
      });
    };

    const close = async () => {
      cancelled = true;
      for (const off of unsubscribe.splice(0)) off();
      // Leave the election first, so another tab can take over the loop.
      if (foreground !== latest.current.foreground) foreground.dispose?.();
      const s = opened;
      opened = null;
      if (!s) return;
      s.stop();
      if (sessionRef.current === s) {
        sessionRef.current = null;
        closeRef.current = null;
        foregroundRef.current = null;
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
      foregroundRef.current = foreground;
      latest.current.onOpened(s, key);
      setSession(s);
      void refresh(s);

      unsubscribe.push(s.sync.on(() => void refresh(s)));
      unsubscribe.push(s.autoCommit.on(() => void refresh(s)));
      const onAuto = (result: GitSpaceSyncResult) => {
        foreground.announceSynced?.();
        if (!cancelled) latest.current.onSynced(result, false);
      };
      // Another tab synced this space: catch up with what it pulled or pushed.
      if (foreground.onPeerSynced) unsubscribe.push(foreground.onPeerSynced(() => void refresh(s)));
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

  /** Run a manual action on the open session, reporting its sync as manual. */
  const manual = useCallback(
    async <T>(
      run: (s: SpaceSyncSession) => Promise<T>,
      syncOf: (result: T) => GitSpaceSyncResult,
    ): Promise<T | null> => {
      const s = sessionRef.current;
      if (!s) return null;
      setSyncing(true);
      try {
        const result = await run(s);
        foregroundRef.current?.announceSynced?.();
        if (sessionRef.current === s) latest.current.onSynced(syncOf(result), true);
        return result;
      } finally {
        if (sessionRef.current === s) setSyncing(false);
      }
    },
    [],
  );

  const syncNow = useCallback(
    () =>
      manual(
        (s) => s.pushNow(),
        (r) => r,
      ),
    [manual],
  );

  const resolveConflicts = useCallback(
    (resolutions: readonly ConflictResolution[]) =>
      manual(
        (s) => s.resolveConflicts(resolutions),
        (r) => r,
      ),
    [manual],
  );

  const pushToNewBranch = useCallback(
    () =>
      manual(
        (s) => s.pushToNewBranch(),
        (r) => r.sync,
      ),
    [manual],
  );

  const close = useCallback(async () => {
    const closing = closeRef.current;
    if (closing) closingRef.current = closing();
    await closingRef.current;
  }, []);

  return { session, status, syncing, syncNow, resolveConflicts, pushToNewBranch, close };
}
