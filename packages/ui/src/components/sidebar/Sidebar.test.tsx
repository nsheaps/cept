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

  it('renders favorites section when favorites are provided', () => {
    const favorites = [
      { id: 'page-1', title: 'Getting Started', icon: '\u{1F680}' },
    ];
    render(<Sidebar pages={mockPages} favorites={favorites} />);
    expect(screen.getByTestId('favorites-section')).toBeDefined();
    expect(screen.getByText('Favorites')).toBeDefined();
    expect(screen.getByTestId('favorite-page-1')).toBeDefined();
  });

  it('does not render favorites section when empty', () => {
    render(<Sidebar pages={mockPages} favorites={[]} />);
    expect(screen.queryByTestId('favorites-section')).toBeNull();
  });

  it('renders recent section when recent pages are provided', () => {
    const recentPages = [
      { id: 'page-3', title: 'Projects' },
    ];
    render(<Sidebar pages={mockPages} recentPages={recentPages} />);
    expect(screen.getByTestId('recent-section')).toBeDefined();
    expect(screen.getByText('Recent')).toBeDefined();
    expect(screen.getByTestId('recent-page-3')).toBeDefined();
  });

  it('does not render recent section when empty', () => {
    render(<Sidebar pages={mockPages} recentPages={[]} />);
    expect(screen.queryByTestId('recent-section')).toBeNull();
  });

  it('calls onPageSelect when a favorite is clicked', () => {
    const onPageSelect = vi.fn();
    const favorites = [{ id: 'page-1', title: 'Getting Started' }];
    render(<Sidebar pages={mockPages} favorites={favorites} onPageSelect={onPageSelect} />);

    fireEvent.click(screen.getByTestId('favorite-page-1'));
    expect(onPageSelect).toHaveBeenCalledWith('page-1');
  });

  it('calls onPageSelect when a recent page is clicked', () => {
    const onPageSelect = vi.fn();
    const recentPages = [{ id: 'page-3', title: 'Projects' }];
    render(<Sidebar pages={mockPages} recentPages={recentPages} onPageSelect={onPageSelect} />);

    fireEvent.click(screen.getByTestId('recent-page-3'));
    expect(onPageSelect).toHaveBeenCalledWith('page-3');
  });

  it('highlights selected favorite', () => {
    const favorites = [{ id: 'page-1', title: 'Getting Started' }];
    render(<Sidebar pages={mockPages} favorites={favorites} selectedPageId="page-1" />);

    const favBtn = screen.getByTestId('favorite-page-1');
    expect(favBtn.className).toContain('is-selected');
  });

  it('renders trash section', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByTestId('trash-section')).toBeDefined();
    expect(screen.getByTestId('trash-toggle')).toBeDefined();
  });

  it('shows trash items when expanded', () => {
    const trash = [
      { id: 'deleted-1', title: 'Deleted Page' },
    ];
    render(<Sidebar pages={mockPages} trash={trash} />);

    // Trash is initially collapsed
    expect(screen.queryByTestId('trash-list')).toBeNull();

    // Expand trash
    fireEvent.click(screen.getByTestId('trash-toggle'));
    expect(screen.getByTestId('trash-list')).toBeDefined();
    expect(screen.getByTestId('trash-item-deleted-1')).toBeDefined();
  });

  it('shows trash count badge', () => {
    const trash = [
      { id: 'd1', title: 'Page 1' },
      { id: 'd2', title: 'Page 2' },
    ];
    render(<Sidebar pages={mockPages} trash={trash} />);
    expect(screen.getByTestId('trash-count').textContent).toBe('2');
  });

  it('calls onRestoreFromTrash when restore clicked', () => {
    const onRestoreFromTrash = vi.fn();
    const trash = [{ id: 'd1', title: 'Deleted' }];
    render(<Sidebar pages={mockPages} trash={trash} onRestoreFromTrash={onRestoreFromTrash} />);

    fireEvent.click(screen.getByTestId('trash-toggle'));
    fireEvent.click(screen.getByTestId('trash-restore-d1'));
    expect(onRestoreFromTrash).toHaveBeenCalledWith('d1');
  });

  it('calls onPermanentDelete when permanent delete clicked', () => {
    const onPermanentDelete = vi.fn();
    const trash = [{ id: 'd1', title: 'Deleted' }];
    render(<Sidebar pages={mockPages} trash={trash} onPermanentDelete={onPermanentDelete} />);

    fireEvent.click(screen.getByTestId('trash-toggle'));
    fireEvent.click(screen.getByTestId('trash-delete-d1'));
    expect(onPermanentDelete).toHaveBeenCalledWith('d1');
  });

  it('calls onEmptyTrash when empty trash clicked', () => {
    const onEmptyTrash = vi.fn();
    const trash = [{ id: 'd1', title: 'Deleted' }];
    render(<Sidebar pages={mockPages} trash={trash} onEmptyTrash={onEmptyTrash} />);

    fireEvent.click(screen.getByTestId('trash-toggle'));
    fireEvent.click(screen.getByTestId('empty-trash'));
    expect(onEmptyTrash).toHaveBeenCalled();
  });

  it('shows empty trash message when trash is empty', () => {
    render(<Sidebar pages={mockPages} trash={[]} />);

    fireEvent.click(screen.getByTestId('trash-toggle'));
    expect(screen.getByText('Trash is empty')).toBeDefined();
  });
});
