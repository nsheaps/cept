import { describe, expect, it } from 'vitest';
import {
  SyncError,
  classifyPushReason,
  classifyPushReasons,
  classifySyncError,
  conflictPaths,
  isRetryableSyncError,
} from './sync-errors.js';

/** An error shaped like isomorphic-git's: `code`, `name` and `data`. */
function gitError(code: string, data: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(`${code} happened`), { code, name: code, data });
}

describe('classifySyncError', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'auth'],
    [413, 'quota'],
    [429, 'server'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unknown'],
  ] as const)('classifies HTTP %i as %s', (statusCode, kind) => {
    expect(classifySyncError(gitError('HttpError', { statusCode }))).toBe(kind);
  });

  it('classifies a rejected non-fast-forward push', () => {
    expect(classifySyncError(gitError('PushRejectedError', { reason: 'not-fast-forward' }))).toBe(
      'not-fast-forward',
    );
    expect(classifySyncError(gitError('PushRejectedError', { reason: 'tag-exists' }))).toBe(
      'rejected',
    );
    expect(classifySyncError(gitError('FastForwardError'))).toBe('not-fast-forward');
  });

  it('classifies a push the server refused from its per-ref reasons', () => {
    const refused = (error: string) =>
      gitError('GitPushError', {
        prettyDetails: error,
        result: { ok: false, refs: { 'refs/heads/main': { ok: false, error } } },
      });
    expect(classifySyncError(refused('protected branch hook declined'))).toBe('protected-branch');
    expect(classifySyncError(refused('GH006: Protected branch update failed'))).toBe(
      'protected-branch',
    );
    expect(classifySyncError(refused('GH001: Large files detected'))).toBe('quota');
    expect(classifySyncError(refused('pre-receive hook declined'))).toBe('rejected');
    expect(classifySyncError(gitError('GitPushError', {}))).toBe('rejected');
  });

  it.each(['MergeConflictError', 'MergeNotSupportedError', 'CheckoutConflictError'])(
    'classifies %s as a conflict',
    (code) => {
      expect(classifySyncError(gitError(code, { filepaths: ['a.md'] }))).toBe('conflict');
    },
  );

  it('classifies unreachable networks', () => {
    expect(classifySyncError(new TypeError('Failed to fetch'))).toBe('offline');
    expect(classifySyncError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(
      'offline',
    );
  });

  it('classifies a full local store as quota', () => {
    const full = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    expect(classifySyncError(full)).toBe('quota');
  });

  it('does not read message text', () => {
    expect(classifySyncError(new Error('network timeout while fetching (offline)'))).toBe(
      'unknown',
    );
    expect(classifySyncError(new Error('merge conflict in a.md'))).toBe('unknown');
    expect(classifySyncError('a string')).toBe('unknown');
    expect(classifySyncError(null)).toBe('unknown');
  });

  it('keeps the kind of a SyncError', () => {
    expect(classifySyncError(new SyncError('protected-branch', 'no'))).toBe('protected-branch');
  });
});

describe('classifyPushReasons', () => {
  it('picks the most specific reason across refs', () => {
    expect(classifyPushReasons(['fetch first', 'protected branch hook declined'])).toBe(
      'protected-branch',
    );
    expect(classifyPushReasons(['non-fast-forward', undefined])).toBe('not-fast-forward');
    expect(classifyPushReasons([undefined])).toBe('rejected');
    expect(classifyPushReasons([])).toBe('rejected');
    expect(classifyPushReason('[rejected] main -> main (fetch first)')).toBe('not-fast-forward');
  });
});

describe('conflictPaths', () => {
  it('reads the files a conflict names', () => {
    expect(
      conflictPaths(gitError('MergeConflictError', { filepaths: ['a.md', 3, 'b.md'] })),
    ).toEqual(['a.md', 'b.md']);
    expect(conflictPaths(new SyncError('conflict', 'x', ['c.md']))).toEqual(['c.md']);
    expect(conflictPaths(new Error('x'))).toEqual([]);
  });
});

describe('isRetryableSyncError', () => {
  it('retries only offline and temporary server failures', () => {
    expect(isRetryableSyncError('offline')).toBe(true);
    expect(isRetryableSyncError('server')).toBe(true);
    for (const kind of ['auth', 'quota', 'conflict', 'not-fast-forward', 'unknown'] as const) {
      expect(isRetryableSyncError(kind)).toBe(false);
    }
  });
});
