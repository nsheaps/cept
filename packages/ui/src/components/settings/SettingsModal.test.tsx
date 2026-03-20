import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal, DEFAULT_SETTINGS } from './SettingsModal.js';
import type { SpaceInfo } from './SettingsModal.js';

const defaultProps = {
  isOpen: true,
  settings: { ...DEFAULT_SETTINGS },
  spaces: [] as SpaceInfo[],
  activeSpaceId: 'default',
  onClose: vi.fn(),
  onSettingsChange: vi.fn(),
  onResetSettings: vi.fn(),
  onDeleteSpace: vi.fn(),
  onSpaceRename: vi.fn(),
  onSwitchSpace: vi.fn(),
  onClearAllData: vi.fn(),
  onRecreateDemoSpace: vi.fn(),
};

describe('SettingsModal', () => {
  it('does not render when closed', () => {
    render(<SettingsModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('settings-modal')).toBeNull();
  });

  it('renders when open', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByTestId('settings-modal')).toBeDefined();
  });

  it('shows settings tab by default', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByTestId('settings-panel-settings')).toBeDefined();
  });

  it('switches to spaces tab', () => {
    render(<SettingsModal {...defaultProps} initialTab="spaces" />);
    expect(screen.getByTestId('settings-panel-spaces')).toBeDefined();
  });

  it('shows auto-save toggle', () => {
    render(<SettingsModal {...defaultProps} />);
    expect(screen.getByTestId('setting-auto-save')).toBeDefined();
  });

  it('toggles auto-save', () => {
    const onSettingsChange = vi.fn();
    render(<SettingsModal {...defaultProps} onSettingsChange={onSettingsChange} />);
    screen.getByTestId('setting-auto-save-toggle').click();
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ autoSave: !DEFAULT_SETTINGS.autoSave }));
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SettingsModal {...defaultProps} onClose={onClose} />);
    screen.getByTestId('settings-close').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows space list in spaces tab', () => {
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
      { id: 'work', name: 'Work', source: 'Browser', pageCount: 5, contentSize: 2048 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" />);
    expect(screen.getByTestId('space-item-default')).toBeDefined();
    expect(screen.getByTestId('space-item-work')).toBeDefined();
  });

  it('shows branch badge in space listing when branch is set', () => {
    const spaces: SpaceInfo[] = [
      { id: 'docs', name: 'Cept Docs', source: 'Git', pageCount: 5, contentSize: 1024, branch: 'main', remoteUrl: 'github.com/nsheaps/cept' },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" />);
    expect(screen.getByTestId('space-branch-docs')).toBeDefined();
    expect(screen.getByTestId('space-branch-docs').textContent).toBe('main');
  });

  it('does not show branch badge when branch is not set', () => {
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" />);
    expect(screen.queryByTestId('space-branch-default')).toBeNull();
  });

  it('shows active badge on active space', () => {
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} activeSpaceId="default" initialTab="spaces" />);
    expect(screen.getByTestId('active-space-badge')).toBeDefined();
  });

  it('shows switch button for non-active spaces', () => {
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
      { id: 'work', name: 'Work', source: 'Browser', pageCount: 5, contentSize: 2048 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} activeSpaceId="default" initialTab="spaces" />);
    expect(screen.getByTestId('switch-space-work')).toBeDefined();
    expect(screen.queryByTestId('switch-space-default')).toBeNull();
  });

  it('calls onSwitchSpace when switch button clicked', () => {
    const onSwitchSpace = vi.fn();
    const onClose = vi.fn();
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
      { id: 'work', name: 'Work', source: 'Browser', pageCount: 5, contentSize: 2048 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} activeSpaceId="default" initialTab="spaces" onSwitchSpace={onSwitchSpace} onClose={onClose} />);
    screen.getByTestId('switch-space-work').click();
    expect(onSwitchSpace).toHaveBeenCalledWith('work');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onOpenAddSpaceWizard when create space button clicked', () => {
    const onOpenAddSpaceWizard = vi.fn();
    render(<SettingsModal {...defaultProps} initialTab="spaces" onOpenAddSpaceWizard={onOpenAddSpaceWizard} />);
    screen.getByTestId('create-space-btn').click();
    expect(onOpenAddSpaceWizard).toHaveBeenCalled();
  });

  it('shows import/export buttons when handlers provided', () => {
    render(
      <SettingsModal
        {...defaultProps}
        initialTab="spaces"
        onImportNotion={vi.fn()}
        onImportObsidian={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-notion-btn')).toBeDefined();
    expect(screen.getByTestId('import-obsidian-btn')).toBeDefined();
    expect(screen.getByTestId('export-page-btn')).toBeDefined();
  });

  it('shows clear all data button in spaces tab', () => {
    render(<SettingsModal {...defaultProps} initialTab="spaces" />);
    expect(screen.getByTestId('settings-panel-spaces')).toBeDefined();
    expect(screen.getByTestId('clear-all-data-btn')).toBeDefined();
  });

  it('shows delete button for each space in spaces tab', () => {
    const spaces: SpaceInfo[] = [
      { id: 'default', name: 'My Space', source: 'Browser', pageCount: 3, contentSize: 1024 },
      { id: 'work', name: 'Work', source: 'Browser', pageCount: 5, contentSize: 2048 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" />);
    expect(screen.getByTestId('delete-space-default')).toBeDefined();
    expect(screen.getByTestId('delete-space-work')).toBeDefined();
  });

  it('shows refresh button for git spaces in listing when onRefreshSpace provided', () => {
    const spaces: SpaceInfo[] = [
      { id: 'git-space', name: 'Docs', source: 'Git', pageCount: 5, contentSize: 1024, branch: 'main', remoteUrl: 'https://github.com/user/repo' },
      { id: 'local', name: 'Local', source: 'Browser', pageCount: 3, contentSize: 512 },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" onRefreshSpace={vi.fn()} />);
    expect(screen.getByTestId('refresh-space-git-space')).toBeDefined();
    expect(screen.queryByTestId('refresh-space-local')).toBeNull();
  });

  it('does not show refresh button when onRefreshSpace not provided', () => {
    const spaces: SpaceInfo[] = [
      { id: 'git-space', name: 'Docs', source: 'Git', pageCount: 5, contentSize: 1024, branch: 'main', remoteUrl: 'https://github.com/user/repo' },
    ];
    render(<SettingsModal {...defaultProps} spaces={spaces} initialTab="spaces" />);
    expect(screen.queryByTestId('refresh-space-git-space')).toBeNull();
  });

  it('shows about tab with version', () => {
    render(<SettingsModal {...defaultProps} initialTab="about" />);
    expect(screen.getByTestId('settings-panel-about')).toBeDefined();
    const versionEl = screen.getByTestId('about-version');
    expect(versionEl.textContent).toContain('Version');
  });

  it('resets settings when reset button clicked', () => {
    const onResetSettings = vi.fn();
    render(<SettingsModal {...defaultProps} onResetSettings={onResetSettings} />);
    screen.getByTestId('reset-settings-btn').click();
    expect(onResetSettings).toHaveBeenCalled();
  });
});
