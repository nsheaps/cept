/**
 * SpaceExportDialog — exports a space as a ZIP archive.
 *
 * Uses @cept/core's exportSpace to collect files, then uses the browser's
 * minimal ZIP builder to create a downloadable archive.
 */

import { useState, useCallback } from 'react';
import type { StorageBackend, SpaceExportResult, ExportProgress } from '@cept/core';
import { exportSpace } from '@cept/core';

export interface SpaceExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  backend: StorageBackend;
  spaceId: string;
  spaceName: string;
  spaceIcon?: string;
}

type ExportState = 'options' | 'exporting' | 'done' | 'error';

/**
 * Build a minimal uncompressed ZIP file from a list of entries.
 * Each entry: { path: string, data: Uint8Array }
 */
function buildZip(entries: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.path);
    // Local file header (30 bytes + name + data)
    const header = new Uint8Array(30 + nameBytes.length);
    const hv = new DataView(header.buffer);
    hv.setUint32(0, 0x04034b50, true);   // Local file header signature
    hv.setUint16(4, 20, true);            // Version needed
    hv.setUint16(6, 0, true);             // General purpose flag
    hv.setUint16(8, 0, true);             // Compression: store (no compression)
    hv.setUint16(10, 0, true);            // Mod time
    hv.setUint16(12, 0, true);            // Mod date
    hv.setUint32(14, 0, true);            // CRC-32 (0 for simplicity)
    hv.setUint32(18, entry.data.length, true);  // Compressed size
    hv.setUint32(22, entry.data.length, true);  // Uncompressed size
    hv.setUint16(26, nameBytes.length, true);   // Filename length
    hv.setUint16(28, 0, true);            // Extra field length
    header.set(nameBytes, 30);

    parts.push(header);
    parts.push(entry.data);

    // Central directory entry (46 bytes + name)
    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);   // Central dir signature
    cv.setUint16(4, 20, true);            // Version made by
    cv.setUint16(6, 20, true);            // Version needed
    cv.setUint16(8, 0, true);             // General purpose flag
    cv.setUint16(10, 0, true);            // Compression
    cv.setUint16(12, 0, true);            // Mod time
    cv.setUint16(14, 0, true);            // Mod date
    cv.setUint32(16, 0, true);            // CRC-32
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);            // Extra field length
    cv.setUint16(32, 0, true);            // Comment length
    cv.setUint16(34, 0, true);            // Disk number start
    cv.setUint16(36, 0, true);            // Internal file attrs
    cv.setUint32(38, 0, true);            // External file attrs
    cv.setUint32(42, offset, true);       // Offset of local header
    cdEntry.set(nameBytes, 46);

    centralDir.push(cdEntry);
    offset += header.length + entry.data.length;
  }

  // End of central directory record
  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);        // EOCD signature
  ev.setUint16(4, 0, true);                  // Disk number
  ev.setUint16(6, 0, true);                  // Disk with CD
  ev.setUint16(8, entries.length, true);      // CD entries on disk
  ev.setUint16(10, entries.length, true);     // Total CD entries
  ev.setUint32(12, cdSize, true);             // CD size
  ev.setUint32(16, cdOffset, true);           // CD offset
  ev.setUint16(20, 0, true);                 // Comment length
  parts.push(eocd);

  // Concatenate all parts
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

export function SpaceExportDialog({
  isOpen,
  onClose,
  backend,
  spaceId,
  spaceName,
  spaceIcon,
}: SpaceExportDialogProps) {
  const [state, setState] = useState<ExportState>('options');
  const [includeDatabases, setIncludeDatabases] = useState(true);
  const [includeAssets, setIncludeAssets] = useState(true);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<SpaceExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setState('exporting');
    setProgress(null);
    setError(null);

    try {
      const exportResult = await exportSpace(backend, spaceId, spaceName, spaceIcon, {
        includeDatabases,
        includeAssets,
        onProgress: (p) => setProgress(p),
      });

      setResult(exportResult);

      // Build and download ZIP
      const zipData = buildZip(
        exportResult.files.map((f) => ({ path: f.archivePath, data: f.data })),
      );
      const blob = new Blob([new Uint8Array(zipData)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${spaceName.replace(/[^a-zA-Z0-9-_ ]/g, '')}.cept.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setState('error');
    }
  }, [backend, spaceId, spaceName, spaceIcon, includeDatabases, includeAssets]);

  const handleClose = useCallback(() => {
    setState('options');
    setProgress(null);
    setResult(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="cept-modal-overlay" data-testid="space-export-dialog">
      <div className="cept-modal-content" style={{ maxWidth: 450 }}>
        <div className="cept-modal-header">
          <h2>Export Space</h2>
          <button className="cept-modal-close" onClick={handleClose} data-testid="space-export-close">
            &times;
          </button>
        </div>

        <div className="cept-modal-body">
          {state === 'options' && (
            <div data-testid="space-export-options">
              <p style={{ marginBottom: '0.75rem' }}>
                Export <strong>{spaceName}</strong> as a ZIP archive.
              </p>

              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={includeDatabases}
                  onChange={(e) => setIncludeDatabases(e.target.checked)}
                  data-testid="space-export-databases"
                />
                {' '}Include databases
              </label>

              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={includeAssets}
                  onChange={(e) => setIncludeAssets(e.target.checked)}
                  data-testid="space-export-assets"
                />
                {' '}Include assets (images, attachments)
              </label>

              <button
                onClick={handleExport}
                data-testid="space-export-button"
                style={{ marginTop: '0.5rem' }}
              >
                Export Space
              </button>
            </div>
          )}

          {state === 'exporting' && (
            <div data-testid="space-export-progress">
              <p>
                {progress?.phase === 'scanning' && 'Scanning files...'}
                {progress?.phase === 'reading' && `Reading: ${progress.currentFile}`}
                {progress?.phase === 'packaging' && 'Packaging ZIP...'}
                {!progress && 'Starting export...'}
              </p>
              {progress && progress.total > 0 && (
                <div className="cept-progress-bar">
                  <div
                    className="cept-progress-fill"
                    style={{ width: `${Math.round((progress.processed / progress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {state === 'done' && result && (
            <div data-testid="space-export-done">
              <p style={{ color: 'green', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Export complete!
              </p>
              <ul>
                <li>{result.manifest.files.length} files exported</li>
                {result.errors.length > 0 && (
                  <li style={{ color: 'orange' }}>{result.errors.length} errors</li>
                )}
              </ul>
              <button onClick={handleClose} data-testid="space-export-done-close" style={{ marginTop: '1rem' }}>
                Done
              </button>
            </div>
          )}

          {state === 'error' && (
            <div data-testid="space-export-error">
              <p style={{ color: 'red' }}>Error: {error}</p>
              <button onClick={() => setState('options')} data-testid="space-export-retry">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
