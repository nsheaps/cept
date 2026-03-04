import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from './PageHeader.js';

describe('PageHeader', () => {
  const defaultProps = {
    pageId: 'test-page',
    title: 'Test Page',
    icon: '\u{1F4C4}',
    isFavorite: false,
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onToggleFavorite: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.getByTestId('page-title')).toBeDefined();
    expect(screen.getByText('Test Page')).toBeDefined();
  });

  it('clicking title enters edit mode', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-title'));
    expect(screen.getByTestId('page-title-input')).toBeDefined();
    expect(screen.getByTestId('page-title-save')).toBeDefined();
  });

  it('pressing Enter saves the title', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-title'));
    const input = screen.getByTestId('page-title-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onRename).toHaveBeenCalledWith('test-page', 'New Title');
  });

  it('pressing Escape cancels edit', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-title'));
    const input = screen.getByTestId('page-title-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // Should be back to display mode
    expect(screen.getByTestId('page-title')).toBeDefined();
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it('opens menu with triple-dot button', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByTestId('page-header-menu')).toBeDefined();
  });

  it('menu has favorite, rename, duplicate, delete actions', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByTestId('page-menu-favorite')).toBeDefined();
    expect(screen.getByTestId('page-menu-rename')).toBeDefined();
    expect(screen.getByTestId('page-menu-duplicate')).toBeDefined();
    expect(screen.getByTestId('page-menu-delete')).toBeDefined();
  });

  it('clicking duplicate in menu calls onDuplicate', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-duplicate'));
    expect(defaultProps.onDuplicate).toHaveBeenCalledWith('test-page');
  });

  it('shows "Remove from favorites" when isFavorite', () => {
    render(<PageHeader {...defaultProps} isFavorite />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByText('Remove from favorites')).toBeDefined();
  });

  it('shows "Add to favorites" when not favorite', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    expect(screen.getByText('Add to favorites')).toBeDefined();
  });

  it('rename from menu opens edit mode', () => {
    render(<PageHeader {...defaultProps} />);
    fireEvent.click(screen.getByTestId('page-menu-btn'));
    fireEvent.click(screen.getByTestId('page-menu-rename'));
    expect(screen.getByTestId('page-title-input')).toBeDefined();
  });
});
