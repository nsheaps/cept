/**
 * SyncIndicator — the sync state of the active GitHub space (REQ-WS-027):
 * idle, syncing, synced, offline, conflict or error, how many local changes
 * have not reached GitHub yet, when it last synced, and a "Sync now" action
 * (commit what is pending, pull, then push).
 *
 * Shown for a space by its state (writable GitHub space), never by backend
 * type. `locked` is a writable space with no editing session, for example
 * while signed out: it can be read but not edited until the user signs in.
 */

import type { GitSyncState, GitSyncStatus } from '../storage/useGitSpaceSync.js';

export interface SyncIndicatorProps {
  /** The session's status; null while it opens. */
  status: GitSyncStatus | null;
  /** The space cannot be edited here until the user signs in. */
  locked?: boolean;
  /** A manual sync is running. */
  syncing?: boolean;
  onSyncNow: () => void;
  /** Open the GitHub sign-in (shown when `locked`). */
  onSignIn?: () => void;
  /** The current time, for "last synced" (tests pass a fixed one). */
  now?: number;
}

const LABELS: Record<GitSyncState, string> = {
  idle: 'Not synced yet',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline',
  conflict: 'Conflict',
  error: 'Sync failed',
};

const DOT: Record<GitSyncState, string> = {
  idle: 'bg-gray-400',
  syncing: 'bg-blue-500',
  synced: 'bg-green-500',
  offline: 'bg-gray-400',
  conflict: 'bg-amber-500',
  error: 'bg-red-500',
};

/** "just now", "5 min ago", "3 h ago" or a date. */
export function formatLastSynced(time: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(time).toLocaleDateString();
}

export function SyncIndicator({
  status,
  locked = false,
  syncing = false,
  onSyncNow,
  onSignIn,
  now = Date.now(),
}: SyncIndicatorProps) {
  if (locked) {
    return (
      <div className="flex items-center gap-2 text-sm" data-testid="sync-indicator">
        <span className="inline-block w-2 h-2 rounded-full bg-gray-400" aria-hidden />
        <span data-testid="sync-state">Read-only: sign in to edit</span>
        {onSignIn && (
          <button
            className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 underline"
            onClick={onSignIn}
            data-testid="sync-sign-in"
          >
            Sign in
          </button>
        )}
      </div>
    );
  }

  const state: GitSyncState = syncing ? 'syncing' : (status?.state ?? 'idle');
  const local = status ? status.pending + status.unpushed : 0;
  const details: string[] = [];
  if (local > 0) details.push(`${local} local change${local === 1 ? '' : 's'} not on GitHub`);
  if (status?.lastSyncTime)
    details.push(`Last synced ${formatLastSynced(status.lastSyncTime, now)}`);
  if (status?.lastError && (state === 'error' || state === 'conflict'))
    details.push(status.lastError);

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="sync-indicator"
      data-state={state}
      title={details.join('\n') || undefined}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${DOT[state]}`} aria-hidden />
      <span data-testid="sync-state">{LABELS[state]}</span>
      {local > 0 && (
        <span
          className="text-xs text-gray-500 dark:text-gray-400"
          data-testid="sync-local-changes"
          title={details[0]}
        >
          {local} unsynced
        </span>
      )}
      {status?.lastSyncTime ? (
        <span
          className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400"
          data-testid="sync-last-synced"
        >
          {formatLastSynced(status.lastSyncTime, now)}
        </span>
      ) : null}
      <button
        className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
        onClick={onSyncNow}
        disabled={syncing || !status}
        data-testid="sync-now"
      >
        Sync now
      </button>
    </div>
  );
}
