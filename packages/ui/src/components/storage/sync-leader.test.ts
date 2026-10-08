import { describe, it, expect, vi } from 'vitest';
import { electSyncLeader, syncLeaderName } from './sync-leader.js';
import type { ChannelLike, LockManagerLike, SyncLeaderEnv } from './sync-leader.js';
import type { Foreground } from './useGitSpaceSync.js';

/** An in-memory `navigator.locks`: exclusive locks granted in request order. */
function fakeLocks(): LockManagerLike & { holder(name: string): number | undefined } {
  const queues = new Map<string, { id: number; run: () => void; aborted: boolean }[]>();
  const held = new Map<string, number>();
  let nextId = 0;
  const grant = (name: string) => {
    if (held.has(name)) return;
    const queue = queues.get(name) ?? [];
    let next = queue.shift();
    while (next?.aborted) next = queue.shift();
    // Like the browser, grant at once but call back asynchronously.
    if (next) {
      held.set(name, next.id);
      queueMicrotask(next.run);
    }
  };
  return {
    holder: (name) => held.get(name),
    request(name, options, callback) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const entry = {
          id,
          aborted: false,
          run: () => {
            void callback({ name }).then((value) => {
              held.delete(name);
              resolve(value);
              grant(name);
            });
          },
        };
        options.signal?.addEventListener('abort', () => {
          if (held.get(name) === id) return;
          entry.aborted = true;
          reject(new DOMException('aborted', 'AbortError'));
        });
        queues.set(name, [...(queues.get(name) ?? []), entry]);
        grant(name);
      });
    },
  };
}

/** BroadcastChannels that deliver to every other channel of the same name. */
function fakeChannels() {
  const open = new Map<string, Set<{ deliver: (data: unknown) => void }>>();
  return (name: string): ChannelLike => {
    const listeners: ((event: { data: unknown }) => void)[] = [];
    const self = { deliver: (data: unknown) => listeners.forEach((l) => l({ data })) };
    const peers = open.get(name) ?? new Set();
    open.set(name, peers.add(self));
    return {
      postMessage: (data) => {
        for (const peer of peers) if (peer !== self) peer.deliver(data);
      },
      addEventListener: (_type, listener) => void listeners.push(listener),
      close: () => void peers.delete(self),
    };
  };
}

const fallback: Foreground = {
  isActive: () => false,
  subscribe: () => () => undefined,
  onOnline: () => () => undefined,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function tabs() {
  const env: SyncLeaderEnv = { locks: fakeLocks(), channel: fakeChannels(), fallback };
  return (key = 'space-a') => electSyncLeader(key, env);
}

describe('electSyncLeader (REQ-WS-027)', () => {
  it('names the lock after the session key', () => {
    expect(syncLeaderName('github.com/o/r@main/docs#octo')).toBe(
      'cept-sync:github.com/o/r@main/docs#octo',
    );
  });

  it('makes exactly one tab the leader and tells it when it becomes one', async () => {
    const open = tabs();
    const first = open();
    const onChange = vi.fn();
    first.subscribe(onChange);
    const second = open();
    await flush();
    expect(first.isActive()).toBe(true);
    expect(second.isActive()).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('hands the lead to the next tab when the leader leaves', async () => {
    const open = tabs();
    const first = open();
    const second = open();
    const third = open();
    const onChange = vi.fn();
    second.subscribe(onChange);
    await flush();

    first.dispose?.();
    await flush();
    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);
    expect(third.isActive()).toBe(false);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('drops a follower that leaves from the queue', async () => {
    const open = tabs();
    const first = open();
    const second = open();
    const third = open();
    await flush();
    second.dispose?.();
    first.dispose?.();
    await flush();
    expect(second.isActive()).toBe(false);
    expect(third.isActive()).toBe(true);
  });

  it('elects a leader per space', async () => {
    const open = tabs();
    const docs = open('docs');
    const team = open('team');
    await flush();
    expect(docs.isActive()).toBe(true);
    expect(team.isActive()).toBe(true);
  });

  it('tells the other tabs of the same space when a sync settles', async () => {
    const open = tabs();
    const leader = open();
    const follower = open();
    const otherSpace = open('team');
    const heard = vi.fn();
    const heardElsewhere = vi.fn();
    const selfHeard = vi.fn();
    follower.onPeerSynced?.(heard);
    otherSpace.onPeerSynced?.(heardElsewhere);
    leader.onPeerSynced?.(selfHeard);
    leader.announceSynced?.();
    expect(heard).toHaveBeenCalledOnce();
    expect(heardElsewhere).not.toHaveBeenCalled();
    expect(selfHeard).not.toHaveBeenCalled();

    follower.dispose?.();
    leader.announceSynced?.();
    expect(heard).toHaveBeenCalledOnce();
  });

  it('does not post on its channel once it has left', async () => {
    const posted = vi.fn();
    const channel = (): ChannelLike => ({
      postMessage: posted,
      addEventListener: () => undefined,
      close: () => undefined,
    });
    const fg = electSyncLeader('space-a', { locks: fakeLocks(), channel, fallback });
    fg.dispose?.();
    expect(() => fg.announceSynced?.()).not.toThrow();
    expect(posted).not.toHaveBeenCalled();
  });

  it('hears the network go away through the page, elected or not', () => {
    const offline = new Set<() => void>();
    const page = {
      ...fallback,
      onOffline: (fn: () => void) => {
        offline.add(fn);
        return () => void offline.delete(fn);
      },
    };
    const elected = electSyncLeader('space-a', {
      locks: fakeLocks(),
      channel: null,
      fallback: page,
    });
    const plain = electSyncLeader('space-b', { locks: null, channel: null, fallback: page });
    const heardElected = vi.fn();
    const heardPlain = vi.fn();
    elected.onOffline?.(heardElected);
    const off = plain.onOffline?.(heardPlain);
    for (const fn of offline) fn();
    expect(heardElected).toHaveBeenCalledOnce();
    expect(heardPlain).toHaveBeenCalledOnce();
    off?.();
    expect(offline.size).toBe(1);
  });

  it('falls back to the page being visible without Web Locks', () => {
    const visible = { ...fallback, isActive: () => true };
    const fg = electSyncLeader('space-a', { locks: null, channel: null, fallback: visible });
    expect(fg.isActive()).toBe(true);
    expect(() => fg.announceSynced?.()).not.toThrow();
    fg.dispose?.();
  });
});
