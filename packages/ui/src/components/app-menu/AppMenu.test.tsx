import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppMenu } from './AppMenu.js';

describe('AppMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when no pageId', () => {
    const { container } = render(<AppMenu />);
    expect(container.innerHTML).toBe('');
  });

  it('renders trigger button when pageId is provided', () => {
    render(<AppMenu pageId="test-page" />);
    expect(screen.getByTestId('page-menu-btn')).toBeDefined();
  });

  it('opens menu on click', () => {
    render(<AppMenu pageId="test-page" />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByTestId('page-menu')).toBeDefined();
  });

  it('has favorite, rename, duplicate, delete items', () => {
    render(<AppMenu pageId="test-page" />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByTestId('page-menu-favorite')).toBeDefined();
    expect(screen.getByTestId('page-menu-rename')).toBeDefined();
    expect(screen.getByTestId('page-menu-duplicate')).toBeDefined();
    expect(screen.getByTestId('page-menu-delete')).toBeDefined();
  });

  it('shows "Add to favorites" when not favorite', () => {
    render(<AppMenu pageId="test-page" />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByText('Add to favorites')).toBeDefined();
  });

  it('shows "Remove from favorites" when isFavorite', () => {
    render(<AppMenu pageId="test-page" isFavorite />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByText('Remove from favorites')).toBeDefined();
  });

  it('calls onToggleFavorite with pageId', () => {
    const onToggleFavorite = vi.fn();
    render(<AppMenu pageId="test-page" onToggleFavorite={onToggleFavorite} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-favorite'));
    expect(onToggleFavorite).toHaveBeenCalledWith('test-page');
  });

  it('calls onDuplicate with pageId', () => {
    const onDuplicate = vi.fn();
    render(<AppMenu pageId="test-page" onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith('test-page');
  });

  it('calls onDelete with pageId', () => {
    const onDelete = vi.fn();
    render(<AppMenu pageId="test-page" onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-delete'));
    expect(onDelete).toHaveBeenCalledWith('test-page');
  });

  it('calls onRename with pageId', () => {
    const onRename = vi.fn();
    render(<AppMenu pageId="test-page" onRename={onRename} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-rename'));
    expect(onRename).toHaveBeenCalledWith('test-page');
  });
  it('hides the remote-space items without their props', () => {
    render(<AppMenu pageId="test-page" />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.queryByTestId('page-menu-view-remote')).toBeNull();
    expect(screen.queryByTestId('page-menu-refresh-space')).toBeNull();
    expect(screen.queryByTestId('page-menu-space-settings')).toBeNull();
  });

  it('links to the remote page in a new tab', () => {
    const href = 'https://github.com/o/r/blob/main/docs/a.md';
    render(<AppMenu pageId="test-page" remoteLink={{ href, label: 'View on GitHub' }} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    const link = screen.getByTestId('page-menu-view-remote');
    expect(link.getAttribute('href')).toBe(href);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer');
    expect(link.textContent).toContain('View on GitHub');
  });

  it('calls onRefreshSpace and closes the menu', () => {
    const onRefreshSpace = vi.fn();
    render(<AppMenu pageId="test-page" onRefreshSpace={onRefreshSpace} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-refresh-space'));
    expect(onRefreshSpace).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('page-menu-refresh-space')).toBeNull();
  });

  it('calls onOpenSpaceSettings and closes the menu', () => {
    const onOpenSpaceSettings = vi.fn();
    render(<AppMenu pageId="test-page" onOpenSpaceSettings={onOpenSpaceSettings} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-space-settings'));
    expect(onOpenSpaceSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('page-menu-space-settings')).toBeNull();
  });
});
