import { useState, useRef, useEffect } from 'react';

const GitHubIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export interface AppMenuProps {
  pageId?: string;
  isFavorite?: boolean;
  /** GitHub URL for the current page (set for remote repo pages) */
  githubUrl?: string;
  onToggleFavorite?: (id: string) => void;
  onRename?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function AppMenu({ pageId, isFavorite, githubUrl, onToggleFavorite, onRename, onDuplicate, onDelete }: AppMenuProps) {
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
      {githubUrl && (
        <a
          className="cept-app-menu-trigger cept-github-btn"
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
          data-testid="github-link-btn"
        >
          <GitHubIcon />
        </a>
      )}
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
          {githubUrl && (
            <>
              <a
                className="cept-app-menu-item"
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                data-testid="page-menu-github"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View page on GitHub
              </a>
              <button
                className="cept-app-menu-item cept-app-menu-item--disabled"
                disabled
                data-testid="page-menu-share"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="4" r="2" />
                  <circle cx="4" cy="8" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M6 7l4-2M6 9l4 2" />
                </svg>
                Share (coming soon)
              </button>
              <div className="cept-app-menu-divider" />
            </>
          )}
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
