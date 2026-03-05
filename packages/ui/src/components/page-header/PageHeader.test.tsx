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

  it('does not render page menu (menu is in header bar)', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.queryByTestId('page-menu-btn')).toBeNull();
    expect(screen.queryByTestId('page-header-menu')).toBeNull();
  });

  it('renders cover banner when cover is provided', () => {
    render(<PageHeader {...defaultProps} cover="https://example.com/banner.jpg" />);
    const coverEl = screen.getByTestId('page-cover');
    expect(coverEl).toBeDefined();
    const img = coverEl.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/banner.jpg');
  });

  it('does not render cover banner when cover is not provided', () => {
    render(<PageHeader {...defaultProps} />);
    expect(screen.queryByTestId('page-cover')).toBeNull();
  });

  it('renders icon emoji in header', () => {
    render(<PageHeader {...defaultProps} icon="\uD83D\uDE80" />);
    const header = screen.getByTestId('page-header');
    // The rocket emoji is rendered in the icon span
    const iconSpan = header.querySelector('.cept-page-header-icon');
    expect(iconSpan).toBeTruthy();
    expect(iconSpan?.textContent?.length).toBeGreaterThan(0);
  });
});
