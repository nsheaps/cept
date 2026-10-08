import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolver } from './ConflictResolver.js';
import type { MergeConflict } from '@cept/core';

const content: MergeConflict = {
  path: 'pages/intro.md',
  type: 'content',
  ours: '# Introduction\nOur version\n',
  theirs: '# Introduction\nTheir version\n',
  base: '# Introduction\nOriginal\n',
  merged: '# Introduction\n<<<<<<< mine\nOur version\n=======\nTheir version\n>>>>>>> theirs\n',
};
const deletedHere: MergeConflict = {
  path: 'pages/deleted.md',
  type: 'delete-modify',
  ours: null,
  theirs: 'Modified content',
  base: 'Original content',
};
const binary: MergeConflict = {
  path: 'img/logo.png',
  type: 'content',
  ours: '',
  theirs: '',
  base: '',
  binary: true,
};

describe('ConflictResolver (REQ-WS-026)', () => {
  it('shows an empty state without conflicts', () => {
    render(<ConflictResolver conflicts={[]} />);
    expect(screen.getByTestId('conflict-empty')).toBeDefined();
  });

  it('shows the file, what happened, and both versions', () => {
    render(<ConflictResolver conflicts={[content, deletedHere]} />);
    expect(screen.getByTestId('conflict-count').textContent).toBe('0/2 resolved');
    expect(screen.getByTestId('conflict-path').textContent).toBe('pages/intro.md');
    expect(screen.getByTestId('conflict-type').textContent).toBe('Changed here and on GitHub');
    expect(screen.getByTestId('conflict-ours').textContent).toContain('Our version');
    expect(screen.getByTestId('conflict-theirs').textContent).toContain('Their version');
  });

  it('offers Keep mine, Keep theirs and Edit merged for a changed file', () => {
    render(<ConflictResolver conflicts={[content]} />);
    expect(screen.getByTestId('conflict-choose-mine').textContent).toBe('Keep mine');
    expect(screen.getByTestId('conflict-choose-theirs').textContent).toBe('Keep theirs');
    expect(screen.getByTestId('conflict-choose-merged').textContent).toBe('Edit merged');
  });

  it('resolves with the chosen sides and says the other version is kept', () => {
    const onResolve = vi.fn();
    render(<ConflictResolver conflicts={[content, deletedHere]} onResolve={onResolve} />);
    fireEvent.click(screen.getByTestId('conflict-choose-theirs'));
    // It moves on to the next conflict.
    expect(screen.getByTestId('conflict-path').textContent).toBe('pages/deleted.md');
    fireEvent.click(screen.getByTestId('conflict-prev'));
    expect(screen.getByTestId('conflict-resolution-status').textContent).toContain('copy');
    fireEvent.click(screen.getByTestId('conflict-next'));
    expect(screen.getByTestId('conflict-apply')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByText('Keep the file'));
    fireEvent.click(screen.getByTestId('conflict-apply'));
    expect(onResolve).toHaveBeenCalledWith([
      { path: 'pages/intro.md', choice: 'theirs' },
      { path: 'pages/deleted.md', choice: 'theirs' },
    ]);
  });

  it('maps Keep the file / Delete it to the side that kept or deleted it', () => {
    const onResolve = vi.fn();
    render(<ConflictResolver conflicts={[deletedHere]} onResolve={onResolve} />);
    expect(screen.queryByText('Keep mine')).toBeNull();
    fireEvent.click(screen.getByText('Delete it'));
    fireEvent.click(screen.getByTestId('conflict-apply'));
    expect(onResolve).toHaveBeenCalledWith([{ path: 'pages/deleted.md', choice: 'mine' }]);
  });

  it('edits the merge, starting from the marked text, and refuses markers', () => {
    const onResolve = vi.fn();
    render(<ConflictResolver conflicts={[content]} onResolve={onResolve} />);
    fireEvent.click(screen.getByTestId('conflict-choose-merged'));
    const editor = screen.getByTestId('conflict-merged-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe(content.merged);
    expect(screen.getByTestId('conflict-markers')).toBeDefined();
    expect(screen.getByTestId('conflict-apply')).toHaveProperty('disabled', true);

    fireEvent.change(editor, { target: { value: '# Introduction\nBoth versions\n' } });
    expect(screen.queryByTestId('conflict-markers')).toBeNull();
    expect(screen.getByTestId('conflict-count').textContent).toBe('1/1 resolved');
    fireEvent.click(screen.getByTestId('conflict-apply'));
    expect(onResolve).toHaveBeenCalledWith([
      { path: 'pages/intro.md', choice: 'merged', content: '# Introduction\nBoth versions\n' },
    ]);
  });

  it('refuses an emptied merge unless both sides were empty', () => {
    render(<ConflictResolver conflicts={[content]} />);
    fireEvent.click(screen.getByTestId('conflict-choose-merged'));
    fireEvent.change(screen.getByTestId('conflict-merged-editor'), { target: { value: '  \n' } });
    expect(screen.getByTestId('conflict-empty-merge')).toBeDefined();
    expect(screen.getByTestId('conflict-apply')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('conflict-count').textContent).toBe('0/1 resolved');
  });

  it('accepts an empty merge when both sides were empty', () => {
    const empty: MergeConflict = { ...content, ours: '', theirs: '', merged: '' };
    render(<ConflictResolver conflicts={[empty]} />);
    fireEvent.click(screen.getByTestId('conflict-choose-merged'));
    expect(screen.queryByTestId('conflict-empty-merge')).toBeNull();
    expect(screen.getByTestId('conflict-apply')).toHaveProperty('disabled', false);
  });

  it('does not offer to edit a binary file', () => {
    render(<ConflictResolver conflicts={[binary]} />);
    expect(screen.queryByTestId('conflict-choose-merged')).toBeNull();
    expect(screen.getByTestId('conflict-ours').textContent).toContain('(binary file)');
  });

  it('offers to push to a new branch instead, and to come back later', () => {
    const onPush = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConflictResolver conflicts={[content]} onPushToNewBranch={onPush} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByTestId('conflict-push-new-branch'));
    fireEvent.click(screen.getByTestId('conflict-cancel'));
    expect(onPush).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables its actions while busy', () => {
    render(<ConflictResolver conflicts={[content]} onPushToNewBranch={() => {}} busy />);
    expect(screen.getByTestId('conflict-choose-mine')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('conflict-push-new-branch')).toHaveProperty('disabled', true);
  });
});
