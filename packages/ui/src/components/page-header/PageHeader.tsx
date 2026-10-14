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
  /** Set (or, with undefined, remove) the page icon. Without it the header shows no icon picker. */
  onIconChange?: (id: string, icon: string | undefined) => void;
  /** Set (or, with undefined, remove) the page cover image URL or path. */
  onCoverChange?: (id: string, cover: string | undefined) => void;
  /** Comments by other people since this page was last opened here (REQ-NTN-008). */
  newComments?: number;
}

const ICON_CHOICES = [
  '📄',
  '📝',
  '📚',
  '📌',
  '✅',
  '💡',
  '🚀',
  '🎯',
  '📅',
  '🗂️',
  '🔧',
  '🧪',
  '⭐',
  '❤️',
  '🏠',
  '🌱',
];

/** True when the text is exactly one user-perceived character (one emoji, including ZWJ sequences). */
function isSingleSymbol(text: string): boolean {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return (
      [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length === 1
    );
  }
  return [...text].length === 1;
}

export function PageHeader({
  pageId,
  title,
  icon,
  cover,
  onRename,
  onIconChange,
  onCoverChange,
  newComments = 0,
}: PageHeaderProps) {
  const [picker, setPicker] = useState<'icon' | 'cover' | null>(null);
  const [iconValue, setIconValue] = useState('');
  const [iconError, setIconError] = useState(false);
  const [coverValue, setCoverValue] = useState(cover ?? '');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    setCoverValue(cover ?? '');
  }, [cover]);

  // Another page was opened: close any picker left open.
  useEffect(() => {
    setPicker(null);
  }, [pageId]);

  const chooseIcon = (value: string | undefined) => {
    onIconChange?.(pageId, value);
    setIconValue('');
    setPicker(null);
  };

  const saveCover = (value: string | undefined) => {
    onCoverChange?.(pageId, value);
    setPicker(null);
  };

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
      {onCoverChange && (
        <div className="cept-page-header-actions">
          {!icon && onIconChange && (
            <button
              className="cept-page-header-action"
              data-testid="add-icon"
              onClick={() => setPicker(picker === 'icon' ? null : 'icon')}
            >
              Add icon
            </button>
          )}
          <button
            className="cept-page-header-action"
            data-testid="edit-cover"
            onClick={() => setPicker(picker === 'cover' ? null : 'cover')}
          >
            {cover ? 'Change cover' : 'Add cover'}
          </button>
        </div>
      )}
      {picker === 'icon' && onIconChange && (
        <div className="cept-page-header-picker" data-testid="icon-picker">
          <div className="cept-page-header-icon-grid">
            {ICON_CHOICES.map((emoji) => (
              <button
                key={emoji}
                className="cept-page-header-icon-choice"
                aria-label={`Use ${emoji}`}
                onClick={() => chooseIcon(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = iconValue.trim();
              if (!trimmed) return;
              if (!isSingleSymbol(trimmed)) {
                setIconError(true);
                return;
              }
              chooseIcon(trimmed);
            }}
          >
            <input
              className="cept-page-header-picker-input"
              data-testid="icon-input"
              placeholder="Type or paste an emoji"
              value={iconValue}
              onChange={(e) => {
                setIconValue(e.target.value);
                setIconError(false);
              }}
            />
            {iconError && (
              <span className="cept-page-header-picker-error" data-testid="icon-error">
                Enter a single emoji.
              </span>
            )}
          </form>
          {icon && (
            <button
              className="cept-page-header-action"
              data-testid="remove-icon"
              onClick={() => chooseIcon(undefined)}
            >
              Remove icon
            </button>
          )}
        </div>
      )}
      {picker === 'cover' && onCoverChange && (
        <div className="cept-page-header-picker" data-testid="cover-picker">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = coverValue.trim();
              saveCover(trimmed === '' ? undefined : trimmed);
            }}
          >
            <input
              className="cept-page-header-picker-input"
              data-testid="cover-input"
              placeholder="Image URL (https://…)"
              value={coverValue}
              onChange={(e) => setCoverValue(e.target.value)}
            />
          </form>
          {cover && (
            <button
              className="cept-page-header-action"
              data-testid="remove-cover"
              onClick={() => saveCover(undefined)}
            >
              Remove cover
            </button>
          )}
        </div>
      )}
      <div className="cept-page-header-title-row">
        {icon &&
          (onIconChange ? (
            <button
              type="button"
              className="cept-page-header-icon"
              title="Change icon"
              data-testid="page-icon"
              onClick={() => setPicker(picker === 'icon' ? null : 'icon')}
            >
              {icon}
            </button>
          ) : (
            <span className="cept-page-header-icon">{icon}</span>
          ))}
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
        {newComments > 0 && (
          <span className="cept-page-header-new-comments" data-testid="page-new-comments">
            {newComments} new {newComments === 1 ? 'comment' : 'comments'}
          </span>
        )}
      </div>
    </div>
  );
}
