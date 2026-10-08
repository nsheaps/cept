import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { BrowserFsBackend } from '../storage/browser-fs.js';
import {
  DEFAULT_SYNC_SETTINGS,
  SYNC_SETTINGS_PATH,
  commitIdentityFor,
  fallbackBranchName,
  loadSyncSettings,
  parseSyncSettings,
  saveSyncSettings,
  serializeSyncSettings,
  trackedBranch,
  withExcludeLine,
} from './sync-policy.js';

describe('commitIdentityFor', () => {
  it('uses the display name and the id-based noreply address', () => {
    expect(commitIdentityFor({ login: 'octo', id: 583231, name: 'Octo Cat' })).toEqual({
      name: 'Octo Cat',
      email: '583231+octo@users.noreply.github.com',
    });
  });

  it('falls back to the login when there is no name', () => {
    expect(commitIdentityFor({ login: 'octo', id: 1, name: null }).name).toBe('octo');
    expect(commitIdentityFor({ login: 'octo', id: 1, name: '   ' }).name).toBe('octo');
  });

  it('uses the login-only noreply form without an id', () => {
    expect(commitIdentityFor({ login: 'octo' }).email).toBe('octo@users.noreply.github.com');
  });
});

describe('trackedBranch', () => {
  it('uses the declared branch, otherwise the default branch', () => {
    expect(trackedBranch({ branch: 'notes' }, 'main')).toBe('notes');
    expect(trackedBranch({}, 'main')).toBe('main');
    expect(trackedBranch({ branch: '  ' }, 'trunk')).toBe('trunk');
    expect(trackedBranch(null, 'main')).toBe('main');
  });
});

describe('sync settings', () => {
  it('defaults to auto-commit after 5 s and sync every 30 s', () => {
    expect(parseSyncSettings(null)).toEqual({
      autoCommit: true,
      debounceMs: 5000,
      intervalMs: 30000,
      autoPush: true,
    });
  });

  it('keeps valid values and replaces invalid ones with defaults, one by one', () => {
    const text = JSON.stringify({ autoCommit: false, debounceMs: 10, intervalMs: 60000, x: 1 });
    expect(parseSyncSettings(text)).toEqual({
      ...DEFAULT_SYNC_SETTINGS,
      autoCommit: false,
      intervalMs: 60000,
    });
  });

  it('ignores a damaged file', () => {
    expect(parseSyncSettings('{not json')).toEqual(DEFAULT_SYNC_SETTINGS);
    expect(parseSyncSettings('[1,2]')).toEqual(DEFAULT_SYNC_SETTINGS);
  });

  it('round-trips through the space backend under .cept/', async () => {
    const backend = new BrowserFsBackend(`sync-settings-${crypto.randomUUID()}`);
    await backend.initialize({ name: 'Test' });
    const settings = { ...DEFAULT_SYNC_SETTINGS, autoPush: false, debounceMs: 2000 };

    await saveSyncSettings(backend, settings, 'notes/');
    expect(await backend.exists(`notes/${SYNC_SETTINGS_PATH}`)).toBe(true);
    expect(await loadSyncSettings(backend, 'notes')).toEqual(settings);
    expect(await loadSyncSettings(backend)).toEqual(DEFAULT_SYNC_SETTINGS);
    expect(serializeSyncSettings(settings).endsWith('\n')).toBe(true);
    await backend.close();
  });
});

describe('withExcludeLine', () => {
  it('appends the pattern once', () => {
    expect(withExcludeLine('', '.cept/sync.local.json')).toBe('.cept/sync.local.json\n');
    expect(withExcludeLine('# comment', 'x')).toBe('# comment\nx\n');
    const once = withExcludeLine('a\n', 'x');
    expect(withExcludeLine(once, 'x')).toBe(once);
  });
});

describe('fallbackBranchName (REQ-WS-026)', () => {
  it('names the branch after the login, the UTC date and the short commit id', () => {
    const date = new Date('2026-10-08T23:30:00Z');
    expect(fallbackBranchName('octo', date, '0123456789abcdef')).toBe(
      'cept/octo/2026-10-08-0123456',
    );
  });

  it('replaces characters a branch name may not hold', () => {
    const date = new Date('2026-01-02T00:00:00Z');
    expect(fallbackBranchName('a b~c', date, 'abcdef1234')).toBe('cept/a-b-c/2026-01-02-abcdef1');
    expect(fallbackBranchName('..', date, 'abcdef1234')).toBe('cept/cept/2026-01-02-abcdef1');
  });
});
