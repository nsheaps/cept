/**
 * FolderView — displays a directory listing of child pages.
 *
 * Shown below the editor for pages that have children,
 * similar to Notion's "subpages" widget.
 */

import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

export interface FolderViewProps {
  children: PageTreeNode[];
  onPageSelect: (pageId: string) => void;
}

export function FolderView({ children, onPageSelect }: FolderViewProps) {
  if (children.length === 0) return null;

  return (
    <div className="cept-folder-view" data-testid="folder-view">
      {children.map((child) => (
        <button
          key={child.id}
          className="cept-folder-view-item"
          data-testid={`folder-item-${child.id}`}
          onClick={() => onPageSelect(child.id)}
        >
          <span className="cept-folder-view-icon">
            {child.icon ?? (child.children.length > 0 ? '\uD83D\uDCC1' : '\uD83D\uDCC4')}
          </span>
          <span className="cept-folder-view-title">{child.title || 'Untitled'}</span>
          {child.children.length > 0 && (
            <span className="cept-folder-view-count">{child.children.length}</span>
          )}
        </button>
      ))}
    </div>
  );
}
