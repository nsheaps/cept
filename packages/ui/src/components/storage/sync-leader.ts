/**
 * One sync leader per space across the tabs of an origin (REQ-WS-027): the
 * tab holding a Web Lock named after the session key runs the automatic sync
 * loop, and the others wait in the lock's queue. The session key is
 * `<space id>|<login>`, so strictly the election is per (space, account); the
 * sign-in is shared by the origin's tabs, so in practice that is per space,
 * and signing in as another account starts a new election. When the leader
 * closes (or leaves the space) the browser hands the lock to the next tab in
 * line. Tabs tell each other about finished syncs over a BroadcastChannel of
 * the same name, so a follower's indicator catches up with the leader's pulls
 * and pushes.
 *
 * Without Web Locks (older browsers) the page falls back to running automatic
 * syncs only while it is visible.
 */

/** Whether automatic syncs may run now, and how to hear when that changes. */
export interface Foreground {
  isActive(): boolean;
  /** Call `onChange` whenever the answer may have changed; returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
  /** Call `onOnline` when the network comes back; returns an unsubscribe. */
  onOnline(onOnline: () => void): () => void;
  /** Stop taking part (leave the election); for a per-session foreground. */
  dispose?(): void;
  /** Tell the other tabs a sync of this space settled. */
  announceSynced?(): void;
  /** Call `listener` when another tab synced this space; returns an unsubscribe. */
  onPeerSynced?(listener: () => void): () => void;
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

/** The part of `navigator.locks` the election uses. */
export interface LockManagerLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: (lock: unknown) => Promise<unknown>,
  ): Promise<unknown>;
}

/** The part of `BroadcastChannel` the election uses. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
}

export interface SyncLeaderEnv {
  /** `navigator.locks`, or null where Web Locks are missing. */
  locks: LockManagerLike | null;
  /** Open a BroadcastChannel, or null where it is missing. */
  channel: ((name: string) => ChannelLike) | null;
  /** Used when `locks` is null. */
  fallback: Foreground;
}

/** The browser's Web Locks and BroadcastChannel, where present. */
export function browserSyncLeaderEnv(): SyncLeaderEnv {
  const locks =
    typeof navigator !== 'undefined' && 'locks' in navigator
      ? (navigator.locks as LockManagerLike)
      : null;
  const channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : (name: string) => new BroadcastChannel(name) as ChannelLike;
  return { locks, channel, fallback: documentForeground };
}

/** The lock and channel name for a space's session key. */
export function syncLeaderName(sessionKey: string): string {
  return `cept-sync:${sessionKey}`;
}

const SYNCED = 'synced';

/**
 * Join the election for `sessionKey`. The result is a `Foreground` that is
 * active while this tab leads; `dispose()` leaves the election (handing the
 * lead on if this tab held it).
 */
export function electSyncLeader(
  sessionKey: string,
  env: SyncLeaderEnv = browserSyncLeaderEnv(),
): Foreground {
  const name = syncLeaderName(sessionKey);
  const channel = env.channel?.(name) ?? null;
  const peerListeners = new Set<() => void>();
  /** Set once the channel is closed; posting on a closed channel throws. */
  let closed = false;
  channel?.addEventListener('message', (event) => {
    if (event.data === SYNCED) for (const listener of peerListeners) listener();
  });
  const peers = {
    announceSynced: () => {
      if (!closed) channel?.postMessage(SYNCED);
    },
    onPeerSynced(listener: () => void) {
      peerListeners.add(listener);
      return () => void peerListeners.delete(listener);
    },
  };

  if (!env.locks) {
    // No election without Web Locks: every visible tab runs the loop, so two
    // visible tabs on one space both sync. The "one leader" rule holds only
    // with Web Locks.
    return {
      ...peers,
      isActive: () => env.fallback.isActive(),
      subscribe: (onChange) => env.fallback.subscribe(onChange),
      onOnline: (onOnline) => env.fallback.onOnline(onOnline),
      dispose: () => {
        closed = true;
        peerListeners.clear();
        channel?.close();
      },
    };
  }

  let leader = false;
  let disposed = false;
  let release: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const abort = new AbortController();
  env.locks
    .request(name, { signal: abort.signal }, () => {
      if (disposed) return Promise.resolve();
      leader = true;
      notify();
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    })
    // Aborted while waiting in the queue, or the lock manager went away.
    .catch(() => undefined);

  return {
    ...peers,
    isActive: () => leader,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    onOnline: (onOnline) => env.fallback.onOnline(onOnline),
    dispose() {
      if (disposed) return;
      disposed = true;
      closed = true;
      abort.abort();
      const wasLeader = leader;
      leader = false;
      release?.();
      release = null;
      if (wasLeader) notify();
      listeners.clear();
      peerListeners.clear();
      channel?.close();
    },
  };
}
