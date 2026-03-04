import { useState, useCallback, useEffect } from 'react';
import { PageTreeItem, type PageTreeNode } from './PageTreeItem.js';
import { PageContextMenu } from './PageContextMenu.js';

export interface SidebarPageRef {
  id: string;
  title: string;
  icon?: string;
}

export interface SidebarProps {
  pages: PageTreeNode[];
  favorites?: SidebarPageRef[];
  recentPages?: SidebarPageRef[];
  selectedPageId?: string;
  onPageSelect?: (id: string) => void;
  onPageToggle?: (id: string) => void;
  onPageAdd?: (parentId?: string) => void;
  onPageRename?: (id: string, title: string) => void;
  onPageDuplicate?: (id: string) => void;
  onPageDelete?: (id: string) => void;
  onPageMoveToRoot?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onSearch?: () => void;
}

export function Sidebar({
  pages,
  favorites = [],
  recentPages = [],
  selectedPageId,
  onPageSelect,
  onPageToggle,
  onPageAdd,
  onPageRename,
  onPageDuplicate,
  onPageDelete,
  onPageMoveToRoot,
  onToggleFavorite,
  onSearch,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    pageTitle: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleContextMenu = useCallback(
    (id: string, title: string, position: { x: number; y: number }) => {
      setContextMenu({ pageId: id, pageTitle: title, position });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  return (
    <aside className="cept-sidebar" data-testid="sidebar">
      <div className="cept-sidebar-header">
        <span className="cept-sidebar-workspace-name">Workspace</span>
      </div>

      <div className="cept-sidebar-actions">
        <button
          className="cept-sidebar-action-btn"
          onClick={onSearch}
          data-testid="sidebar-search"
        >
          <span className="cept-sidebar-action-icon">{'\u{1F50D}'}</span>
          <span>Search</span>
        </button>
      </div>

      {favorites.length > 0 && (
        <div className="cept-sidebar-section cept-sidebar-section--compact" data-testid="favorites-section">
          <div className="cept-sidebar-section-header">
            <span>Favorites</span>
          </div>
          <div className="cept-sidebar-tree">
            {favorites.map((fav) => (
              <button
                key={fav.id}
                className={`cept-sidebar-item ${selectedPageId === fav.id ? 'is-selected' : ''}`}
                onClick={() => onPageSelect?.(fav.id)}
                data-testid={`favorite-${fav.id}`}
              >
                <span className="cept-sidebar-icon">{fav.icon ?? '\u{1F4C4}'}</span>
                <span className="cept-sidebar-title">{fav.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentPages.length > 0 && (
        <div className="cept-sidebar-section cept-sidebar-section--compact" data-testid="recent-section">
          <div className="cept-sidebar-section-header">
            <span>Recent</span>
          </div>
          <div className="cept-sidebar-tree">
            {recentPages.map((page) => (
              <button
                key={page.id}
                className={`cept-sidebar-item ${selectedPageId === page.id ? 'is-selected' : ''}`}
                onClick={() => onPageSelect?.(page.id)}
                data-testid={`recent-${page.id}`}
              >
                <span className="cept-sidebar-icon">{page.icon ?? '\u{1F4C4}'}</span>
                <span className="cept-sidebar-title">{page.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cept-sidebar-section">
        <div className="cept-sidebar-section-header">
          <span>Pages</span>
          <button
            className="cept-sidebar-section-add"
            onClick={() => onPageAdd?.()}
            data-testid="sidebar-add-page"
          >
            +
          </button>
        </div>
        <div className="cept-sidebar-tree" data-testid="page-tree">
          {pages.length === 0 ? (
            <div
              className="cept-sidebar-empty"
              data-testid="sidebar-empty"
            >
              No pages yet
            </div>
          ) : (
            pages.map((page) => (
              <PageTreeItem
                key={page.id}
                node={page}
                depth={0}
                selectedId={selectedPageId}
                onSelect={onPageSelect}
                onToggle={onPageToggle}
                onAdd={(parentId) => onPageAdd?.(parentId)}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </div>
      </div>
      {contextMenu && (
        <PageContextMenu
          pageId={contextMenu.pageId}
          pageTitle={contextMenu.pageTitle}
          position={contextMenu.position}
          isFavorite={favorites.some((f) => f.id === contextMenu.pageId)}
          onRename={(id, title) => onPageRename?.(id, title)}
          onDuplicate={(id) => onPageDuplicate?.(id)}
          onDelete={(id) => onPageDelete?.(id)}
          onMoveToRoot={(id) => onPageMoveToRoot?.(id)}
          onToggleFavorite={onToggleFavorite}
          onClose={closeContextMenu}
        />
      )}
    </aside>
  );
}
