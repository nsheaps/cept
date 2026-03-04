/**
 * ExportDialog — dialog for exporting pages to Markdown, HTML, or PDF.
 */

import { useState, useCallback } from 'react';
import type { ExportFormat, ExportedFile, PageContent } from '@cept/core';
import { exportPage } from '@cept/core';

export interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The page to export */
  page: PageContent | null;
}

export function ExportDialog({ isOpen, onClose, page }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeFrontMatter, setIncludeFrontMatter] = useState(true);
  const [exported, setExported] = useState<ExportedFile | null>(null);

  const handleExport = useCallback(() => {
    if (!page) return;
    const result = exportPage(page, { format, includeFrontMatter });
    setExported(result);

    // Trigger download
    const blobContent = typeof result.content === 'string'
      ? result.content
      : new Uint8Array(result.content) as BlobPart;
    const blob = new Blob([blobContent], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [page, format, includeFrontMatter]);

  const handleClose = useCallback(() => {
    setExported(null);
    onClose();
  }, [onClose]);

  if (!isOpen || !page) return null;

  return (
    <div className="cept-modal-overlay" data-testid="export-dialog">
      <div className="cept-modal-content" style={{ maxWidth: 400 }}>
        <div className="cept-modal-header">
          <h2>Export Page</h2>
          <button
            className="cept-modal-close"
            onClick={handleClose}
            data-testid="export-close"
          >
            &times;
          </button>
        </div>

        <div className="cept-modal-body">
          {!exported ? (
            <div data-testid="export-options">
              <p style={{ marginBottom: '0.5rem' }}>
                Exporting: <strong>{page.title}</strong>
              </p>

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Format:
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  data-testid="export-format"
                  style={{ marginLeft: '0.5rem' }}
                >
                  <option value="markdown">Markdown</option>
                  <option value="html">HTML</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>

              {format === 'markdown' && (
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  <input
                    type="checkbox"
                    checked={includeFrontMatter}
                    onChange={(e) => setIncludeFrontMatter(e.target.checked)}
                    data-testid="export-frontmatter"
                  />
                  {' '}Include front matter
                </label>
              )}

              <button
                onClick={handleExport}
                data-testid="export-button"
                style={{ marginTop: '0.5rem' }}
              >
                Export
              </button>
            </div>
          ) : (
            <div data-testid="export-done">
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                Exported: {exported.filename}
              </p>
              <button onClick={handleClose} data-testid="export-done-close">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
