import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AutoCommitEngine,
  generateCommitMessage,
  matchesPattern,
} from './auto-commit.js';
import type { AutoCommitEvent } from './auto-commit.js';
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
    commit: vi.fn(async () => 'abc123'),
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

describe('matchesPattern', () => {
  it('matches exact path', () => {
    expect(matchesPattern('foo.txt', 'foo.txt')).toBe(true);
  });

  it('matches single wildcard', () => {
    expect(matchesPattern('src/foo.ts', 'src/*.ts')).toBe(true);
    expect(matchesPattern('src/foo.js', 'src/*.ts')).toBe(false);
  });

  it('matches double wildcard', () => {
    expect(matchesPattern('.git/objects/abc', '.git/**')).toBe(true);
    expect(matchesPattern('.git/HEAD', '.git/**')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(matchesPattern('src/main.ts', '.git/**')).toBe(false);
  });

  it('matches nested paths with double wildcard', () => {
    expect(matchesPattern('a/b/c/d.txt', '**/*.txt')).toBe(true);
  });
});

describe('generateCommitMessage', () => {
  it('handles empty changes', () => {
    expect(generateCommitMessage([])).toBe('Empty commit');
  });

  it('single add', () => {
    const msg = generateCommitMessage([
      { path: 'pages/hello.md', type: 'add', timestamp: 0 },
    ]);
    expect(msg).toBe('Add pages/hello.md');
  });

  it('multiple adds', () => {
    const msg = generateCommitMessage([
      { path: 'a.md', type: 'add', timestamp: 0 },
      { path: 'b.md', type: 'add', timestamp: 0 },
    ]);
    expect(msg).toBe('Add 2 files');
  });

  it('single modify', () => {
    const msg = generateCommitMessage([
      { path: 'pages/about.md', type: 'modify', timestamp: 0 },
    ]);
    expect(msg).toBe('Update pages/about.md');
  });

  it('single delete', () => {
    const msg = generateCommitMessage([
      { path: 'old/file.md', type: 'delete', timestamp: 0 },
    ]);
    expect(msg).toBe('Delete old/file.md');
  });

  it('mixed changes', () => {
    const msg = generateCommitMessage([
      { path: 'a.md', type: 'add', timestamp: 0 },
      { path: 'b.md', type: 'modify', timestamp: 0 },
      { path: 'c.md', type: 'delete', timestamp: 0 },
    ]);
    expect(msg).toBe('Add a.md, Update b.md, Delete c.md');
  });

  it('shortens deep paths', () => {
    const msg = generateCommitMessage([
      { path: 'workspace/pages/deep/nested/file.md', type: 'modify', timestamp: 0 },
    ]);
    expect(msg).toBe('Update nested/file.md');
  });
});

describe('AutoCommitEngine', () => {
  let backend: GitStorageBackend;

  beforeEach(() => {
    vi.useFakeTimers();
    backend = createMockBackend();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates engine with default config', () => {
    const engine = new AutoCommitEngine(backend);
    const status = engine.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.pendingChanges).toBe(0);
    expect(status.lastCommitHash).toBeNull();
  });

  it('records changes', () => {
    const engine = new AutoCommitEngine(backend);
    engine.recordChange('pages/test.md', 'add');
    expect(engine.getStatus().pendingChanges).toBe(1);
    expect(engine.getPendingChanges()[0].path).toBe('pages/test.md');
  });

  it('deduplicates changes to same path', () => {
    const engine = new AutoCommitEngine(backend);
    engine.recordChange('pages/test.md', 'add');
    engine.recordChange('pages/test.md', 'modify');
    expect(engine.getStatus().pendingChanges).toBe(1);
    expect(engine.getPendingChanges()[0].type).toBe('modify');
  });

  it('excludes .git paths', () => {
    const engine = new AutoCommitEngine(backend);
    engine.recordChange('.git/HEAD', 'modify');
    expect(engine.getStatus().pendingChanges).toBe(0);
  });

  it('excludes custom patterns', () => {
    const engine = new AutoCommitEngine(backend, {
      excludePatterns: ['*.tmp', 'node_modules/**'],
    });
    engine.recordChange('file.tmp', 'add');
    engine.recordChange('node_modules/pkg/index.js', 'modify');
    expect(engine.getStatus().pendingChanges).toBe(0);
  });

  it('does not record when disabled', () => {
    const engine = new AutoCommitEngine(backend, { enabled: false });
    engine.recordChange('test.md', 'add');
    expect(engine.getStatus().pendingChanges).toBe(0);
  });

  it('commits after debounce', async () => {
    const engine = new AutoCommitEngine(backend, { debounceMs: 100 });
    engine.recordChange('test.md', 'add');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(backend.commit).toHaveBeenCalledOnce();
    expect(engine.getStatus().pendingChanges).toBe(0);
  });

  it('resets timer on new changes', () => {
    const engine = new AutoCommitEngine(backend, { debounceMs: 100 });
    engine.recordChange('a.md', 'add');
    vi.advanceTimersByTime(80);
    engine.recordChange('b.md', 'add');
    vi.advanceTimersByTime(80);
    expect(backend.commit).not.toHaveBeenCalled();
  });

  it('flushes immediately when batch full', async () => {
    const engine = new AutoCommitEngine(backend, { maxBatchSize: 3, debounceMs: 10000 });
    engine.recordChange('a.md', 'add');
    engine.recordChange('b.md', 'add');
    engine.recordChange('c.md', 'add');

    await vi.runAllTimersAsync();

    expect(backend.commit).toHaveBeenCalledOnce();
    expect(engine.getStatus().pendingChanges).toBe(0);
  });

  it('flushNow commits immediately', async () => {
    const engine = new AutoCommitEngine(backend, { debounceMs: 10000 });
    engine.recordChange('test.md', 'modify');

    const hash = await engine.flushNow();
    expect(hash).toBe('abc123');
    expect(backend.commit).toHaveBeenCalledOnce();
    expect(engine.getStatus().lastCommitHash).toBe('abc123');
    expect(engine.getStatus().lastCommitTime).not.toBeNull();
  });

  it('flushNow returns null when no changes', async () => {
    const engine = new AutoCommitEngine(backend);
    const hash = await engine.flushNow();
    expect(hash).toBeNull();
    expect(backend.commit).not.toHaveBeenCalled();
  });

  it('re-adds changes on commit failure', async () => {
    (backend.commit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const engine = new AutoCommitEngine(backend);
    engine.recordChange('test.md', 'add');

    await engine.flushNow();
    expect(engine.getStatus().pendingChanges).toBe(1);
  });

  it('generates correct commit message', async () => {
    const engine = new AutoCommitEngine(backend);
    engine.recordChange('pages/hello.md', 'add');
    engine.recordChange('pages/world.md', 'modify');

    await engine.flushNow();
    expect(backend.commit).toHaveBeenCalledWith(
      'Add pages/hello.md, Update pages/world.md',
      ['pages/hello.md', 'pages/world.md'],
    );
  });

  it('uses custom message generator', async () => {
    const engine = new AutoCommitEngine(backend, {
      messageGenerator: (changes) => `Custom: ${changes.length} changes`,
    });
    engine.recordChange('a.md', 'add');
    await engine.flushNow();
    expect(backend.commit).toHaveBeenCalledWith('Custom: 1 changes', ['a.md']);
  });

  it('emits events', async () => {
    const engine = new AutoCommitEngine(backend);
    const events: AutoCommitEvent[] = [];
    engine.on((e) => events.push(e));

    engine.recordChange('test.md', 'add');
    expect(events[0].type).toBe('change-detected');

    await engine.flushNow();
    expect(events[1].type).toBe('commit');
    expect(events[1].commitHash).toBe('abc123');
  });

  it('emits error events', async () => {
    (backend.commit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const engine = new AutoCommitEngine(backend);
    const events: AutoCommitEvent[] = [];
    engine.on((e) => events.push(e));

    engine.recordChange('test.md', 'add');
    await engine.flushNow();

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error!.message).toBe('fail');
  });

  it('emits batch-full event', () => {
    const engine = new AutoCommitEngine(backend, { maxBatchSize: 2 });
    const events: AutoCommitEvent[] = [];
    engine.on((e) => events.push(e));

    engine.recordChange('a.md', 'add');
    engine.recordChange('b.md', 'add');

    expect(events.some((e) => e.type === 'batch-full')).toBe(true);
  });

  it('unsubscribes from events', () => {
    const engine = new AutoCommitEngine(backend);
    const events: AutoCommitEvent[] = [];
    const unsub = engine.on((e) => events.push(e));

    engine.recordChange('a.md', 'add');
    expect(events).toHaveLength(1);

    unsub();
    engine.recordChange('b.md', 'add');
    expect(events).toHaveLength(1);
  });

  it('setEnabled toggles auto-commit', () => {
    const engine = new AutoCommitEngine(backend);
    engine.setEnabled(false);
    expect(engine.getStatus().enabled).toBe(false);
    engine.recordChange('test.md', 'add');
    expect(engine.getStatus().pendingChanges).toBe(0);

    engine.setEnabled(true);
    engine.recordChange('test.md', 'add');
    expect(engine.getStatus().pendingChanges).toBe(1);
  });

  it('dispose cancels timer and clears listeners', () => {
    const engine = new AutoCommitEngine(backend, { debounceMs: 100 });
    const events: AutoCommitEvent[] = [];
    engine.on((e) => events.push(e));

    engine.recordChange('test.md', 'add');
    engine.dispose();

    vi.advanceTimersByTime(200);
    expect(backend.commit).not.toHaveBeenCalled();
  });
});
