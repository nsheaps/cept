import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from './sync-engine.js';
import type { SyncEvent } from './sync-engine.js';
import type { GitStorageBackend } from '../storage/backend.js';

function createMockBackend(): GitStorageBackend {
  return {
    type: 'git',
    capabilities: {
      history: true,
      collaboration: true,
      sync: true,
      branching: true,
      externalEditing: true,
      watchForExternalChanges: true,
    },
    commit: vi.fn(async () => 'sha'),
    push: vi.fn(async () => ({ ok: true, refs: {} })),
    pull: vi.fn(async () => ({ ok: true, conflicts: [] })),
    log: vi.fn(async () => []),
    diff: vi.fn(async () => ({ files: [] })),
    branch: {
      create: vi.fn(),
      switch: vi.fn(),
      merge: vi.fn(async () => ({ ok: true, conflicts: [] })),
      list: vi.fn(async () => []),
      current: vi.fn(async () => 'main'),
      delete: vi.fn(),
    },
    remote: {
      add: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(async () => []),
    },
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    listDirectory: vi.fn(),
    exists: vi.fn(),
    watch: vi.fn(() => () => {}),
    stat: vi.fn(),
    initialize: vi.fn(),
    close: vi.fn(),
  } as unknown as GitStorageBackend;
}

describe('SyncEngine', () => {
  let backend: GitStorageBackend;

  beforeEach(() => {
    vi.useFakeTimers();
    backend = createMockBackend();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates with default config', () => {
    const engine = new SyncEngine(backend);
    const status = engine.getStatus();
    expect(status.state).toBe('idle');
    expect(status.enabled).toBe(true);
    expect(status.lastSyncTime).toBeNull();
    expect(status.pendingPush).toBe(false);
  });

  it('sync pulls and pushes', async () => {
    const engine = new SyncEngine(backend);
    const status = await engine.sync();

    expect(backend.pull).toHaveBeenCalledOnce();
    expect(backend.push).toHaveBeenCalledOnce();
    expect(status.state).toBe('synced');
    expect(status.lastSyncTime).not.toBeNull();
  });

  it('emits events during sync', async () => {
    const engine = new SyncEngine(backend);
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    await engine.sync();

    const types = events.map((e) => e.type);
    expect(types).toContain('sync-start');
    expect(types).toContain('pull-start');
    expect(types).toContain('pull-complete');
    expect(types).toContain('push-start');
    expect(types).toContain('push-complete');
    expect(types).toContain('sync-complete');
  });

  it('handles pull conflicts', async () => {
    (backend.pull as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      conflicts: ['pages/test.md'],
    });

    const engine = new SyncEngine(backend);
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    const status = await engine.sync();

    expect(status.state).toBe('conflict');
    expect(status.conflicts).toContain('pages/test.md');
    expect(backend.push).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === 'conflict')).toBe(true);
  });

  it('handles push failure', async () => {
    (backend.push as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      refs: {},
    });

    const engine = new SyncEngine(backend);
    const status = await engine.sync();

    expect(status.state).toBe('error');
    expect(status.pendingPush).toBe(true);
  });

  it('handles network errors', async () => {
    (backend.pull as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network timeout'),
    );

    const engine = new SyncEngine(backend, { maxRetries: 1 });
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));

    const status = await engine.sync();

    expect(status.state).toBe('offline');
    expect(events.some((e) => e.type === 'offline')).toBe(true);
  });

  it('retries on network error', async () => {
    (backend.pull as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true, conflicts: [] });

    const engine = new SyncEngine(backend, { maxRetries: 3 });
    const status = await engine.sync();

    expect(status.state).toBe('synced');
    expect(backend.pull).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable error', async () => {
    (backend.pull as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('auth failed'),
    );

    const engine = new SyncEngine(backend, { maxRetries: 3 });
    await engine.sync();

    expect(backend.pull).toHaveBeenCalledTimes(1);
  });

  it('skips pull when autoPull is false', async () => {
    const engine = new SyncEngine(backend, { autoPull: false });
    await engine.sync();

    expect(backend.pull).not.toHaveBeenCalled();
    expect(backend.push).toHaveBeenCalledOnce();
  });

  it('skips push when autoPush is false and not dirty', async () => {
    const engine = new SyncEngine(backend, { autoPush: false });
    await engine.sync();

    expect(backend.pull).toHaveBeenCalledOnce();
    expect(backend.push).not.toHaveBeenCalled();
  });

  it('pushes when dirty even with autoPush false', async () => {
    const engine = new SyncEngine(backend, { autoPush: false });
    engine.markDirty();
    await engine.sync();

    expect(backend.push).toHaveBeenCalledOnce();
  });

  it('markDirty flags pending push', () => {
    const engine = new SyncEngine(backend);
    engine.markDirty();
    expect(engine.getStatus().pendingPush).toBe(true);
  });

  it('resolveConflicts clears conflict state', async () => {
    (backend.pull as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      conflicts: ['test.md'],
    });

    const engine = new SyncEngine(backend);
    await engine.sync();
    expect(engine.getStatus().state).toBe('conflict');

    engine.resolveConflicts();
    expect(engine.getStatus().state).toBe('idle');
    expect(engine.getStatus().conflicts).toHaveLength(0);
  });

  it('reportOnline transitions from offline to idle', async () => {
    (backend.pull as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network offline'),
    );
    const engine = new SyncEngine(backend, { maxRetries: 1 });

    await engine.sync();
    expect(engine.getStatus().state).toBe('offline');

    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));
    engine.reportOnline();

    expect(engine.getStatus().state).toBe('idle');
    expect(events.some((e) => e.type === 'online')).toBe(true);
  });

  it('setEnabled disables sync', () => {
    const engine = new SyncEngine(backend);
    engine.setEnabled(false);
    expect(engine.getStatus().enabled).toBe(false);
  });

  it('prevents concurrent syncs', async () => {
    // Slow pull
    (backend.pull as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, conflicts: [] }), 100)),
    );

    const engine = new SyncEngine(backend);
    const p1 = engine.sync();
    const p2 = engine.sync();

    vi.advanceTimersByTime(200);
    await Promise.all([p1, p2]);

    expect(backend.pull).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from events', async () => {
    const engine = new SyncEngine(backend);
    const events: SyncEvent[] = [];
    const unsub = engine.on((e) => events.push(e));

    unsub();
    await engine.sync();

    expect(events).toHaveLength(0);
  });

  it('dispose stops and clears listeners', async () => {
    const engine = new SyncEngine(backend);
    const events: SyncEvent[] = [];
    engine.on((e) => events.push(e));
    engine.start();

    engine.dispose();
    await engine.sync();

    expect(events).toHaveLength(0);
  });

  it('start begins interval timer', () => {
    const engine = new SyncEngine(backend, { intervalMs: 1000 });
    engine.start();

    vi.advanceTimersByTime(3000);
    // sync should have been called by interval
    expect(backend.pull).toHaveBeenCalled();

    engine.dispose();
  });

  it('start does nothing when disabled', () => {
    const engine = new SyncEngine(backend, { enabled: false, intervalMs: 1000 });
    engine.start();

    vi.advanceTimersByTime(3000);
    expect(backend.pull).not.toHaveBeenCalled();
  });
});
