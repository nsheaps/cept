import { describe, it, expect, vi } from 'vitest';
import {
  generateBranchName,
  isCeptBranch,
  parseBranchName,
  listCeptBranches,
  generateDeviceId,
  generateSessionId,
  BranchStrategyManager,
} from './branch-strategy.js';
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
    branch: {
      create: vi.fn(async () => {}),
      switch: vi.fn(async () => {}),
      merge: vi.fn(async () => ({ ok: true, conflicts: [] })),
      list: vi.fn(async () => [
        { name: 'main', current: true },
        { name: 'cept/device-abc12345', current: false },
        { name: 'cept/session-2026-03-04-xyz123', current: false },
        { name: 'feature/unrelated', current: false },
      ]),
      current: vi.fn(async () => 'main'),
      delete: vi.fn(async () => {}),
    },
    remote: {
      add: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(async () => []),
    },
    commit: vi.fn(async () => 'sha'),
    push: vi.fn(async () => ({ ok: true, refs: {} })),
    pull: vi.fn(async () => ({ ok: true, conflicts: [] })),
    log: vi.fn(async () => []),
    diff: vi.fn(async () => ({ files: [] })),
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

describe('generateBranchName', () => {
  it('returns main for single strategy', () => {
    expect(generateBranchName({ strategy: 'single' })).toBe('main');
  });

  it('returns custom main branch for single strategy', () => {
    expect(generateBranchName({ strategy: 'single', mainBranch: 'trunk' })).toBe('trunk');
  });

  it('returns device branch with device ID', () => {
    const name = generateBranchName({ strategy: 'per-device', deviceId: 'mydevice' });
    expect(name).toBe('cept/device-mydevice');
  });

  it('generates device ID when not provided', () => {
    const name = generateBranchName({ strategy: 'per-device' });
    expect(name).toMatch(/^cept\/device-[a-z0-9]{8}$/);
  });

  it('returns session branch with date', () => {
    const name = generateBranchName({ strategy: 'per-session' });
    expect(name).toMatch(/^cept\/session-\d{4}-\d{2}-\d{2}-[a-z0-9]{6}$/);
  });

  it('uses custom prefix', () => {
    const name = generateBranchName({ strategy: 'per-device', deviceId: 'abc', prefix: 'workspace/' });
    expect(name).toBe('workspace/device-abc');
  });
});

describe('isCeptBranch', () => {
  it('identifies cept branches', () => {
    expect(isCeptBranch('cept/device-abc')).toBe(true);
    expect(isCeptBranch('cept/session-2026-03-04-xyz')).toBe(true);
  });

  it('rejects non-cept branches', () => {
    expect(isCeptBranch('main')).toBe(false);
    expect(isCeptBranch('feature/thing')).toBe(false);
  });

  it('uses custom prefix', () => {
    expect(isCeptBranch('ws/device-abc', 'ws/')).toBe(true);
    expect(isCeptBranch('cept/device-abc', 'ws/')).toBe(false);
  });
});

describe('parseBranchName', () => {
  it('parses device branch', () => {
    const info = parseBranchName('cept/device-abc12345');
    expect(info).not.toBeNull();
    expect(info!.strategy).toBe('per-device');
    expect(info!.isMainBranch).toBe(false);
  });

  it('parses session branch', () => {
    const info = parseBranchName('cept/session-2026-03-04-xyz');
    expect(info).not.toBeNull();
    expect(info!.strategy).toBe('per-session');
  });

  it('returns null for non-cept branch', () => {
    expect(parseBranchName('main')).toBeNull();
    expect(parseBranchName('feature/thing')).toBeNull();
  });

  it('returns null for unknown cept branch type', () => {
    expect(parseBranchName('cept/unknown-type')).toBeNull();
  });
});

describe('listCeptBranches', () => {
  it('lists only cept branches', async () => {
    const backend = createMockBackend();
    const branches = await listCeptBranches(backend);
    expect(branches).toHaveLength(2);
    expect(branches[0].name).toBe('cept/device-abc12345');
    expect(branches[1].name).toBe('cept/session-2026-03-04-xyz123');
  });
});

describe('generateDeviceId', () => {
  it('generates 8-character ID', () => {
    const id = generateDeviceId();
    expect(id).toMatch(/^[a-z0-9]{8}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateDeviceId()));
    expect(ids.size).toBeGreaterThan(90);
  });
});

