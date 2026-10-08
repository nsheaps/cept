import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncIndicator, formatLastSynced } from './SyncIndicator.js';
import type { GitSyncStatus } from '../storage/useGitSpaceSync.js';

const NOW = 1_700_000_000_000;

function status(over: Partial<GitSyncStatus> = {}): GitSyncStatus {
  return {
    state: 'synced',
    pending: 0,
    unpushed: 0,
    lastSyncTime: null,
    lastError: null,
    lastErrorKind: null,
    conflicts: [],
    ...over,
  };
}

describe('formatLastSynced', () => {
  it('describes how long ago', () => {
    expect(formatLastSynced(NOW - 5_000, NOW)).toBe('just now');
    expect(formatLastSynced(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(formatLastSynced(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago');
  });
});

describe('SyncIndicator', () => {
  it.each([
    ['idle', 'Not synced yet'],
    ['syncing', 'Syncing…'],
    ['synced', 'Synced'],
    ['offline', 'Offline'],
    ['conflict', 'Conflict'],
    ['error', 'Sync failed'],
  ] as const)('shows the %s state', (state, label) => {
    render(<SyncIndicator status={status({ state })} onSyncNow={() => undefined} now={NOW} />);
    expect(screen.getByTestId('sync-state').textContent).toBe(label);
    expect(screen.getByTestId('sync-indicator').getAttribute('data-state')).toBe(state);
  });

  it('counts pending edits and unpushed commits as local changes', () => {
    render(
      <SyncIndicator
        status={status({ pending: 2, unpushed: 1 })}
        onSyncNow={() => undefined}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('sync-local-changes').textContent).toBe('3 unsynced');
  });

  it('hides the local change count when everything is on GitHub', () => {
    render(<SyncIndicator status={status()} onSyncNow={() => undefined} now={NOW} />);
    expect(screen.queryByTestId('sync-local-changes')).toBeNull();
  });

  it('shows when it last synced', () => {
    render(
      <SyncIndicator
        status={status({ lastSyncTime: NOW - 2 * 60_000 })}
        onSyncNow={() => undefined}
        now={NOW}
      />,
    );
    expect(screen.getByTestId('sync-last-synced').textContent).toBe('2 min ago');
  });

  it('"Sync now" runs a sync', () => {
    const onSyncNow = vi.fn();
    render(<SyncIndicator status={status()} onSyncNow={onSyncNow} now={NOW} />);
    const button = screen.getByTestId('sync-now');
    expect(button.textContent).toBe('Sync now');
    fireEvent.click(button);
    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('disables "Sync now" while a manual sync runs and shows syncing', () => {
    render(<SyncIndicator status={status()} syncing onSyncNow={() => undefined} now={NOW} />);
    expect((screen.getByTestId('sync-now') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('sync-state').textContent).toBe('Syncing…');
  });

  it('disables "Sync now" while the session opens', () => {
    render(<SyncIndicator status={null} onSyncNow={() => undefined} now={NOW} />);
    expect((screen.getByTestId('sync-now') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers to resolve a conflict (REQ-WS-026)', () => {
    const onResolve = vi.fn();
    const { rerender } = render(
      <SyncIndicator
        status={status()}
        onSyncNow={() => undefined}
        onResolveConflicts={onResolve}
      />,
    );
    expect(screen.queryByTestId('sync-resolve-conflicts')).toBeNull();
    rerender(
      <SyncIndicator
        status={status({ state: 'conflict' })}
        onSyncNow={() => undefined}
        onResolveConflicts={onResolve}
      />,
    );
    fireEvent.click(screen.getByTestId('sync-resolve-conflicts'));
    expect(onResolve).toHaveBeenCalledOnce();
  });

  it('offers to push to a new branch when the remote refused the push', () => {
    const onPush = vi.fn();
    const { rerender } = render(
      <SyncIndicator
        status={status({ state: 'error', lastErrorKind: 'auth' })}
        onSyncNow={() => undefined}
        onPushToNewBranch={onPush}
      />,
    );
    expect(screen.queryByTestId('sync-push-new-branch')).toBeNull();
    rerender(
      <SyncIndicator
        status={status({ state: 'error', lastErrorKind: 'protected-branch' })}
        onSyncNow={() => undefined}
        onPushToNewBranch={onPush}
      />,
    );
    fireEvent.click(screen.getByTestId('sync-push-new-branch'));
    expect(onPush).toHaveBeenCalledOnce();
  });

  it('asks to sign in when the space is locked', () => {
    const onSignIn = vi.fn();
    render(<SyncIndicator status={null} locked onSyncNow={() => undefined} onSignIn={onSignIn} />);
    expect(screen.getByTestId('sync-state').textContent).toContain('sign in to edit');
    expect(screen.queryByTestId('sync-now')).toBeNull();
    fireEvent.click(screen.getByTestId('sync-sign-in'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
