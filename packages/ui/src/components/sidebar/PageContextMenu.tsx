import { useState } from 'react';

export interface PageContextMenuProps {
  pageId: string;
  pageTitle: string;
  position: { x: number; y: number };
  isFavorite?: boolean;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMoveToRoot: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onClose: () => void;
}

export function PageContextMenu({
  pageId,
  pageTitle,
  position,
  isFavorite,
  onRename,
  onDuplicate,
  onDelete,
  onMoveToRoot,
  onToggleFavorite,
  onClose,
}: PageContextMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(pageTitle);

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onRename(pageId, renameValue.trim());
    }
    onClose();
  };

  if (isRenaming) {
    return (
      <div
        className="cept-context-menu"
        style={{ top: position.y, left: position.x }}
        data-testid="page-rename-input"
      >
        <input
          className="cept-context-menu-rename-input"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit();
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
          data-testid="rename-input"
        />
      </div>
    );
  }

  return (
    <div
      className="cept-context-menu"
      style={{ top: position.y, left: position.x }}
      data-testid="page-context-menu"
    >
      {onToggleFavorite && (
        <button
          className="cept-context-menu-item"
          onClick={() => { onToggleFavorite(pageId); onClose(); }}
          data-testid="ctx-toggle-favorite"
        >
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        </button>
      )}
      <button
        className="cept-context-menu-item"
        onClick={() => setIsRenaming(true)}
        data-testid="ctx-rename"
      >
        Rename
      </button>
      <button
        className="cept-context-menu-item"
        onClick={() => { onDuplicate(pageId); onClose(); }}
        data-testid="ctx-duplicate"
      >
        Duplicate
      </button>
      <button
        className="cept-context-menu-item"
        onClick={() => { onMoveToRoot(pageId); onClose(); }}
        data-testid="ctx-move-to-root"
      >
        Move...
      </button>
      <div className="cept-context-menu-divider" />
      <button
        className="cept-context-menu-item cept-context-menu-item--danger"
        onClick={() => { onDelete(pageId); onClose(); }}
        data-testid="ctx-delete"
      >
        Delete
      </button>
    </div>
  );
}
