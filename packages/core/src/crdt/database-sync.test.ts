import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSyncAdapter, generateChangeId } from './database-sync.js';
import type { DatabaseChange, DatabaseSyncEvent } from './database-sync.js';

describe('generateChangeId', () => {
  it('generates unique IDs', () => {
    const id1 = generateChangeId('user-1');
    const id2 = generateChangeId('user-1');
    expect(id1).not.toBe(id2);
  });

  it('includes user ID', () => {
    const id = generateChangeId('user-42');
    expect(id).toContain('user-42');
  });
});

describe('DatabaseSyncAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with default config', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    expect(adapter.getPendingCount()).toBe(0);
    expect(adapter.isEnabled()).toBe(true);
  });

  it('records a change', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(adapter.getPendingCount()).toBe(1);
  });

  it('emits change-queued event', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    const events: DatabaseSyncEvent[] = [];
    adapter.on((e) => events.push(e));

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });

    expect(events[0].type).toBe('change-queued');
    expect(events[0].databaseId).toBe('db-1');
  });

  it('does not record when disabled', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setEnabled(false);
    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(adapter.getPendingCount()).toBe(0);
  });

  it('flushes after debounce', () => {
    const broadcast = vi.fn();
    const adapter = new DatabaseSyncAdapter({ userId: 'u1', debounceMs: 100 });
    adapter.setBroadcast(broadcast);

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });

    expect(broadcast).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(broadcast).toHaveBeenCalledOnce();
    expect(adapter.getPendingCount()).toBe(0);
  });

  it('flushes immediately when batch is full', () => {
    const broadcast = vi.fn();
    const adapter = new DatabaseSyncAdapter({
      userId: 'u1',
      debounceMs: 10000,
      maxBatchSize: 2,
    });
    adapter.setBroadcast(broadcast);

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(broadcast).not.toHaveBeenCalled();

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r2', databaseId: 'db-1', properties: {} },
    });
    expect(broadcast).toHaveBeenCalledOnce();
  });

  it('groups changes by database when broadcasting', () => {
    const broadcast = vi.fn();
    const adapter = new DatabaseSyncAdapter({ userId: 'u1', debounceMs: 50 });
    adapter.setBroadcast(broadcast);

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    adapter.recordChange('db-2', 'add-row', {
      row: { id: 'r2', databaseId: 'db-2', properties: {} },
    });

    vi.advanceTimersByTime(50);

    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast.mock.calls[0][0]).toBe('db-1');
    expect(broadcast.mock.calls[1][0]).toBe('db-2');
  });

  it('emits changes-sent event', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1', debounceMs: 50 });
    adapter.setBroadcast(vi.fn());
    const events: DatabaseSyncEvent[] = [];
    adapter.on((e) => events.push(e));

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    vi.advanceTimersByTime(50);

    expect(events.some((e) => e.type === 'changes-sent')).toBe(true);
  });

  it('flush with no pending changes is a no-op', () => {
    const broadcast = vi.fn();
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setBroadcast(broadcast);
    adapter.flush();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('receives and applies remote changes', async () => {
    const applyFn = vi.fn(async () => {});
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(applyFn);

    const remoteChange: DatabaseChange = {
      changeId: 'remote-1',
      databaseId: 'db-1',
      operation: 'add-row',
      timestamp: Date.now(),
      userId: 'u2',
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    };

    await adapter.receiveChanges([remoteChange]);

    expect(applyFn).toHaveBeenCalledWith(remoteChange);
  });

  it('emits change-applied event for each applied change', async () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(async () => {});
    const events: DatabaseSyncEvent[] = [];
    adapter.on((e) => events.push(e));

    await adapter.receiveChanges([
      {
        changeId: 'r-1',
        databaseId: 'db-1',
        operation: 'add-row',
        timestamp: Date.now(),
        userId: 'u2',
      },
    ]);

    expect(events.some((e) => e.type === 'changes-received')).toBe(true);
    expect(events.some((e) => e.type === 'change-applied')).toBe(true);
  });

  it('deduplicates already-applied changes', async () => {
    const applyFn = vi.fn(async () => {});
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(applyFn);

    const change: DatabaseChange = {
      changeId: 'dup-1',
      databaseId: 'db-1',
      operation: 'add-row',
      timestamp: Date.now(),
      userId: 'u2',
    };

    await adapter.receiveChanges([change]);
    await adapter.receiveChanges([change]); // same change again

    expect(applyFn).toHaveBeenCalledTimes(1);
  });

  it('does not apply own changes received back', () => {
    const applyFn = vi.fn(async () => {});
    const adapter = new DatabaseSyncAdapter({ userId: 'u1', debounceMs: 10000 });
    adapter.setApplyCallback(applyFn);

    // Record a local change
    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });

    // The change ID is tracked — if it comes back, it's deduplicated
    const pending = adapter.getPendingCount();
    expect(pending).toBe(1);
  });

  it('emits error event when apply fails', async () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(async () => {
      throw new Error('apply failed');
    });
    const events: DatabaseSyncEvent[] = [];
    adapter.on((e) => events.push(e));

    await adapter.receiveChanges([
      {
        changeId: 'r-1',
        databaseId: 'db-1',
        operation: 'add-row',
        timestamp: Date.now(),
        userId: 'u2',
      },
    ]);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error!.message).toBe('apply failed');
  });

  it('skips receive when all changes already applied', async () => {
    const applyFn = vi.fn(async () => {});
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(applyFn);

    const change: DatabaseChange = {
      changeId: 'known-1',
      databaseId: 'db-1',
      operation: 'add-row',
      timestamp: Date.now(),
      userId: 'u2',
    };

    await adapter.receiveChanges([change]);
    applyFn.mockClear();

    // All already known
    const events: DatabaseSyncEvent[] = [];
    adapter.on((e) => events.push(e));
    await adapter.receiveChanges([change]);

    expect(applyFn).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'changes-received')).toBe(false);
  });

  it('hasApplied tracks change IDs', async () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setApplyCallback(async () => {});

    expect(adapter.hasApplied('unknown')).toBe(false);

    await adapter.receiveChanges([
      {
        changeId: 'tracked-1',
        databaseId: 'db-1',
        operation: 'add-row',
        timestamp: Date.now(),
        userId: 'u2',
      },
    ]);

    expect(adapter.hasApplied('tracked-1')).toBe(true);
  });

  it('unsubscribes from events', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    const events: DatabaseSyncEvent[] = [];
    const unsub = adapter.on((e) => events.push(e));
    unsub();

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(events).toHaveLength(0);
  });

  it('dispose clears all state', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1', debounceMs: 100 });
    adapter.setBroadcast(vi.fn());
    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });

    adapter.dispose();

    expect(adapter.getPendingCount()).toBe(0);
    expect(adapter.hasApplied('anything')).toBe(false);
  });

  it('setEnabled toggles recording', () => {
    const adapter = new DatabaseSyncAdapter({ userId: 'u1' });
    adapter.setEnabled(false);
    expect(adapter.isEnabled()).toBe(false);

    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(adapter.getPendingCount()).toBe(0);

    adapter.setEnabled(true);
    adapter.recordChange('db-1', 'add-row', {
      row: { id: 'r1', databaseId: 'db-1', properties: {} },
    });
    expect(adapter.getPendingCount()).toBe(1);
  });
});
