import { useState, useCallback, useRef, useEffect } from 'react';

export interface PageHeaderProps {
  pageId: string;
  title: string;
  icon?: string;
  cover?: string;
  isFavorite?: boolean;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PageHeader({
  pageId,
  title,
  icon,
  cover,
  isFavorite,
  onRename,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: PageHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(pageId, trimmed);
    }
    setIsEditing(false);
  }, [editValue, title, pageId, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setEditValue(title);
        setIsEditing(false);
      }
    },
    [handleSave, title],
  );

  return (
    <div className="cept-page-header" data-testid="page-header">
      {cover && (
        <div className="cept-page-header-cover" data-testid="page-cover">
          <img src={cover} alt="" className="cept-page-header-cover-img" />
        </div>
      )}
      <div className="cept-page-header-title-row">
        {icon && <span className="cept-page-header-icon">{icon}</span>}
        {isEditing ? (
          <div className="cept-page-header-edit-wrapper">
            <input
              ref={inputRef}
              className="cept-page-header-title-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              data-testid="page-title-input"
            />
            <button
              className="cept-page-header-save-btn"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSave();
              }}
              data-testid="page-title-save"
              title="Save"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,8 7,12 13,4" />
              </svg>
            </button>
          </div>
        ) : (
          <h1
            className="cept-page-header-title"
            onClick={() => setIsEditing(true)}
            data-testid="page-title"
            title="Click to edit title"
          >
            {title || 'Untitled'}
          </h1>
        )}
        <div className="cept-page-header-actions">
          <button
            className="cept-page-header-menu-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            data-testid="page-menu-btn"
            title="Page actions"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="cept-page-header-menu" ref={menuRef} data-testid="page-header-menu">
              <button
                className="cept-page-header-menu-item"
                onClick={() => {
                  onToggleFavorite(pageId);
                  setMenuOpen(false);
                }}
                data-testid="page-menu-favorite"
              >
                {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </button>
              <button
                className="cept-page-header-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setIsEditing(true);
                }}
                data-testid="page-menu-rename"
              >
                Rename
              </button>
              <button
                className="cept-page-header-menu-item"
                onClick={() => {
                  onDuplicate(pageId);
                  setMenuOpen(false);
                }}
                data-testid="page-menu-duplicate"
              >
                Duplicate
              </button>
              <div className="cept-page-header-menu-divider" />
              <button
                className="cept-page-header-menu-item cept-page-header-menu-item--danger"
                onClick={() => {
                  onDelete(pageId);
                  setMenuOpen(false);
                }}
                data-testid="page-menu-delete"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
