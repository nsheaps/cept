import { useMemo, useState } from 'react';
import { canMoveInto, moveTargets } from './page-tree-utils.js';
import type { PageTreeNode } from './PageTreeItem.js';

/**
 * MovePageDialog — the "Move to…" picker (phase-1 plan PR 60c). Lists the pages
 * a page or file can be nested under, plus the space root, with a filter box.
 * Choosing one calls `onMove` with that page's id ('' is the root).
 */

export interface MovePageDialogProps {
  pages: PageTreeNode[];
  /** The page or file being moved. */
  pageId: string;
  pageTitle: string;
  onMove: (targetId: string) => void;
  onCancel: () => void;
}

export function MovePageDialog({
  pages,
  pageId,
  pageTitle,
  onMove,
  onCancel,
}: MovePageDialogProps) {
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();
  const targets = useMemo(
    () => moveTargets(pages, pageId).filter((t) => !query || t.title.toLowerCase().includes(query)),
    [pages, pageId, query],
  );
  const rootAllowed = canMoveInto(pages, pageId, '') && (!query || 'space root'.includes(query));

  return (
    <div className="cept-wizard-overlay" onClick={onCancel} data-testid="move-page-dialog">
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="move-page-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <div className="cept-wizard-header">
          <h2 id="move-page-title">Move “{pageTitle || 'Untitled'}” to…</h2>
        </div>
        <div className="cept-wizard-content">
          <input
            className="cept-move-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a page"
            aria-label="Find a page"
            autoFocus
            data-testid="move-page-filter"
          />
          <div className="cept-move-list" role="group" aria-label="Destinations">
            {rootAllowed && (
              <button
                className="cept-move-option"
                onClick={() => onMove('')}
                data-testid="move-target-root"
              >
                Space root
              </button>
            )}
            {targets.map((t) => (
              <button
                key={t.id}
                className="cept-move-option"
                style={{ paddingLeft: `${t.depth * 16 + 12}px` }}
                onClick={() => onMove(t.id)}
                data-testid={`move-target-${t.id}`}
              >
                {t.title || 'Untitled'}
              </button>
            ))}
            {!rootAllowed && targets.length === 0 && (
              <p className="cept-wizard-desc" data-testid="move-page-empty">
                No page to move it into.
              </p>
            )}
          </div>
        </div>
        <div className="cept-wizard-footer">
          <button
            className="cept-wizard-cancel-btn"
            onClick={onCancel}
            data-testid="move-page-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
