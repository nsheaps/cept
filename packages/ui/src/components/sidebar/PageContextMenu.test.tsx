import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageContextMenu } from './PageContextMenu.js';

const defaultProps = {
  pageId: 'test-page',
  pageTitle: 'Test Page',
  position: { x: 100, y: 200 },
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
  onClose: vi.fn(),
};

describe('PageContextMenu', () => {
  it('renders the context menu', () => {
    render(<PageContextMenu {...defaultProps} />);
    expect(screen.getByTestId('page-context-menu')).toBeDefined();
  });

  it('renders all action buttons', () => {
    render(<PageContextMenu {...defaultProps} />);
    expect(screen.getByTestId('ctx-rename')).toBeDefined();
    expect(screen.getByTestId('ctx-duplicate')).toBeDefined();
    expect(screen.getByTestId('ctx-move-to')).toBeDefined();
    expect(screen.getByTestId('ctx-delete')).toBeDefined();
  });

  it('calls onDuplicate and onClose when duplicate clicked', () => {
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    render(<PageContextMenu {...defaultProps} onDuplicate={onDuplicate} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('ctx-duplicate'));
    expect(onDuplicate).toHaveBeenCalledWith('test-page');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onDelete and onClose when delete clicked', () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<PageContextMenu {...defaultProps} onDelete={onDelete} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('ctx-delete'));
    expect(onDelete).toHaveBeenCalledWith('test-page');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onMove and onClose when Move to… is clicked', () => {
    const onMove = vi.fn();
    const onClose = vi.fn();
    render(<PageContextMenu {...defaultProps} onMove={onMove} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('ctx-move-to'));
    expect(onMove).toHaveBeenCalledWith('test-page');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows rename input when rename is clicked', () => {
    render(<PageContextMenu {...defaultProps} />);

    fireEvent.click(screen.getByTestId('ctx-rename'));
    expect(screen.getByTestId('rename-input')).toBeDefined();
  });

  it('calls onRename on Enter in rename input', () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    render(<PageContextMenu {...defaultProps} onRename={onRename} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('ctx-rename'));
    const input = screen.getByTestId('rename-input');
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('test-page', 'New Title');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape in rename input', () => {
    const onClose = vi.fn();
    render(<PageContextMenu {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('ctx-rename'));
    const input = screen.getByTestId('rename-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('positions at the specified coordinates', () => {
    render(<PageContextMenu {...defaultProps} />);
    const menu = screen.getByTestId('page-context-menu');
    expect(menu.style.top).toBe('200px');
    expect(menu.style.left).toBe('100px');
  });
});
