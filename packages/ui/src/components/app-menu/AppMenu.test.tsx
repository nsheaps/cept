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
});
