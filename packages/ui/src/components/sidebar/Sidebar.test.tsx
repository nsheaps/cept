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

  it('renders space name', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByText('Space')).toBeDefined();
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

  it('calls onPageAdd when new page button is clicked', () => {
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

  it('renders trash button in footer', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.getByTestId('trash-toggle')).toBeDefined();
  });

  it('calls onOpenTrash when trash button clicked', () => {
    const onOpenTrash = vi.fn();
    render(<Sidebar pages={mockPages} onOpenTrash={onOpenTrash} />);

    fireEvent.click(screen.getByTestId('trash-toggle'));
    expect(onOpenTrash).toHaveBeenCalled();
  });

  it('shows trash count badge', () => {
    const trash = [
      { id: 'd1', title: 'Page 1' },
      { id: 'd2', title: 'Page 2' },
    ];
    render(<Sidebar pages={mockPages} trash={trash} />);
    expect(screen.getByTestId('trash-count').textContent).toBe('2');
  });

  it('renders custom space name', () => {
    render(<Sidebar pages={mockPages} spaceName="My Workspace" />);
    expect(screen.getByText('My Workspace')).toBeDefined();
  });

  it('updates displayed space name when spaceName prop changes', () => {
    const { rerender } = render(<Sidebar pages={mockPages} spaceName="Demo Space" />);
    expect(screen.getByText('Demo Space')).toBeDefined();
    rerender(<Sidebar pages={mockPages} spaceName="New Project" />);
    expect(screen.getByText('New Project')).toBeDefined();
    expect(screen.queryByText('Demo Space')).toBeNull();
  });

  it('renders back button when onBackToSpace is provided', () => {
    const onBackToSpace = vi.fn();
    render(<Sidebar pages={mockPages} onBackToSpace={onBackToSpace} />);
    const btn = screen.getByTestId('sidebar-back-to-space');
    expect(btn).toBeDefined();
    fireEvent.click(btn);
    expect(onBackToSpace).toHaveBeenCalled();
  });

  it('does not render back button when onBackToSpace is not provided', () => {
    render(<Sidebar pages={mockPages} />);
    expect(screen.queryByTestId('sidebar-back-to-space')).toBeNull();
  });

  it('hides add page button and trash in readOnly mode', () => {
    render(<Sidebar pages={mockPages} readOnly />);
    expect(screen.queryByTestId('sidebar-add-page')).toBeNull();
    expect(screen.queryByTestId('trash-toggle')).toBeNull();
  });

  it('shows add page button, trash, and app menu when not readOnly', () => {
    render(<Sidebar pages={mockPages} onPageAdd={vi.fn()} />);
    expect(screen.getByTestId('sidebar-add-page')).toBeDefined();
    expect(screen.getByTestId('trash-toggle')).toBeDefined();
    expect(screen.getByTestId('sidebar-app-menu-trigger')).toBeDefined();
  });

  it('opens app menu and shows settings, help, about items', () => {
    render(<Sidebar pages={mockPages} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    expect(screen.getByTestId('sidebar-app-menu')).toBeDefined();
    expect(screen.getByTestId('sidebar-app-menu-settings')).toBeDefined();
    expect(screen.getByTestId('sidebar-app-menu-help')).toBeDefined();
    expect(screen.getByTestId('sidebar-app-menu-about')).toBeDefined();
  });

  it('calls onOpenSettings with settings tab when settings clicked in app menu', () => {
    const onOpenSettings = vi.fn();
    render(<Sidebar pages={mockPages} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-settings'));
    expect(onOpenSettings).toHaveBeenCalledWith('settings');
  });

  it('calls onOpenDocs when help clicked in app menu', () => {
    const onOpenDocs = vi.fn();
    render(<Sidebar pages={mockPages} onOpenDocs={onOpenDocs} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-help'));
    expect(onOpenDocs).toHaveBeenCalled();
  });

  it('calls onOpenSettings with about tab when about clicked in app menu', () => {
    const onOpenSettings = vi.fn();
    render(<Sidebar pages={mockPages} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-about'));
    expect(onOpenSettings).toHaveBeenCalledWith('about');
  });

  it('shows export space button in app menu when handler provided', () => {
    const onExportSpace = vi.fn();
    render(<Sidebar pages={mockPages} onExportSpace={onExportSpace} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    expect(screen.getByTestId('sidebar-app-menu-export-space')).toBeDefined();
  });

  it('calls onExportSpace when export space clicked in app menu', () => {
    const onExportSpace = vi.fn();
    render(<Sidebar pages={mockPages} onExportSpace={onExportSpace} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-export-space'));
    expect(onExportSpace).toHaveBeenCalled();
  });

  it('shows import space button in app menu when handler provided', () => {
    const onImportSpace = vi.fn();
    render(<Sidebar pages={mockPages} onImportSpace={onImportSpace} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    expect(screen.getByTestId('sidebar-app-menu-import-space')).toBeDefined();
  });

  it('calls onImportSpace when import space clicked in app menu', () => {
    const onImportSpace = vi.fn();
    render(<Sidebar pages={mockPages} onImportSpace={onImportSpace} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-import-space'));
    expect(onImportSpace).toHaveBeenCalled();
  });

  it('does not show export/import space buttons when handlers not provided', () => {
    render(<Sidebar pages={mockPages} />);
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    expect(screen.queryByTestId('sidebar-app-menu-export-space')).toBeNull();
    expect(screen.queryByTestId('sidebar-app-menu-import-space')).toBeNull();
  });
});
