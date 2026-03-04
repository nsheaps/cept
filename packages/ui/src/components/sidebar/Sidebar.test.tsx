import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar.js';
import type { PageTreeNode } from './PageTreeItem.js';

const mockPages: PageTreeNode[] = [
  {
    id: 'page-1',
    title: 'Getting Started',
    icon: '\u{1F680}',
    isExpanded: true,
    children: [
      {
        id: 'page-1-1',
        title: 'Quick Start',
        children: [],
      },
      {
        id: 'page-1-2',
        title: 'Tutorial',
        children: [],
      },
    ],
  },
  {
    id: 'page-2',
    title: 'Notes',
    children: [
      {
        id: 'page-2-1',
        title: 'Meeting Notes',
        children: [],
      },
    ],
  },
  {
    id: 'page-3',
    title: 'Projects',
    children: [],
  },
];

describe('Sidebar', () => {
  it('renders the sidebar', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByTestId('sidebar')).toBeDefined();
  });

  it('renders workspace name', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByText('Workspace')).toBeDefined();
  });

  it('renders search button', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByTestId('sidebar-search')).toBeDefined();
  });

  it('renders page tree', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByTestId('page-tree')).toBeDefined();
  });

  it('renders top-level pages', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByText('Getting Started')).toBeDefined();
    expect(screen.getByText('Notes')).toBeDefined();
    expect(screen.getByText('Projects')).toBeDefined();
  });

  it('renders expanded children', () => {
    render(<Sidebar pages={mockPages} />);
    // page-1 is expanded, so children should be visible
    expect(screen.getByText('Quick Start')).toBeDefined();
    expect(screen.getByText('Tutorial')).toBeDefined();
  });

  it('hides collapsed children', () => {
    render(<Sidebar pages={mockPages} />);
    // page-2 is not expanded, so children should not be visible
    expect(screen.queryByText('Meeting Notes')).toBeNull();
  });

  it('shows empty state when no pages', () => {
    render(<Sidebar pages={[]} />);
    expect(screen.getByTestId('sidebar-empty')).toBeDefined();
    expect(screen.getByText('No pages yet')).toBeDefined();
  });

  it('calls onPageSelect when page is clicked', () => {
    const onPageSelect = vi.fn();
    render(<Sidebar pages={mockPages} onPageSelect={onPageSelect} />);

    fireEvent.click(screen.getByTestId('page-tree-button-page-3'));
    expect(onPageSelect).toHaveBeenCalledWith('page-3');
  });

  it('calls onPageToggle when toggle is clicked', () => {
    const onPageToggle = vi.fn();
    render(<Sidebar pages={mockPages} onPageToggle={onPageToggle} />);

    fireEvent.click(screen.getByTestId('page-tree-toggle-page-1'));
    expect(onPageToggle).toHaveBeenCalledWith('page-1');
  });

  it('highlights selected page', () => {
    render(<Sidebar pages={mockPages} selectedPageId="page-3" />);

    const button = screen.getByTestId('page-tree-button-page-3');
    expect(button.className).toContain('is-selected');
  });

  it('calls onPageAdd when add button is clicked', () => {
    const onPageAdd = vi.fn();
    render(<Sidebar pages={mockPages} onPageAdd={onPageAdd} />);

    fireEvent.click(screen.getByTestId('sidebar-add-page'));
    expect(onPageAdd).toHaveBeenCalledWith();
  });

  it('renders page icons', () => {
    render(<Sidebar pages={mockPages} />);
    // page-1 has a custom rocket icon
    expect(screen.getByText('\u{1F680}')).toBeDefined();
  });

  it('renders Pages section header', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByText('Pages')).toBeDefined();
  });
});
