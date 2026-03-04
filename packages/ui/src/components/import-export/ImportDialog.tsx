/**
 * ImportDialog — unified dialog for importing from Notion or Obsidian.
 *
 * The user picks a ZIP file (Notion) or folder (Obsidian), the import runs
 * with a progress indicator, and results are shown at the end.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  ImportProgress,
  NotionImportResult,
  ObsidianImportResult,
  ImportedPage,
  ZipReader,
  ZipEntry,
  VaultReader,
  VaultFile,
} from '@cept/core';
import { importNotionZip, importObsidianVault } from '@cept/core';

export type ImportSource = 'notion' | 'obsidian';

export interface ImportDialogProps {
  isOpen: boolean;
  source: ImportSource;
  onClose: () => void;
  /** Called with imported pages so the app can persist them */
  onImportComplete: (pages: ImportedPage[]) => void;
}

type ImportState = 'idle' | 'importing' | 'done' | 'error';

/**
 * Create a ZipReader from a browser File object.
 * Uses the in-memory data approach since we can't rely on external zip libraries.
 */
function createBrowserZipReader(file: File): ZipReader {
  // Simple ZIP reader that extracts entries from the file
  return {
    async getEntries(): Promise<ZipEntry[]> {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      return extractZipEntries(data);
    },
    async close(): Promise<void> {},
  };
}

/**
 * Minimal ZIP entry extractor. For production use, a proper ZIP library
 * (like fflate) would be better, but this handles basic Notion exports.
 */
function extractZipEntries(data: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break; // Local file header signature

    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const name = new TextDecoder().decode(data.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    const fileData = data.slice(dataStart, dataStart + compressedSize);

    if (!name.endsWith('/')) {
      entries.push({
        path: name,
        isDirectory: false,
        getData: async () => fileData,
      });
    }

    offset = dataStart + compressedSize;
  }

  return entries;
}

/**
 * Create a VaultReader from FileSystemDirectoryHandle entries.
 * Falls back to a simple list of File objects from an <input> element.
 */
function createBrowserVaultReader(files: FileList): VaultReader {
  return {
    async listFiles(): Promise<VaultFile[]> {
      const result: VaultFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        result.push({
          path,
          isDirectory: false,
          getData: async () => new Uint8Array(await file.arrayBuffer()),
        });
      }
      return result;
    },
  };
}

export function ImportDialog({ isOpen, source, onClose, onImportComplete }: ImportDialogProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<NotionImportResult | ObsidianImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setState('importing');
    setProgress(null);
    setError(null);

    try {
      if (source === 'notion') {
        const file = files[0];
        const zipReader = createBrowserZipReader(file);
        const importResult = await importNotionZip(zipReader, {}, (p) => setProgress(p));
        setResult(importResult);
        onImportComplete(importResult.pages);
      } else {
        const vaultReader = createBrowserVaultReader(files);
        const importResult = await importObsidianVault(vaultReader, {}, (p) => setProgress(p));
        setResult(importResult);
        onImportComplete(importResult.pages);
      }
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }, [source, onImportComplete]);

  const handleReset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  if (!isOpen) return null;

  const title = source === 'notion' ? 'Import from Notion' : 'Import from Obsidian';
  const accept = source === 'notion' ? '.zip' : undefined;

  return (
    <div className="cept-modal-overlay" data-testid="import-dialog">
      <div className="cept-modal-content" style={{ maxWidth: 500 }}>
        <div className="cept-modal-header">
          <h2>{title}</h2>
          <button
            className="cept-modal-close"
            onClick={onClose}
            data-testid="import-close"
          >
            &times;
          </button>
        </div>

        <div className="cept-modal-body">
          {state === 'idle' && (
            <div data-testid="import-idle">
              <p style={{ marginBottom: '1rem' }}>
                {source === 'notion'
                  ? 'Select a Notion export ZIP file to import your pages and databases.'
                  : 'Select your Obsidian vault folder to import your notes.'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                data-testid="import-file-input"
                {...(source === 'obsidian' ? { webkitdirectory: '', directory: '' } as Record<string, string> : {})}
              />
            </div>
          )}

          {state === 'importing' && progress && (
            <div data-testid="import-progress">
              <p>Importing: {progress.currentFile}</p>
              <div className="cept-progress-bar">
                <div
                  className="cept-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p>{progress.processed} / {progress.total} files</p>
            </div>
          )}

          {state === 'importing' && !progress && (
            <div data-testid="import-loading">
              <p>Starting import...</p>
            </div>
          )}

          {state === 'done' && result && (
            <div data-testid="import-done">
              <p style={{ color: 'green', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Import complete!
              </p>
              <ul>
                <li>{result.pages.length} pages imported</li>
                <li>{result.assets.length} assets imported</li>
                {result.errors.length > 0 && (
                  <li style={{ color: 'orange' }}>{result.errors.length} errors</li>
                )}
                {result.skippedFiles > 0 && (
                  <li>{result.skippedFiles} files skipped</li>
                )}
              </ul>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={onClose} data-testid="import-done-close">
                  Done
                </button>
                <button onClick={handleReset} data-testid="import-another">
                  Import Another
                </button>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div data-testid="import-error">
              <p style={{ color: 'red' }}>Error: {error}</p>
              <button onClick={handleReset} data-testid="import-retry">
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
