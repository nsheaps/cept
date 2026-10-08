import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CommitInfo, DiffResult, GitBackend } from '@cept/core';
import { PageHistoryDialog } from './PageHistoryDialog.js';
import type { PageHistorySource } from '../storage/git-space.js';

function commit(n: number, parent?: number): CommitInfo {
  return {
    hash: `${n}`.repeat(40).slice(0, 40),
    message: `version ${n}`,
    author: { name: 'Octo', email: 'o@example.com', timestamp: 1_700_000_000 + n },
    parent: parent === undefined ? [] : [`${parent}`.repeat(40).slice(0, 40)],
  };
}

/** A repository with versions 1..count of `a.md`, newest first; `shallow` leaves out all but the newest. */
function fakeSource(count: number, options: { shallow?: boolean } = {}) {
  let shallow = options.shallow ?? false;
  const all = Array.from({ length: count }, (_, i) =>
    commit(count - i, count - i - 1 || undefined),
  );
  const git = {
    log: vi.fn(async (_path: string, { limit }: { limit: number }) =>
      (shallow ? all.slice(0, 1) : all).slice(0, limit),
    ),
    shallowCommits: vi.fn(async () => new Set(shallow ? [all[0]!.hash] : [])),
    diff: vi.fn(async (): Promise<DiffResult> => ({
      files: [{ path: 'a.md', type: 'modify', hunks: ['@@ -1 +1 @@\n-old\n+new'] }],
    })),
    readFileAt: vi.fn(async (hash: string) => `text of ${hash.slice(0, 1)}`),
    fetchFullHistory: vi.fn(async () => {
      shallow = false;
    }),
  };
  const source: PageHistorySource = {
    git: git as unknown as GitBackend,
    path: 'a.md',
    ref: 'main',
  };
  return { git, source, all };
}

const short = (c: CommitInfo) => `history-commit-${c.hash.slice(0, 7)}`;

describe('PageHistoryDialog', () => {
  it('lists versions, shows a diff and restores the selected version', async () => {
    const { source, all } = fakeSource(3);
    const onRestore = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore
        onRestore={onRestore}
        onClose={onClose}
      />,
    );

    fireEvent.click(await screen.findByTestId(short(all[1]!)));
    expect(await screen.findByTestId('history-diff-hunk')).toBeDefined();
    fireEvent.click(screen.getByTestId('history-restore-a.md'));

    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('text of 2'));
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open on an outside click while a restore runs', async () => {
    const { source, all } = fakeSource(3);
    let finish = () => {};
    const onRestore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore
        onRestore={onRestore}
        onClose={onClose}
      />,
    );

    fireEvent.click(await screen.findByTestId(short(all[1]!)));
    fireEvent.click(await screen.findByTestId('history-restore-a.md'));
    await waitFor(() => expect(onRestore).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('page-history-dialog'));
    expect(onClose).not.toHaveBeenCalled();

    finish();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows versions without restore in a read-only space', async () => {
    const { source, all } = fakeSource(2);
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore={false}
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('history-read-only')).toBeDefined();
    fireEvent.click(await screen.findByTestId(short(all[1]!)));
    expect(await screen.findByTestId('history-diff-hunk')).toBeDefined();
    expect(screen.queryByTestId('history-restore-a.md')).toBeNull();
  });

  it('pages a long history', async () => {
    const { source } = fakeSource(25);
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await screen.findByTestId('history-show-more');
    expect(screen.getAllByTestId('history-commit-message')).toHaveLength(20);
    fireEvent.click(screen.getByTestId('history-show-more'));
    await waitFor(() => expect(screen.getAllByTestId('history-commit-message')).toHaveLength(25));
    expect(screen.queryByTestId('history-show-more')).toBeNull();
  });

  it('downloads older versions of a shallow clone on request', async () => {
    const { source, git } = fakeSource(3, { shallow: true });
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByTestId('history-fetch-older'));
    await waitFor(() => expect(screen.getAllByTestId('history-commit-message')).toHaveLength(3));
    expect(git.fetchFullHistory).toHaveBeenCalledWith('main');
    expect(screen.queryByTestId('history-truncated')).toBeNull();
  });

  it('says when the changes of the oldest downloaded version cannot be shown', async () => {
    const { source, git, all } = fakeSource(2, { shallow: true });
    git.diff.mockClear();
    render(
      <PageHistoryDialog
        title="A"
        source={source}
        canRestore
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByTestId(short(all[0]!)));
    expect(await screen.findByTestId('history-diff-unavailable')).toBeDefined();
  });

  it('shows loading until the source is found', () => {
    render(
      <PageHistoryDialog
        title="A"
        source={null}
        canRestore
        onRestore={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('history-loading')).toBeDefined();
  });
});
