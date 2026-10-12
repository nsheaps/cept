/**
 * LinkRewriteDialog — shown before a rename or move that would break links in
 * other pages (REQ-EDT-018, phase-1 plan PR 55). It lists the pages whose links
 * change and lets the user update them, move without updating, or cancel.
 */

import type { LinkRewritePreview } from '../storage/folder-space.js';

export interface LinkRewriteDialogProps {
  /** The page being renamed or moved. */
  pageTitle: string;
  preview: LinkRewritePreview;
  onUpdate: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function LinkRewriteDialog({
  pageTitle,
  preview,
  onUpdate,
  onSkip,
  onCancel,
}: LinkRewriteDialogProps) {
  const links = preview.total === 1 ? '1 link' : `${preview.total} links`;
  const pages = preview.pages.length === 1 ? '1 page' : `${preview.pages.length} pages`;
  return (
    <div className="cept-wizard-overlay" onClick={onCancel} data-testid="link-rewrite-dialog">
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="link-rewrite-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="link-rewrite-title">Update links to “{pageTitle}”?</h2>
        </div>
        <div className="cept-wizard-content">
          <p className="cept-wizard-desc">
            {links} in {pages} will change so they keep working:
          </p>
          <ul data-testid="link-rewrite-pages">
            {preview.pages.map((page) => (
              <li key={page.file}>
                {page.file} ({page.count}){page.moved ? ' — the page being moved' : ''}
              </li>
            ))}
          </ul>
        </div>
        <div className="cept-wizard-footer">
          <button
            className="cept-wizard-cancel-btn"
            onClick={onCancel}
            data-testid="link-rewrite-cancel"
          >
            Cancel
          </button>
          <button
            className="cept-wizard-cancel-btn"
            onClick={onSkip}
            data-testid="link-rewrite-skip"
          >
            Move without updating
          </button>
          <button
            className="cept-wizard-primary-btn"
            onClick={onUpdate}
            data-testid="link-rewrite-update"
          >
            Update links
          </button>
        </div>
      </div>
    </div>
  );
}
