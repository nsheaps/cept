import { useState, useCallback, useEffect, useRef } from 'react';
import { PageTreeItem, type PageTreeNode } from './PageTreeItem.js';
import { PageContextMenu } from './PageContextMenu.js';

export interface SidebarPageRef {
  id: string;
  title: string;
  icon?: string;
  parentId?: string;
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
  onOpenSettings?: (tab?: 'settings' | 'about' | 'spaces') => void;
  onOpenDocs?: () => void;
  onOpenTrash?: () => void;
  spaces?: Array<{ id: string; name: string }>;
  activeSpaceId?: string;
  onSwitchSpace?: (id: string) => void;
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
  onSearch,
  readOnly,
  spaceName,
  onSpaceRename,
  onBackToSpace,
  onOpenSettings,
  onOpenDocs,
  onOpenTrash,
  spaces,
  activeSpaceId,
  onSwitchSpace,
}: SidebarProps) {
  const [editingSpaceName, setEditingSpaceName] = useState(false);
  const [editSpaceNameValue, setEditSpaceNameValue] = useState(spaceName ?? 'Space');
  const [spaceSwitcherOpen, setSpaceSwitcherOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const appMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!appMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (appMenuRef.current && !appMenuRef.current.contains(e.target as Node)) {
        setAppMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [appMenuOpen]);

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
          <div className="cept-sidebar-workspace-name-wrapper">
            <button
              className="cept-sidebar-workspace-name"
              onClick={() => {
                if (spaces && spaces.length > 1 && onSwitchSpace) {
                  setSpaceSwitcherOpen((p) => !p);
                }
              }}
              onDoubleClick={() => {
                if (!readOnly && onSpaceRename) {
                  setSpaceSwitcherOpen(false);
                  setEditSpaceNameValue(spaceName ?? 'Space');
                  setEditingSpaceName(true);
                }
              }}
              data-testid="sidebar-space-name"
              title={spaces && spaces.length > 1 ? 'Click to switch space, double-click to rename' : 'Double-click to rename'}
            >
              {spaceName ?? 'Space'}
              {spaces && spaces.length > 1 && (
                <svg className="cept-sidebar-workspace-chevron" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              )}
            </button>
            {spaceSwitcherOpen && spaces && onSwitchSpace && (
              <div className="cept-sidebar-space-switcher" data-testid="space-switcher-dropdown">
                {spaces.map((s) => (
                  <button
                    key={s.id}
                    className={`cept-sidebar-space-switcher-item ${s.id === activeSpaceId ? 'is-active' : ''}`}
                    onClick={() => {
                      if (s.id !== activeSpaceId) {
                        onSwitchSpace(s.id);
                      }
                      setSpaceSwitcherOpen(false);
                    }}
                    data-testid={`space-switcher-${s.id}`}
                  >
                    {s.name}
                    {s.id === activeSpaceId && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cept-sidebar-actions">
        <button
          className="cept-sidebar-search-btn"
          onClick={onSearch}
          data-testid="sidebar-search"
        >
          <svg className="cept-sidebar-action-svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
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
                className="cept-sidebar-item"
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
          {!readOnly && onPageAdd && (
            <button
              className="cept-sidebar-section-add"
              onClick={() => onPageAdd()}
              data-testid="sidebar-add-page"
              title="Add a page"
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
                readOnly={readOnly}
                onSelect={onPageSelect}
                onToggle={onPageToggle}
                onAdd={(parentId) => onPageAdd?.(parentId)}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </div>
      </div>

      <div className="cept-sidebar-footer">
        {!readOnly && (
          <button
            className="cept-sidebar-action-btn"
            onClick={onOpenTrash}
            data-testid="trash-toggle"
          >
            <svg className="cept-sidebar-action-svg" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
            </svg>
            <span>Trash</span>
            {trash.length > 0 && (
              <span className="cept-sidebar-badge" data-testid="trash-count">
                {trash.length}
              </span>
            )}
          </button>
        )}
        <div className="cept-sidebar-footer-divider" />
        <div className="cept-sidebar-app-menu-wrapper" ref={appMenuRef}>
          <button
            className="cept-sidebar-action-btn"
            onClick={() => setAppMenuOpen((prev) => !prev)}
            data-testid="sidebar-app-menu-trigger"
            title="App menu"
          >
            <svg className="cept-sidebar-action-svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
            <span>More</span>
          </button>
          {appMenuOpen && (
            <div className="cept-sidebar-app-menu" data-testid="sidebar-app-menu">
              <button
                className="cept-sidebar-app-menu-item"
                onClick={() => {
                  setAppMenuOpen(false);
                  onOpenSettings?.('settings');
                }}
                data-testid="sidebar-app-menu-settings"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="2.5" />
                  <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
                </svg>
                Settings
              </button>
              <button
                className="cept-sidebar-app-menu-item"
                onClick={() => {
                  setAppMenuOpen(false);
                  onOpenDocs?.();
                }}
                data-testid="sidebar-app-menu-help"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M6 6a2 2 0 114 0c0 1-1.5 1.5-2 2M8 11.5v.5" />
                </svg>
                Help &amp; Docs
              </button>
              <button
                className="cept-sidebar-app-menu-item"
                onClick={() => {
                  setAppMenuOpen(false);
                  onOpenSettings?.('about');
                }}
                data-testid="sidebar-app-menu-about"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 7v4M8 4.5v.5" />
                </svg>
                About Cept
              </button>
            </div>
          )}
        </div>
      </div>

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
