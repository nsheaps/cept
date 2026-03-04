import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineQueue } from './offline-queue.js';
import type { OfflineQueueEvent } from './offline-queue.js';

describe('OfflineQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts online with empty queue', () => {
    const queue = new OfflineQueue();
    expect(queue.getState()).toBe('online');
    expect(queue.getQueueSize()).toBe(0);
    expect(queue.hasQueued()).toBe(false);
  });

  it('sends immediately when online', async () => {
    const sendFn = vi.fn(async () => {});
    const queue = new OfflineQueue();
    queue.setSendFn(sendFn);

    const sent = await queue.enqueue({ type: 'test' });
    expect(sent).toBe(true);
    expect(sendFn).toHaveBeenCalledWith({ type: 'test' });
    expect(queue.getQueueSize()).toBe(0);
  });

  it('queues when offline', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();

    await queue.enqueue({ type: 'test' });
    expect(queue.getQueueSize()).toBe(1);
  });

  it('queues when send fails', async () => {
    const sendFn = vi.fn(async () => {
      throw new Error('network error');
    });
    const queue = new OfflineQueue();
    queue.setSendFn(sendFn);

    const sent = await queue.enqueue({ type: 'test' });
    expect(sent).toBe(false);
    expect(queue.getState()).toBe('offline');
    expect(queue.getQueueSize()).toBe(1);
  });

  it('emits queued event', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.enqueue({ type: 'test' });
    expect(events.some((e) => e.type === 'queued')).toBe(true);
  });

  it('emits offline event', () => {
    const queue = new OfflineQueue();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    queue.goOffline();
    expect(events.some((e) => e.type === 'offline')).toBe(true);
  });

  it('emits online event', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.goOnline();
    expect(events.some((e) => e.type === 'online')).toBe(true);
  });

  it('replays queued operations on reconnect', async () => {
    const sendFn = vi.fn(async () => {});
    const queue = new OfflineQueue({ replayDelayMs: 0 });
    queue.setSendFn(sendFn);
    queue.goOffline();

    await queue.enqueue({ type: 'op1' });
    await queue.enqueue({ type: 'op2' });

    sendFn.mockClear();
    await queue.goOnline();

    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(sendFn).toHaveBeenCalledWith({ type: 'op1' });
    expect(sendFn).toHaveBeenCalledWith({ type: 'op2' });
    expect(queue.getQueueSize()).toBe(0);
    expect(queue.getState()).toBe('online');
  });

  it('emits replay events', async () => {
    const sendFn = vi.fn(async () => {});
    const queue = new OfflineQueue({ replayDelayMs: 0, replayBatchSize: 10 });
    queue.setSendFn(sendFn);
    queue.goOffline();

    await queue.enqueue({ type: 'op1' });
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.goOnline();

    const types = events.map((e) => e.type);
    expect(types).toContain('online');
    expect(types).toContain('replay-start');
    expect(types).toContain('replay-batch');
    expect(types).toContain('replay-complete');
  });

  it('handles replay error', async () => {
    const sendFn = vi.fn(async () => {
      throw new Error('replay failed');
    });
    const queue = new OfflineQueue({ replayDelayMs: 0 });
    queue.setSendFn(sendFn);
    queue.goOffline();

    await queue.enqueue({ type: 'op1' });
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.goOnline();

    expect(events.some((e) => e.type === 'replay-error')).toBe(true);
    expect(queue.getState()).toBe('offline');
  });

  it('enforces max queue size', async () => {
    const queue = new OfflineQueue({ maxQueueSize: 3 });
    queue.goOffline();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.enqueue({ id: 1 });
    await queue.enqueue({ id: 2 });
    await queue.enqueue({ id: 3 });
    await queue.enqueue({ id: 4 }); // should drop oldest

    expect(queue.getQueueSize()).toBe(3);
    const items = queue.getQueue() as Array<{ id: number }>;
    expect(items[0].id).toBe(2);
    expect(events.some((e) => e.type === 'queue-overflow')).toBe(true);
  });

  it('goOffline is idempotent', () => {
    const queue = new OfflineQueue();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    queue.goOffline();
    queue.goOffline();

    expect(events.filter((e) => e.type === 'offline')).toHaveLength(1);
  });

  it('goOnline with empty queue and already online is no-op', async () => {
    const queue = new OfflineQueue();
    const events: OfflineQueueEvent[] = [];
    queue.on((e) => events.push(e));

    await queue.goOnline();
    expect(events).toHaveLength(0);
  });

  it('clearQueue empties the queue', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();
    await queue.enqueue({ type: 'test' });
    expect(queue.getQueueSize()).toBe(1);

    queue.clearQueue();
    expect(queue.getQueueSize()).toBe(0);
  });

  it('getQueue returns a copy', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();
    await queue.enqueue({ type: 'test' });

    const copy = queue.getQueue();
    expect(copy).toHaveLength(1);
    // Modifying copy doesn't affect internal queue
    (copy as unknown[]).length = 0;
    expect(queue.getQueueSize()).toBe(1);
  });

  it('isReplaying returns false when not replaying', () => {
    const queue = new OfflineQueue();
    expect(queue.isReplaying()).toBe(false);
  });

  it('unsubscribes from events', async () => {
    const queue = new OfflineQueue();
    const events: OfflineQueueEvent[] = [];
    const unsub = queue.on((e) => events.push(e));
    unsub();

    queue.goOffline();
    expect(events).toHaveLength(0);
  });

  it('dispose clears all state', async () => {
    const queue = new OfflineQueue();
    queue.goOffline();
    await queue.enqueue({ type: 'test' });

    queue.dispose();

    expect(queue.getQueueSize()).toBe(0);
  });

  it('replays in batches with delay', async () => {
    const sendFn = vi.fn(async () => {});
    const queue = new OfflineQueue({
      replayBatchSize: 2,
      replayDelayMs: 100,
    });
    queue.setSendFn(sendFn);
    queue.goOffline();

    await queue.enqueue({ id: 1 });
    await queue.enqueue({ id: 2 });
    await queue.enqueue({ id: 3 });

    const replayPromise = queue.goOnline();

    // First batch of 2 sent immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(sendFn).toHaveBeenCalledTimes(2);

    // After delay, second batch
    await vi.advanceTimersByTimeAsync(100);
    await replayPromise;
    expect(sendFn).toHaveBeenCalledTimes(3);
    expect(queue.getQueueSize()).toBe(0);
  });

  it('stops replay when going offline during replay', async () => {
    let callCount = 0;
    const sendFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // Simulate going offline during replay
        queue.goOffline();
      }
    });
    const queue = new OfflineQueue({ replayBatchSize: 1, replayDelayMs: 0 });
    queue.setSendFn(sendFn);
    queue.goOffline();

    await queue.enqueue({ id: 1 });
    await queue.enqueue({ id: 2 });
    await queue.enqueue({ id: 3 });

    await queue.goOnline();

    // Only first operation sent before going offline
    expect(sendFn).toHaveBeenCalledTimes(1);
    // Remaining items still in queue
    expect(queue.getQueueSize()).toBe(2);
  });

  it('queues without send function when online', async () => {
    const queue = new OfflineQueue();
    // No send function set
    const sent = await queue.enqueue({ type: 'test' });
    // Without sendFn, enqueue falls through to addToQueue
    expect(sent).toBe(false);
    expect(queue.getQueueSize()).toBe(1);
  });
});
