import { useState, useCallback, useEffect } from 'react';
import { PageTreeItem, type PageTreeNode } from './PageTreeItem.js';
import { PageContextMenu } from './PageContextMenu.js';
import { AppMenu } from '../app-menu/AppMenu.js';

export interface SidebarPageRef {
  id: string;
  title: string;
  icon?: string;
}

export interface SidebarProps {
  pages: PageTreeNode[];
  favorites?: SidebarPageRef[];
  recentPages?: SidebarPageRef[];
  trash?: SidebarPageRef[];
  selectedPageId?: string;
  onPageSelect?: (id: string) => void;
  onPageToggle?: (id: string) => void;
  onPageAdd?: (parentId?: string) => void;
  onPageRename?: (id: string, title: string) => void;
  onPageDuplicate?: (id: string) => void;
  onPageDelete?: (id: string) => void;
  onPageMoveToRoot?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onRestoreFromTrash?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onEmptyTrash?: () => void;
  onSearch?: () => void;
  readOnly?: boolean;
  spaceName?: string;
  onSpaceRename?: (name: string) => void;
  onBackToSpace?: () => void;
  onOpenSettings?: (tab?: 'settings' | 'about' | 'data' | 'spaces') => void;
  onOpenDocs?: () => void;
}

export function Sidebar({
  pages,
  favorites = [],
  recentPages = [],
  trash = [],
  selectedPageId,
  onPageSelect,
  onPageToggle,
  onPageAdd,
  onPageRename,
  onPageDuplicate,
  onPageDelete,
  onPageMoveToRoot,
  onToggleFavorite,
  onRestoreFromTrash,
  onPermanentDelete,
  onEmptyTrash,
  onSearch,
  readOnly,
  spaceName,
  onSpaceRename,
  onBackToSpace,
  onOpenSettings,
  onOpenDocs,
}: SidebarProps) {
  const [trashExpanded, setTrashExpanded] = useState(false);
  const [editingSpaceName, setEditingSpaceName] = useState(false);
  const [editSpaceNameValue, setEditSpaceNameValue] = useState(spaceName ?? 'Space');
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
        {onBackToSpace && (
          <button
            className="cept-sidebar-back-btn"
            onClick={onBackToSpace}
            data-testid="sidebar-back-to-space"
            title="Back to my space"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4l-4 4 4 4" />
            </svg>
          </button>
        )}
        {editingSpaceName && !readOnly && onSpaceRename ? (
          <input
            className="cept-sidebar-workspace-name-input"
            value={editSpaceNameValue}
            onChange={(e) => setEditSpaceNameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editSpaceNameValue.trim()) {
                onSpaceRename(editSpaceNameValue.trim());
                setEditingSpaceName(false);
              }
              if (e.key === 'Escape') {
                setEditSpaceNameValue(spaceName ?? 'Space');
                setEditingSpaceName(false);
              }
            }}
            onBlur={() => {
              if (editSpaceNameValue.trim() && editSpaceNameValue.trim() !== (spaceName ?? 'Space')) {
                onSpaceRename(editSpaceNameValue.trim());
              }
              setEditingSpaceName(false);
            }}
            autoFocus
            data-testid="sidebar-space-name-input"
          />
        ) : (
          <span
            className="cept-sidebar-workspace-name"
            onDoubleClick={() => {
              if (!readOnly && onSpaceRename) {
                setEditSpaceNameValue(spaceName ?? 'Space');
                setEditingSpaceName(true);
              }
            }}
            data-testid="sidebar-space-name"
          >
            {spaceName ?? 'Space'}
          </span>
        )}
        {!readOnly && (
          <div className="cept-sidebar-header-menu">
            <AppMenu onOpenSettings={onOpenSettings} onOpenDocs={onOpenDocs} />
          </div>
        )}
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
          {!readOnly && (
            <button
              className="cept-sidebar-section-add"
              onClick={() => onPageAdd?.()}
              data-testid="sidebar-add-page"
            >
              +
            </button>
          )}
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

      {!readOnly && <div className="cept-sidebar-section cept-sidebar-section--compact" data-testid="trash-section">
        <button
          className="cept-sidebar-action-btn"
          onClick={() => setTrashExpanded((prev) => !prev)}
          data-testid="trash-toggle"
        >
          <span className="cept-sidebar-action-icon">{'\u{1F5D1}'}</span>
          <span>Trash</span>
          {trash.length > 0 && (
            <span className="cept-sidebar-badge" data-testid="trash-count">
              {trash.length}
            </span>
          )}
        </button>
        {trashExpanded && (
          <div className="cept-sidebar-tree" data-testid="trash-list">
            {trash.length === 0 ? (
              <div className="cept-sidebar-empty">Trash is empty</div>
            ) : (
              <>
                {trash.map((item) => (
                  <div key={item.id} className="cept-sidebar-trash-item" data-testid={`trash-item-${item.id}`}>
                    <span className="cept-sidebar-icon">{item.icon ?? '\u{1F4C4}'}</span>
                    <span className="cept-sidebar-title">{item.title || 'Untitled'}</span>
                    <button
                      className="cept-sidebar-trash-action"
                      onClick={() => onRestoreFromTrash?.(item.id)}
                      title="Restore"
                      data-testid={`trash-restore-${item.id}`}
                    >
                      {'\u21A9'}
                    </button>
                    <button
                      className="cept-sidebar-trash-action cept-sidebar-trash-action--danger"
                      onClick={() => onPermanentDelete?.(item.id)}
                      title="Delete permanently"
                      data-testid={`trash-delete-${item.id}`}
                    >
                      {'\u2715'}
                    </button>
                  </div>
                ))}
                <button
                  className="cept-sidebar-action-btn cept-sidebar-empty-trash"
                  onClick={onEmptyTrash}
                  data-testid="empty-trash"
                >
                  Empty trash
                </button>
              </>
            )}
          </div>
        )}
      </div>}

      {contextMenu && !readOnly && (
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
