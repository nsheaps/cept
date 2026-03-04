import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
  onCreateSpace: vi.fn(),
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

  it('shows create space form when button clicked', () => {
    render(<SettingsModal {...defaultProps} initialTab="spaces" />);
    act(() => { fireEvent.click(screen.getByTestId('create-space-btn')); });
    expect(screen.getByTestId('create-space-form')).toBeDefined();
    expect(screen.getByTestId('create-space-input')).toBeDefined();
  });

  it('calls onCreateSpace when form submitted', () => {
    const onCreateSpace = vi.fn();
    render(<SettingsModal {...defaultProps} initialTab="spaces" onCreateSpace={onCreateSpace} />);
    act(() => { fireEvent.click(screen.getByTestId('create-space-btn')); });
    const input = screen.getByTestId('create-space-input');
    fireEvent.change(input, { target: { value: 'New Space' } });
    act(() => { fireEvent.click(screen.getByTestId('create-space-confirm')); });
    expect(onCreateSpace).toHaveBeenCalledWith('New Space');
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

  it('shows data tab with clear all data button', () => {
    render(<SettingsModal {...defaultProps} initialTab="data" />);
    expect(screen.getByTestId('settings-panel-data')).toBeDefined();
    expect(screen.getByTestId('clear-all-data-btn')).toBeDefined();
  });

  it('shows about tab', () => {
    render(<SettingsModal {...defaultProps} initialTab="about" />);
    expect(screen.getByTestId('settings-panel-about')).toBeDefined();
  });

  it('resets settings when reset button clicked', () => {
    const onResetSettings = vi.fn();
    render(<SettingsModal {...defaultProps} onResetSettings={onResetSettings} />);
    screen.getByTestId('reset-settings-btn').click();
    expect(onResetSettings).toHaveBeenCalled();
  });
});