describe('generateSessionId', () => {
  it('generates 6-character ID', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe('BranchStrategyManager', () => {
  it('returns main for single strategy', () => {
    const backend = createMockBackend();
    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    expect(manager.getBranchName()).toBe('main');
    expect(manager.getStrategy()).toBe('single');
    expect(manager.getMainBranch()).toBe('main');
  });

  it('ensureBranch returns main for single strategy', async () => {
    const backend = createMockBackend();
    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    const branch = await manager.ensureBranch();
    expect(branch).toBe('main');
    expect(backend.branch.create).not.toHaveBeenCalled();
  });

  it('ensureBranch creates device branch if missing', async () => {
    const backend = createMockBackend();
    (backend.branch.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'main', current: true },
    ]);
    const manager = new BranchStrategyManager(backend, {
      strategy: 'per-device',
      deviceId: 'newdev',
    });

    const branch = await manager.ensureBranch();
    expect(branch).toBe('cept/device-newdev');
    expect(backend.branch.create).toHaveBeenCalledWith('cept/device-newdev', 'main');
    expect(backend.branch.switch).toHaveBeenCalledWith('cept/device-newdev');
  });

  it('ensureBranch reuses existing branch', async () => {
    const backend = createMockBackend();
    (backend.branch.list as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'main', current: false },
      { name: 'cept/device-existing', current: true },
    ]);
    (backend.branch.current as ReturnType<typeof vi.fn>).mockResolvedValue('cept/device-existing');

    const manager = new BranchStrategyManager(backend, {
      strategy: 'per-device',
      deviceId: 'existing',
    });

    await manager.ensureBranch();
    expect(backend.branch.create).not.toHaveBeenCalled();
    // Already on correct branch, no switch needed
    expect(backend.branch.switch).not.toHaveBeenCalled();
  });

  it('mergeToMain is no-op for single strategy', async () => {
    const backend = createMockBackend();
    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    const result = await manager.mergeToMain();
    expect(result.ok).toBe(true);
    expect(backend.branch.merge).not.toHaveBeenCalled();
  });

  it('mergeToMain merges device branch into main', async () => {
    const backend = createMockBackend();
    const manager = new BranchStrategyManager(backend, {
      strategy: 'per-device',
      deviceId: 'dev1',
    });

    await manager.ensureBranch();
    const result = await manager.mergeToMain();

    expect(result.ok).toBe(true);
    expect(backend.branch.switch).toHaveBeenCalledWith('main');
    expect(backend.branch.merge).toHaveBeenCalledWith('cept/device-dev1', 'main');
  });

  it('mergeToMain switches back on conflict', async () => {
    const backend = createMockBackend();
    (backend.branch.merge as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      conflicts: ['pages/test.md'],
    });

    const manager = new BranchStrategyManager(backend, {
      strategy: 'per-device',
      deviceId: 'dev1',
    });

    await manager.ensureBranch();
    const result = await manager.mergeToMain();

    expect(result.ok).toBe(false);
    // Should switch back to device branch
    const switchCalls = (backend.branch.switch as ReturnType<typeof vi.fn>).mock.calls;
    expect(switchCalls[switchCalls.length - 1][0]).toBe('cept/device-dev1');
  });

  it('cleanup deletes merged cept branches', async () => {
    const backend = createMockBackend();
    (backend.branch.current as ReturnType<typeof vi.fn>).mockResolvedValue('main');

    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    const deleted = await manager.cleanup();

    expect(deleted).toContain('cept/device-abc12345');
    expect(deleted).toContain('cept/session-2026-03-04-xyz123');
    expect(deleted).not.toContain('feature/unrelated');
    expect(deleted).not.toContain('main');
  });

  it('cleanup skips current branch', async () => {
    const backend = createMockBackend();
    (backend.branch.current as ReturnType<typeof vi.fn>).mockResolvedValue('cept/device-abc12345');

    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    const deleted = await manager.cleanup();

    expect(deleted).not.toContain('cept/device-abc12345');
    expect(deleted).toContain('cept/session-2026-03-04-xyz123');
  });

  it('cleanup handles delete errors gracefully', async () => {
    const backend = createMockBackend();
    (backend.branch.current as ReturnType<typeof vi.fn>).mockResolvedValue('main');
    (backend.branch.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('unmerged'),
    );

    const manager = new BranchStrategyManager(backend, { strategy: 'single' });
    const deleted = await manager.cleanup();

    // First branch fails, second succeeds
    expect(deleted).toHaveLength(1);
  });
});
