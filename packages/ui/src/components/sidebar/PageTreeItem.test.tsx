import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageTreeItem } from './PageTreeItem.js';
import type { PageTreeNode } from './PageTreeItem.js';

const leaf: PageTreeNode = { id: 'leaf', title: 'Leaf Page', icon: '📄', children: [] };
const parent: PageTreeNode = {
  id: 'parent',
  title: 'Parent',
  icon: '📁',
  isExpanded: true,
  children: [leaf],
};
const collapsed: PageTreeNode = { ...parent, isExpanded: false };

describe('PageTreeItem', () => {
  it('renders the node title', () => {
    render(<PageTreeItem node={leaf} depth={0} />);
    expect(screen.getByText('Leaf Page')).toBeDefined();
  });

  it('renders "Untitled" when title is empty', () => {
    const untitled: PageTreeNode = { id: 'u', title: '', children: [] };
    render(<PageTreeItem node={untitled} depth={0} />);
    expect(screen.getByText('Untitled')).toBeDefined();
  });

  it('renders the node icon', () => {
    render(<PageTreeItem node={leaf} depth={0} />);
    expect(screen.getByText('📄')).toBeDefined();
  });

  it('renders default icon when none provided', () => {
    const noIcon: PageTreeNode = { id: 'ni', title: 'No Icon', children: [] };
    render(<PageTreeItem node={noIcon} depth={0} />);
    expect(screen.getByText('📄')).toBeDefined();
  });

  it('applies selected class when selected', () => {
    render(<PageTreeItem node={leaf} depth={0} selectedId="leaf" />);
    const btn = screen.getByTestId('page-tree-button-leaf');
    expect(btn.className).toContain('is-selected');
  });

  it('does not apply selected class when not selected', () => {
    render(<PageTreeItem node={leaf} depth={0} selectedId="other" />);
    const btn = screen.getByTestId('page-tree-button-leaf');
    expect(btn.className).not.toContain('is-selected');
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<PageTreeItem node={leaf} depth={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('page-tree-button-leaf'));
    expect(onSelect).toHaveBeenCalledWith('leaf');
  });

  it('renders children when expanded', () => {
    render(<PageTreeItem node={parent} depth={0} />);
    expect(screen.getByTestId('page-tree-children-parent')).toBeDefined();
    expect(screen.getByText('Leaf Page')).toBeDefined();
  });

  it('does not render children when collapsed', () => {
    render(<PageTreeItem node={collapsed} depth={0} />);
    expect(screen.queryByTestId('page-tree-children-parent')).toBeNull();
  });

  it('calls onToggle when expand arrow clicked', () => {
    const onToggle = vi.fn();
    render(<PageTreeItem node={parent} depth={0} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('page-tree-toggle-parent'));
    expect(onToggle).toHaveBeenCalledWith('parent');
  });

  it('shows add button on hover', () => {
    render(<PageTreeItem node={leaf} depth={0} />);
    fireEvent.mouseEnter(screen.getByTestId('page-tree-button-leaf'));
    expect(screen.getByTestId('page-tree-add-leaf')).toBeDefined();
  });

  it('calls onAdd when add button clicked', () => {
    const onAdd = vi.fn();
    render(<PageTreeItem node={leaf} depth={0} onAdd={onAdd} />);
    fireEvent.mouseEnter(screen.getByTestId('page-tree-button-leaf'));
    fireEvent.click(screen.getByTestId('page-tree-add-leaf'));
    expect(onAdd).toHaveBeenCalledWith('leaf');
  });

  it('fires context menu callback on right click', () => {
    const onCtx = vi.fn();
    render(<PageTreeItem node={leaf} depth={0} onContextMenu={onCtx} />);
    fireEvent.contextMenu(screen.getByTestId('page-tree-button-leaf'));
    expect(onCtx).toHaveBeenCalledWith('leaf', 'Leaf Page', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it('indents based on depth', () => {
    render(<PageTreeItem node={leaf} depth={3} />);
    const btn = screen.getByTestId('page-tree-button-leaf');
    expect(btn.style.paddingLeft).toBe('56px'); // 3 * 16 + 8
  });
});
