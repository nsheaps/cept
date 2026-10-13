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

  describe('icon and cover pickers', () => {
    const onIconChange = vi.fn();
    const onCoverChange = vi.fn();
    const editable = { ...defaultProps, onIconChange, onCoverChange };

    it('shows no pickers without change handlers', () => {
      render(<PageHeader {...defaultProps} />);
      expect(screen.queryByTestId('edit-cover')).toBeNull();
      expect(screen.queryByTestId('add-icon')).toBeNull();
    });

    it('chooses an icon from the grid', () => {
      const { icon: _icon, ...noIcon } = editable;
      render(<PageHeader {...noIcon} />);
      fireEvent.click(screen.getByTestId('add-icon'));
      fireEvent.click(screen.getByLabelText('Use 🚀'));
      expect(onIconChange).toHaveBeenCalledWith('test-page', '🚀');
      expect(screen.queryByTestId('icon-picker')).toBeNull();
    });

    it('takes a typed emoji', () => {
      render(<PageHeader {...editable} />);
      fireEvent.click(screen.getByTestId('page-icon'));
      fireEvent.change(screen.getByTestId('icon-input'), { target: { value: ' 🦄 ' } });
      fireEvent.submit(screen.getByTestId('icon-input'));
      expect(onIconChange).toHaveBeenCalledWith('test-page', '🦄');
    });

    it('rejects typed text that is not a single emoji', () => {
      onIconChange.mockClear();
      render(<PageHeader {...editable} />);
      fireEvent.click(screen.getByTestId('page-icon'));
      fireEvent.change(screen.getByTestId('icon-input'), { target: { value: 'https://x.test' } });
      fireEvent.submit(screen.getByTestId('icon-input'));
      expect(onIconChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('icon-error')).toBeDefined();
    });

    it('opens the icon picker from the keyboard (a real button)', () => {
      render(<PageHeader {...editable} />);
      expect(screen.getByTestId('page-icon').tagName).toBe('BUTTON');
    });

    it('removes the icon', () => {
      render(<PageHeader {...editable} />);
      fireEvent.click(screen.getByTestId('page-icon'));
      fireEvent.click(screen.getByTestId('remove-icon'));
      expect(onIconChange).toHaveBeenCalledWith('test-page', undefined);
    });

    it('sets and removes the cover', () => {
      const { rerender } = render(<PageHeader {...editable} />);
      fireEvent.click(screen.getByTestId('edit-cover'));
      fireEvent.change(screen.getByTestId('cover-input'), {
        target: { value: 'https://example.com/a.png' },
      });
      fireEvent.submit(screen.getByTestId('cover-input'));
      expect(onCoverChange).toHaveBeenCalledWith('test-page', 'https://example.com/a.png');

      rerender(<PageHeader {...editable} cover="https://example.com/a.png" />);
      fireEvent.click(screen.getByTestId('edit-cover'));
      fireEvent.click(screen.getByTestId('remove-cover'));
      expect(onCoverChange).toHaveBeenLastCalledWith('test-page', undefined);
    });
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
