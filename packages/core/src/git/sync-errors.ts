/**
 * Sync error classification (REQ-WS-027).
 *
 * Errors are classified from structured fields — isomorphic-git's `code` and
 * `data`, HTTP status codes, DOMException names and Node error codes — never by
 * searching an error's message text.
 */

/**
 * - `offline`: the network or the server could not be reached.
 * - `server`: the server answered with a temporary failure (429 or 5xx).
 * - `auth`: the sign-in was refused or cannot see the repository (401, 403, 404).
 * - `not-fast-forward`: the remote branch moved; pull before pushing.
 * - `protected-branch`: the remote refused a push to a protected branch.
 * - `quota`: a size limit was hit, on the server or in local storage.
 * - `conflict`: a merge stopped on conflicting changes.
 * - `rejected`: the remote refused the push for another reason.
 * - `unknown`: anything else.
 */
export type SyncErrorKind =
  | 'offline'
  | 'server'
  | 'auth'
  | 'not-fast-forward'
  | 'protected-branch'
  | 'quota'
  | 'conflict'
  | 'rejected'
  | 'unknown';

/** An error raised by the sync policy itself, carrying its kind. */
export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
    readonly paths: string[] = [],
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
]);

const CONFLICT_CODES = new Set([
  'MergeConflictError',
  'MergeNotSupportedError',
  'CheckoutConflictError',
  'UnmergedPathsError',
]);

/** Push results report each ref's server reason; GitHub's are stable codes. */
export function classifyPushReason(reason: string): SyncErrorKind {
  const r = reason.toLowerCase();
  if (r.includes('gh006') || r.includes('protected branch')) return 'protected-branch';
  if (r.includes('non-fast-forward') || r.includes('fetch first')) return 'not-fast-forward';
  if (r.includes('gh001') || r.includes('large files') || r.includes('exceeds')) return 'quota';
  return 'rejected';
}

function fieldOf(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function kindOfStatus(status: number): SyncErrorKind {
  if (status === 401 || status === 403 || status === 404) return 'auth';
  if (status === 413) return 'quota';
  if (status === 429 || status >= 500) return 'server';
  return 'unknown';
}

/** The kind of a sync failure. */
export function classifySyncError(error: unknown): SyncErrorKind {
  if (error instanceof SyncError) return error.kind;
  const code = fieldOf(error, 'code');
  const name = fieldOf(error, 'name');
  const data = fieldOf(error, 'data');

  if (code === 'HttpError') {
    const status = fieldOf(data, 'statusCode');
    return typeof status === 'number' ? kindOfStatus(status) : 'unknown';
  }
  if (code === 'PushRejectedError') {
    return fieldOf(data, 'reason') === 'not-fast-forward' ? 'not-fast-forward' : 'rejected';
  }
  if (code === 'FastForwardError') return 'not-fast-forward';
  if (code === 'GitPushError') {
    const refs = fieldOf(fieldOf(data, 'result'), 'refs');
    const reasons = Object.values(typeof refs === 'object' && refs ? refs : {})
      .map((ref) => fieldOf(ref, 'error'))
      .filter((e): e is string => typeof e === 'string');
    return classifyPushReasons(reasons);
  }
  if (typeof code === 'string' && CONFLICT_CODES.has(code)) return 'conflict';
  if (typeof code === 'string' && NETWORK_CODES.has(code)) return 'offline';
  if (name === 'QuotaExceededError') return 'quota';
  // fetch() rejects with a bare TypeError when the request never reaches a server.
  if (error instanceof TypeError && code === undefined) return 'offline';
  return 'unknown';
}

const PUSH_PRIORITY: SyncErrorKind[] = ['protected-branch', 'quota', 'not-fast-forward'];

/** The most specific kind among several refs' push reasons (`rejected` when none says more). */
export function classifyPushReasons(reasons: readonly (string | undefined)[]): SyncErrorKind {
  const kinds = reasons.map((r) => (r ? classifyPushReason(r) : 'rejected'));
  return PUSH_PRIORITY.find((k) => kinds.includes(k)) ?? 'rejected';
}

/** Files named by a conflict error, if any. */
export function conflictPaths(error: unknown): string[] {
  if (error instanceof SyncError) return [...error.paths];
  const paths = fieldOf(fieldOf(error, 'data'), 'filepaths');
  return Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string') : [];
}

/** Whether retrying the same operation may succeed. */
export function isRetryableSyncError(kind: SyncErrorKind): boolean {
  return kind === 'offline' || kind === 'server';
}
