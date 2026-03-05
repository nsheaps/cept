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
  onRename,
}: PageHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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
      </div>
    </div>
  );
}
