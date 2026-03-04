import { useState, useRef, useEffect } from 'react';

export interface AppMenuProps {
  onClearCache?: () => void;
}

export function AppMenu({ onClearCache }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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

  return (
    <div className="cept-app-menu-wrapper" ref={menuRef} data-testid="app-menu-wrapper">
      <button
        className="cept-app-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        data-testid="app-menu-trigger"
        title="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="cept-app-menu" data-testid="app-menu">
          <button
            className="cept-app-menu-item"
            onClick={() => { setOpen(false); setAboutOpen(true); }}
            data-testid="app-menu-about"
          >
            About Cept
          </button>
          <div className="cept-app-menu-divider" />
          <button
            className="cept-app-menu-item"
            disabled
            data-testid="app-menu-settings"
          >
            Settings
            <span className="cept-app-menu-badge">Soon</span>
          </button>
          <button
            className="cept-app-menu-item"
            onClick={() => {
              onClearCache?.();
              setOpen(false);
            }}
            data-testid="app-menu-clear-cache"
          >
            Clear data &amp; cache
          </button>
          <div className="cept-app-menu-divider" />
          <button
            className="cept-app-menu-item"
            disabled
            data-testid="app-menu-import"
          >
            Import
            <span className="cept-app-menu-badge">Soon</span>
          </button>
          <button
            className="cept-app-menu-item"
            disabled
            data-testid="app-menu-export"
          >
            Export
            <span className="cept-app-menu-badge">Soon</span>
          </button>
        </div>
      )}
      {aboutOpen && (
        <div className="cept-about-overlay" data-testid="about-dialog">
          <div className="cept-about-dialog">
            <h2>About Cept</h2>
            <p>A Notion-inspired workspace that runs entirely in your browser.</p>
            <p className="cept-about-version">Version 0.1.0</p>
            <button
              className="cept-about-close"
              onClick={() => setAboutOpen(false)}
              data-testid="about-close"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
