import { useState, useRef, useEffect } from 'react';

export interface AppMenuProps {
  pageId?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** The page on the space's remote (GitHub), when the space has one. */
  remoteLink?: { href: string; label: string };
  /** Fetch the space's remote, shown for remote spaces. */
  onRefreshSpace?: () => void;
  /** Open the current space's settings. */
  onOpenSpaceSettings?: () => void;
  /** Open the page's history, shown for spaces that keep history (REQ-NTN-016). */
  onOpenHistory?: () => void;
}

export function AppMenu({
  pageId,
  isFavorite,
  onToggleFavorite,
  onRename,
  onDuplicate,
  onDelete,
  remoteLink,
  onRefreshSpace,
  onOpenSpaceSettings,
  onOpenHistory,
}: AppMenuProps) {
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M3 11V3a1 1 0 011-1h8" />
            </svg>
            Duplicate
          </button>
          {(onOpenHistory || remoteLink || onRefreshSpace || onOpenSpaceSettings) && (
            <div className="cept-app-menu-divider" />
          )}
          {onOpenHistory && (
            <button
              className="cept-app-menu-item"
              onClick={() => {
                setOpen(false);
                onOpenHistory();
              }}
              data-testid="page-menu-history"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5V8l2.5 1.5" />
              </svg>
              Page history
            </button>
          )}
          {remoteLink && (
            <a
              className="cept-app-menu-item"
              href={remoteLink.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              data-testid="page-menu-view-remote"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M9 2h5v5M14 2L7 9M12 9v4a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4" />
              </svg>
              {remoteLink.label}
            </a>
          )}
          {onRefreshSpace && (
            <button
              className="cept-app-menu-item"
              onClick={() => {
                setOpen(false);
                onRefreshSpace();
              }}
              data-testid="page-menu-refresh-space"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M14 2v4h-4M2 14v-4h4" />
                <path d="M13.46 5.54A6 6 0 002.54 10.46M2.54 10.46A6 6 0 0013.46 5.54" />
              </svg>
              Refresh from remote
            </button>
          )}
          {onOpenSpaceSettings && (
            <button
              className="cept-app-menu-item"
              onClick={() => {
                setOpen(false);
                onOpenSpaceSettings();
              }}
              data-testid="page-menu-space-settings"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
              </svg>
              Space settings
            </button>
          )}
          <div className="cept-app-menu-divider" />
          <button
            className="cept-app-menu-item cept-app-menu-item--danger"
            onClick={() => {
              setOpen(false);
              onDelete?.(pageId);
            }}
            data-testid="page-menu-delete"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
