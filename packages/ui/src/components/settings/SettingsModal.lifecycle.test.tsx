/**
 * Space lifecycle in settings (REQ-WS-024): removing asks first and says what
 * is lost, the slug is edited with a warning, and unknown stats show as such.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal, DEFAULT_SETTINGS } from './SettingsModal.js';
import type { SpaceInfo } from './SettingsModal.js';

function setup(spaces: SpaceInfo[], activeSpaceId = spaces[0]?.id) {
  const onDeleteSpace = vi.fn();
  const onSpaceRename = vi.fn();
  render(
    <SettingsModal
      isOpen
      initialTab="spaces"
      settings={{ ...DEFAULT_SETTINGS }}
      spaces={spaces}
      activeSpaceId={activeSpaceId}
      onClose={vi.fn()}
      onSettingsChange={vi.fn()}
      onResetSettings={vi.fn()}
      onDeleteSpace={onDeleteSpace}
      onSpaceRename={onSpaceRename}
      onSwitchSpace={vi.fn()}
      onClearAllData={vi.fn()}
      onRecreateDemoSpace={vi.fn()}
    />,
  );
  return { onDeleteSpace, onSpaceRename };
}

const app = (id: string, name: string): SpaceInfo => ({
  id,
  name,
  source: 'Browser (IndexedDB)',
  pageCount: 2,
  contentSize: 100,
  kind: 'app',
});

describe('SettingsModal space lifecycle (REQ-WS-024)', () => {
  it('asks before deleting an app space and deletes it on confirm', () => {
    const { onDeleteSpace } = setup([app('default', 'My Space'), app('work', 'Work')]);
    fireEvent.click(screen.getByTestId('delete-space-work'));
    expect(onDeleteSpace).not.toHaveBeenCalled();
    expect(screen.getByTestId('space-remove-title').textContent).toBe('Delete "Work"?');
    expect(screen.getByTestId('space-remove-explanation').textContent).toMatch(/deleted for good/);
    expect(screen.queryByTestId('space-remove-last')).toBeNull();
    fireEvent.click(screen.getByTestId('space-remove-confirm-btn'));
    expect(onDeleteSpace).toHaveBeenCalledWith('work');
    expect(screen.queryByTestId('space-remove-confirm')).toBeNull();
  });

  it('cancelling keeps the space', () => {
    const { onDeleteSpace } = setup([app('default', 'My Space'), app('work', 'Work')]);
    fireEvent.click(screen.getByTestId('delete-space-work'));
    fireEvent.click(screen.getByTestId('space-remove-cancel'));
    expect(onDeleteSpace).not.toHaveBeenCalled();
    expect(screen.getByTestId('settings-panel-spaces')).toBeDefined();
  });

  it('removes a folder space from Cept and says the folder is kept', () => {
    const notes: SpaceInfo = { ...app('folder-1', 'Notes'), kind: 'folder' };
    const { onDeleteSpace } = setup([app('default', 'My Space'), notes]);
    expect(screen.getByTestId('delete-space-folder-1').getAttribute('title')).toBe(
      'Remove from Cept',
    );
    fireEvent.click(screen.getByTestId('delete-space-folder-1'));
    expect(screen.getByTestId('space-remove-title').textContent).toBe('Remove "Notes" from Cept?');
    expect(screen.getByTestId('space-remove-explanation').textContent).toMatch(/folder .* stay/);
    expect(screen.getByTestId('space-remove-confirm-btn').textContent).toBe('Remove from Cept');
    fireEvent.click(screen.getByTestId('space-remove-confirm-btn'));
    expect(onDeleteSpace).toHaveBeenCalledWith('folder-1');
  });

  it('removes a GitHub space from this device only', () => {
    const repo: SpaceInfo = {
      ...app('github.com/me/notes@main', 'Repo'),
      kind: 'remote',
      remoteUrl: 'github.com/me/notes',
    };
    setup([app('default', 'My Space'), repo]);
    fireEvent.click(screen.getByTestId('delete-space-github.com/me/notes@main'));
    expect(screen.getByTestId('space-remove-title').textContent).toBe(
      'Remove "Repo" from this device?',
    );
    expect(screen.getByTestId('space-remove-explanation').textContent).toMatch(
      /GitHub is not changed/,
    );
  });

  it('says a new space takes the place of the last one, the default included', () => {
    const { onDeleteSpace } = setup([app('default', 'My Space')]);
    fireEvent.click(screen.getByTestId('delete-space-default'));
    expect(screen.getByTestId('space-remove-last').textContent).toMatch(/new, empty space/);
    fireEvent.click(screen.getByTestId('space-remove-confirm-btn'));
    expect(onDeleteSpace).toHaveBeenCalledWith('default');
  });

  it('asks from the details page too, and returns to the list after removing', () => {
    const { onDeleteSpace } = setup([app('default', 'My Space'), app('work', 'Work')]);
    fireEvent.click(screen.getByTestId('space-settings-work'));
    fireEvent.click(screen.getByTestId('space-details-delete'));
    expect(onDeleteSpace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('space-remove-confirm-btn'));
    expect(onDeleteSpace).toHaveBeenCalledWith('work');
    expect(screen.getByTestId('settings-panel-spaces')).toBeDefined();
  });

  it('shows the stats of a space, and unknown ones as unknown', () => {
    const away: SpaceInfo = { ...app('folder-1', 'Notes'), pageCount: null, contentSize: null };
    setup([app('default', 'My Space'), away]);
    expect(screen.getByTestId('space-item-default').textContent).toMatch(/2 pages · 100 B/);
    expect(screen.getByTestId('space-item-folder-1').textContent).toMatch(
      /pages unknown · size unknown/,
    );
    fireEvent.click(screen.getByTestId('space-settings-folder-1'));
    expect(screen.getByTestId('space-detail-pages').textContent).toBe('Unknown');
    expect(screen.getByTestId('space-detail-size').textContent).toBe('Unknown');
  });

  it('changes the slug with a warning about links', () => {
    const work: SpaceInfo = { ...app('work', 'Work'), slug: 'work' };
    const { onSpaceRename } = setup([app('default', 'My Space'), work]);
    fireEvent.click(screen.getByTestId('space-settings-work'));
    fireEvent.click(screen.getByTestId('space-detail-slug'));
    expect(screen.queryByTestId('space-slug-warning')).toBeNull();
    fireEvent.change(screen.getByTestId('space-slug-input'), { target: { value: 'office' } });
    expect(screen.getByTestId('space-slug-warning').textContent).toMatch(/old slug, work, stop/);
    fireEvent.click(screen.getByTestId('space-slug-save'));
    expect(onSpaceRename).toHaveBeenCalledWith('work', 'Work', 'office');
  });

  it('has no slug row for a space without a slug', () => {
    setup([app('default', 'My Space'), app('work', 'Work')]);
    fireEvent.click(screen.getByTestId('space-settings-work'));
    expect(screen.queryByTestId('space-detail-slug')).toBeNull();
  });
});
