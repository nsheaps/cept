import { useState, useRef, useEffect } from 'react';

export interface AppMenuProps {
  onOpenSettings?: (tab?: 'settings' | 'about' | 'data' | 'spaces') => void;
}

export function AppMenu({ onOpenSettings }: AppMenuProps) {
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
            onClick={() => {
              setOpen(false);
              onOpenSettings?.('settings');
            }}
            data-testid="app-menu-settings"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
            </svg>
            Settings
          </button>
          <button
            className="cept-app-menu-item"
            onClick={() => {
              setOpen(false);
              onOpenSettings?.('about');
            }}
            data-testid="app-menu-about"
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
  );
}
