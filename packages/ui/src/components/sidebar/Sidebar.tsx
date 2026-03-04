import { PageTreeItem, type PageTreeNode } from './PageTreeItem.js';

export interface SidebarProps {
  pages: PageTreeNode[];
  selectedPageId?: string;
  onPageSelect?: (id: string) => void;
  onPageToggle?: (id: string) => void;
  onPageAdd?: (parentId?: string) => void;
  onSearch?: () => void;
}

export function Sidebar({
  pages,
  selectedPageId,
  onPageSelect,
  onPageToggle,
  onPageAdd,
  onSearch,
}: SidebarProps) {
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
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
