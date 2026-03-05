import { useState, useRef, useEffect } from 'react';

export interface AppMenuProps {
  pageId?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AppMenu({ pageId, isFavorite, onToggleFavorite, onRename, onDuplicate, onDelete }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!pageId) return null;

  return (
    <div className="cept-app-menu-wrapper" ref={menuRef} data-testid="page-menu-wrapper">
      <button
        className="cept-app-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="page-menu-btn"
        title="Page actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="cept-app-menu" data-testid="page-menu">
          <button
            className="cept-app-menu-item"
            onClick={() => {
              setOpen(false);
              onToggleFavorite?.(pageId);
            }}
            data-testid="page-menu-favorite"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7z" />
            </svg>
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </button>
          <button
            className="cept-app-menu-item"
            onClick={() => {
              setOpen(false);
              onRename?.(pageId);
            }}
            data-testid="page-menu-rename"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11.5 1.5l3 3L5 14H2v-3z" />
            </svg>
            Rename
          </button>
          <button
            className="cept-app-menu-item"
            onClick={() => {
              setOpen(false);
              onDuplicate?.(pageId);
            }}
            data-testid="page-menu-duplicate"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M3 11V3a1 1 0 011-1h8" />
            </svg>
            Duplicate
          </button>
          <div className="cept-app-menu-divider" />
          <button
            className="cept-app-menu-item cept-app-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onDelete?.(pageId);
            }}
            data-testid="page-menu-delete"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
