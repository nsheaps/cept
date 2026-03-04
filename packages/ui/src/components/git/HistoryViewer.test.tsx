import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryViewer } from './HistoryViewer.js';
import type { CommitInfo, DiffResult } from '@cept/core';

const now = Math.floor(Date.now() / 1000);

const mockCommits: CommitInfo[] = [
  {
    hash: 'abc1234567890def',
    message: 'Update introduction page',
    author: { name: 'Alice', email: 'alice@example.com', timestamp: now - 3600 },
    parent: ['def0000000000000'],
  },
  {
    hash: 'def0000000000000',
    message: 'Add new database schema',
    author: { name: 'Bob', email: 'bob@example.com', timestamp: now - 86400 },
    parent: ['ghi0000000000000'],
  },
  {
    hash: 'ghi0000000000000',
    message: 'Initial commit',
    author: { name: 'Alice', email: 'alice@example.com', timestamp: now - 86400 * 30 },
    parent: [],
  },
];

const mockDiff: DiffResult = {
  files: [
    { path: 'pages/intro.md', type: 'modify', hunks: ['@@ -1,3 +1,3 @@\n-Old intro\n+New intro'] },
    { path: 'pages/new.md', type: 'add', hunks: [] },
    { path: 'pages/removed.md', type: 'delete', hunks: [] },
  ],
};

describe('HistoryViewer', () => {
  describe('rendering', () => {
    it('renders the history viewer', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      expect(screen.getByTestId('history-viewer')).toBeDefined();
    });

    it('shows page history title', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      expect(screen.getByTestId('history-header').textContent).toContain('Page History');
    });

    it('shows file path in title', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} filePath="pages/intro.md" />);
      expect(screen.getByTestId('history-header').textContent).toContain('pages/intro.md');
    });
  });

  describe('commit list', () => {
    it('renders all commits', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      expect(screen.getByTestId('history-commit-abc1234')).toBeDefined();
      expect(screen.getByTestId('history-commit-def0000')).toBeDefined();
      expect(screen.getByTestId('history-commit-ghi0000')).toBeDefined();
    });

    it('shows commit messages', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      const commit = screen.getByTestId('history-commit-abc1234');
      expect(commit.textContent).toContain('Update introduction page');
    });

    it('shows author names', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      const commit = screen.getByTestId('history-commit-abc1234');
      expect(commit.textContent).toContain('Alice');
    });

    it('shows short hashes', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      const commit = screen.getByTestId('history-commit-abc1234');
      expect(commit.textContent).toContain('abc1234');
    });

    it('shows relative time', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      const commit = screen.getByTestId('history-commit-abc1234');
      expect(commit.textContent).toContain('1h ago');
    });

    it('calls onSelectCommit when clicked', () => {
      const onSelectCommit = vi.fn();
      render(<HistoryViewer commits={mockCommits} diff={null} onSelectCommit={onSelectCommit} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(onSelectCommit).toHaveBeenCalledWith('abc1234567890def');
    });

    it('marks selected commit', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-commit-abc1234').className).toContain('is-selected');
    });
  });

  describe('search', () => {
    it('filters commits by message', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      fireEvent.change(screen.getByTestId('history-search'), { target: { value: 'database' } });
      expect(screen.queryByTestId('history-commit-abc1234')).toBeNull();
      expect(screen.getByTestId('history-commit-def0000')).toBeDefined();
    });

    it('filters commits by author', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      fireEvent.change(screen.getByTestId('history-search'), { target: { value: 'bob' } });
      expect(screen.getByTestId('history-commit-def0000')).toBeDefined();
      expect(screen.queryByTestId('history-commit-abc1234')).toBeNull();
    });

    it('filters by hash prefix', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      fireEvent.change(screen.getByTestId('history-search'), { target: { value: 'abc' } });
      expect(screen.getByTestId('history-commit-abc1234')).toBeDefined();
      expect(screen.queryByTestId('history-commit-def0000')).toBeNull();
    });

    it('shows empty state when no matches', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} />);
      fireEvent.change(screen.getByTestId('history-search'), { target: { value: 'zzzzz' } });
      expect(screen.getByTestId('history-empty')).toBeDefined();
    });
  });

  describe('loading state', () => {
    it('shows loading indicator', () => {
      render(<HistoryViewer commits={[]} diff={null} loading={true} />);
      expect(screen.getByTestId('history-loading')).toBeDefined();
    });

    it('shows empty state when no history', () => {
      render(<HistoryViewer commits={[]} diff={null} />);
      expect(screen.getByTestId('history-empty').textContent).toContain('No history');
    });
  });

  describe('diff view', () => {
    it('shows diff when commit selected', () => {
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-diff')).toBeDefined();
    });

    it('shows diff files', () => {
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-diff-file-pages/intro.md')).toBeDefined();
      expect(screen.getByTestId('history-diff-file-pages/new.md')).toBeDefined();
      expect(screen.getByTestId('history-diff-file-pages/removed.md')).toBeDefined();
    });

    it('shows diff loading state', () => {
      render(<HistoryViewer commits={mockCommits} diff={null} diffLoading={true} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-diff-loading')).toBeDefined();
    });

    it('shows empty diff state', () => {
      render(<HistoryViewer commits={mockCommits} diff={{ files: [] }} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-diff-empty')).toBeDefined();
    });

    it('shows diff hunks', () => {
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      const hunks = screen.getAllByTestId('history-diff-hunk');
      expect(hunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('restore', () => {
    it('shows restore button for non-deleted files', () => {
      const onRestore = vi.fn();
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} onRestore={onRestore} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.getByTestId('history-restore-pages/intro.md')).toBeDefined();
      expect(screen.getByTestId('history-restore-pages/new.md')).toBeDefined();
    });

    it('does not show restore for deleted files', () => {
      const onRestore = vi.fn();
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} onRestore={onRestore} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      expect(screen.queryByTestId('history-restore-pages/removed.md')).toBeNull();
    });

    it('calls onRestore with hash and path', () => {
      const onRestore = vi.fn();
      render(<HistoryViewer commits={mockCommits} diff={mockDiff} onRestore={onRestore} />);
      fireEvent.click(screen.getByTestId('history-commit-abc1234'));
      fireEvent.click(screen.getByTestId('history-restore-pages/intro.md'));
      expect(onRestore).toHaveBeenCalledWith('abc1234567890def', 'pages/intro.md');
    });
  });
});
