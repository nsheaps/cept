import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolver } from './ConflictResolver.js';
import type { MergeConflict } from '@cept/core';

const mockConflicts: MergeConflict[] = [
  {
    path: 'pages/intro.md',
    type: 'content',
    ours: '# Introduction\nOur version',
    theirs: '# Introduction\nTheir version',
    base: '# Introduction\nOriginal',
  },
  {
    path: 'pages/deleted.md',
    type: 'delete-modify',
    ours: null,
    theirs: 'Modified content',
    base: 'Original content',
  },
  {
    path: 'pages/new.md',
    type: 'add-add',
    ours: 'Our new file',
    theirs: 'Their new file',
    base: null,
  },
];

describe('ConflictResolver', () => {
  describe('empty state', () => {
    it('shows empty message when no conflicts', () => {
      render(<ConflictResolver conflicts={[]} />);
      expect(screen.getByTestId('conflict-empty')).toBeDefined();
    });
  });

  describe('conflict display', () => {
    it('renders the resolver', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-resolver')).toBeDefined();
    });

    it('shows conflict count', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-count').textContent).toBe('0/3 resolved');
    });

    it('shows first conflict by default', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-path').textContent).toBe('pages/intro.md');
    });

    it('shows conflict type', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-type').textContent).toBe('content');
    });

    it('shows ours and theirs content', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-ours').textContent).toContain('Our version');
      expect(screen.getByTestId('conflict-theirs').textContent).toContain('Their version');
    });

    it('shows (deleted) for null ours', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-next'));
      expect(screen.getByTestId('conflict-ours').textContent).toContain('(deleted)');
    });
  });

  describe('navigation', () => {
    it('shows current index', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect(screen.getByTestId('conflict-index').textContent).toBe('1 of 3');
    });

    it('navigates to next conflict', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-next'));
      expect(screen.getByTestId('conflict-index').textContent).toBe('2 of 3');
      expect(screen.getByTestId('conflict-path').textContent).toBe('pages/deleted.md');
    });

    it('navigates to previous conflict', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-next'));
      fireEvent.click(screen.getByTestId('conflict-prev'));
      expect(screen.getByTestId('conflict-index').textContent).toBe('1 of 3');
    });

    it('disables prev on first conflict', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect((screen.getByTestId('conflict-prev') as HTMLButtonElement).disabled).toBe(true);
    });

    it('disables next on last conflict', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-next'));
      fireEvent.click(screen.getByTestId('conflict-next'));
      expect((screen.getByTestId('conflict-next') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('resolution', () => {
    it('resolves with ours strategy', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      // Auto-advances, navigate back to see resolution status
      fireEvent.click(screen.getByTestId('conflict-prev'));
      expect(screen.getByTestId('conflict-resolution-status').textContent).toContain('ours');
    });

    it('resolves with theirs strategy', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-theirs'));
      fireEvent.click(screen.getByTestId('conflict-prev'));
      expect(screen.getByTestId('conflict-resolution-status').textContent).toContain('theirs');
    });

    it('resolves with merge strategy', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-merge'));
      fireEvent.click(screen.getByTestId('conflict-prev'));
      expect(screen.getByTestId('conflict-resolution-status').textContent).toContain('merge');
    });

    it('marks selected button', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      fireEvent.click(screen.getByTestId('conflict-prev'));
      expect(screen.getByTestId('conflict-choose-ours').className).toContain('is-selected');
    });

    it('updates resolved count', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      // Auto-advances to next
      expect(screen.getByTestId('conflict-count').textContent).toBe('1/3 resolved');
    });

    it('auto-advances after resolution', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      expect(screen.getByTestId('conflict-index').textContent).toBe('2 of 3');
    });
  });

  describe('apply resolutions', () => {
    it('disables apply when not all resolved', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      expect((screen.getByTestId('conflict-apply') as HTMLButtonElement).disabled).toBe(true);
    });

    it('enables apply when all resolved', () => {
      render(<ConflictResolver conflicts={mockConflicts} />);
      // Resolve all 3 conflicts
      fireEvent.click(screen.getByTestId('conflict-choose-ours')); // auto-advances
      fireEvent.click(screen.getByTestId('conflict-choose-theirs')); // auto-advances
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      expect((screen.getByTestId('conflict-apply') as HTMLButtonElement).disabled).toBe(false);
    });

    it('calls onResolve with resolutions', () => {
      const onResolve = vi.fn();
      render(<ConflictResolver conflicts={mockConflicts} onResolve={onResolve} />);
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      fireEvent.click(screen.getByTestId('conflict-choose-theirs'));
      fireEvent.click(screen.getByTestId('conflict-choose-ours'));
      fireEvent.click(screen.getByTestId('conflict-apply'));

      expect(onResolve).toHaveBeenCalledOnce();
      const resolutions = onResolve.mock.calls[0][0];
      expect(resolutions).toHaveLength(3);
      expect(resolutions[0].path).toBe('pages/intro.md');
      expect(resolutions[0].strategy).toBe('ours');
    });
  });

  describe('cancel', () => {
    it('shows cancel button when onCancel provided', () => {
      render(<ConflictResolver conflicts={mockConflicts} onCancel={() => {}} />);
      expect(screen.getByTestId('conflict-cancel')).toBeDefined();
    });

    it('calls onCancel when clicked', () => {
      const onCancel = vi.fn();
      render(<ConflictResolver conflicts={mockConflicts} onCancel={onCancel} />);
      fireEvent.click(screen.getByTestId('conflict-cancel'));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });
});
