import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FolderView } from './FolderView.js';
import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

const childPages: PageTreeNode[] = [
  { id: 'child-1', title: 'Getting Started', icon: '\uD83D\uDE80', children: [] },
  { id: 'child-2', title: 'Installation', children: [] },
  {
    id: 'child-3',
    title: 'Advanced Topics',
    children: [
      { id: 'grandchild-1', title: 'Plugins', children: [] },
      { id: 'grandchild-2', title: 'Configuration', children: [] },
    ],
  },
];

describe('FolderView', () => {
  it('renders child pages as buttons', () => {
    render(<FolderView children={childPages} onPageSelect={() => {}} />);
    expect(screen.getByTestId('folder-view')).toBeTruthy();
    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('Installation')).toBeTruthy();
    expect(screen.getByText('Advanced Topics')).toBeTruthy();
  });

  it('shows custom icons when provided', () => {
    render(<FolderView children={childPages} onPageSelect={() => {}} />);
    const item = screen.getByTestId('folder-item-child-1');
    expect(item.textContent).toContain('\uD83D\uDE80');
  });

  it('shows default document icon for leaf pages without icon', () => {
    render(<FolderView children={childPages} onPageSelect={() => {}} />);
    const item = screen.getByTestId('folder-item-child-2');
    // Default leaf icon is 📄
    expect(item.textContent).toContain('\uD83D\uDCC4');
  });

  it('shows folder icon for pages with children without icon', () => {
    render(<FolderView children={childPages} onPageSelect={() => {}} />);
    const item = screen.getByTestId('folder-item-child-3');
    // Default folder icon is 📁
    expect(item.textContent).toContain('\uD83D\uDCC1');
  });

  it('shows child count badge for pages with children', () => {
    render(<FolderView children={childPages} onPageSelect={() => {}} />);
    const item = screen.getByTestId('folder-item-child-3');
    expect(item.textContent).toContain('2');
  });

  it('calls onPageSelect when clicking a child page', () => {
    const onPageSelect = vi.fn();
    render(<FolderView children={childPages} onPageSelect={onPageSelect} />);
    fireEvent.click(screen.getByTestId('folder-item-child-2'));
    expect(onPageSelect).toHaveBeenCalledWith('child-2');
  });

  it('renders nothing when children array is empty', () => {
    const { container } = render(<FolderView children={[]} onPageSelect={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows "Untitled" for pages without title', () => {
    const pages: PageTreeNode[] = [
      { id: 'no-title', title: '', children: [] },
    ];
    render(<FolderView children={pages} onPageSelect={() => {}} />);
    expect(screen.getByText('Untitled')).toBeTruthy();
  });
});
