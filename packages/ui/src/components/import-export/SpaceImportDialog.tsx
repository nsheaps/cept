/**
 * SpaceImportDialog — imports a .cept.zip archive into a new or existing space.
 *
 * Flow:
 * 1. User picks a ZIP file
 * 2. Preview phase: show manifest info + detected conflicts
 * 3. User picks conflict strategy (keep/replace/rename/skip) + target space
 * 4. Import runs with progress
 * 5. Results shown
 */

import { useState, useCallback, useRef } from 'react';
import type {
  StorageBackend,
  ConflictStrategy,
  ConflictInfo,
  ArchiveManifest,
  SpaceImportResult,
  SpaceImportProgress,
  ArchiveZipReader,
  ArchiveZipEntry,
} from '@cept/core';
import { importSpace, previewImportConflicts } from '@cept/core';

export interface SpaceImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  backend: StorageBackend;
  /** Existing spaces the user can import into */
  spaces: Array<{ id: string; name: string }>;
  /** Called when import completes so the app can refresh */
  onImportComplete: (spaceId: string, spaceName: string) => void;
}

type ImportState = 'idle' | 'previewing' | 'preview' | 'importing' | 'done' | 'error';

/**
 * Create an ArchiveZipReader from a browser File.
 * Reuses the same minimal ZIP parser from ImportDialog.
 */
function createArchiveZipReader(file: File): ArchiveZipReader {
  let cachedEntries: ArchiveZipEntry[] | null = null;

  return {
    async getEntries(): Promise<ArchiveZipEntry[]> {
      if (cachedEntries) return cachedEntries;
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      cachedEntries = extractZipEntries(data);
      return cachedEntries;
    },
    async close(): Promise<void> {
      cachedEntries = null;
    },
  };
}

function extractZipEntries(data: Uint8Array): ArchiveZipEntry[] {
  const entries: ArchiveZipEntry[] = [];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;

  while (offset < data.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

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

const CONFLICT_LABELS: Record<ConflictStrategy, string> = {
  skip: 'Skip conflicting files',
  keep: 'Keep existing files',
  replace: 'Replace with imported files',
  rename: 'Rename imported files',
};

export function SpaceImportDialog({
  isOpen,
  onClose,
  backend,
  spaces,
  onImportComplete,
}: SpaceImportDialogProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<ArchiveManifest | null>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [conflictStrategy, setConflictStrategy] = useState<ConflictStrategy>('skip');
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [targetSpaceId, setTargetSpaceId] = useState<string>('');
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [importWorkspaceState, setImportWorkspaceState] = useState(true);
  const [progress, setProgress] = useState<SpaceImportProgress | null>(null);
  const [result, setResult] = useState<SpaceImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selected = files[0];
    setFile(selected);
    setState('previewing');
    setError(null);

    try {
      const zipReader = createArchiveZipReader(selected);
      // Preview with first available space or 'default'
      const defaultTarget = spaces.length > 0 ? spaces[0].id : 'default';
      const preview = await previewImportConflicts(backend, zipReader, defaultTarget);

      setManifest(preview.manifest);
      setConflicts(preview.conflicts);
      setNewSpaceName(preview.manifest.space.name ?? 'Imported Space');
      setTargetSpaceId(defaultTarget);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read archive');
      setState('error');
    }
  }, [backend, spaces]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setState('importing');
    setProgress(null);

    try {
      const zipReader = createArchiveZipReader(file);

      const effectiveSpaceId = targetMode === 'new'
        ? `space-${Date.now()}`
        : targetSpaceId;

      const importResult = await importSpace(backend, zipReader, {
        targetSpaceId: effectiveSpaceId,
        conflictStrategy,
        importWorkspaceState,
        onProgress: (p) => setProgress(p),
      });

      setResult(importResult);
      setState('done');

      const name = targetMode === 'new'
        ? (newSpaceName || manifest?.space.name || 'Imported Space')
        : (spaces.find((s) => s.id === targetSpaceId)?.name ?? 'Space');

      onImportComplete(importResult.spaceId, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }, [file, backend, targetMode, targetSpaceId, conflictStrategy, importWorkspaceState, newSpaceName, manifest, spaces, onImportComplete]);

  const handleClose = useCallback(() => {
    setState('idle');
    setFile(null);
    setManifest(null);
    setConflicts([]);
    setConflictStrategy('skip');
    setTargetMode('new');
    setProgress(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="cept-modal-overlay" data-testid="space-import-dialog">
      <div className="cept-modal-content" style={{ maxWidth: 520 }}>
        <div className="cept-modal-header">
          <h2>Import Space</h2>
          <button className="cept-modal-close" onClick={handleClose} data-testid="space-import-close">
            &times;
          </button>
        </div>

        <div className="cept-modal-body">
          {/* Step 1: File Selection */}
          {state === 'idle' && (
            <div data-testid="space-import-idle">
              <p>
                Select a <code>.cept.zip</code> archive to import.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                data-testid="space-import-file-input"
              />
            </div>
          )}

          {state === 'previewing' && (
            <div data-testid="space-import-previewing">
              <p>Reading archive...</p>
            </div>
          )}

          {/* Step 2: Preview & Options */}
          {state === 'preview' && manifest && (
            <div data-testid="space-import-preview">
              <h3>Archive: {manifest.space.name}</h3>
              <p className="cept-modal-body-meta">
                {manifest.files.length} files &middot; Exported {new Date(manifest.exportedAt).toLocaleDateString()}
              </p>

              {/* Target selection */}
              <fieldset className="cept-modal-fieldset">
                <legend>Import into</legend>

                <label className="cept-modal-label">
                  <input
                    type="radio"
                    name="target"
                    checked={targetMode === 'new'}
                    onChange={() => setTargetMode('new')}
                    data-testid="space-import-target-new"
                  />
                  {' '}New space
                </label>
                {targetMode === 'new' && (
                  <input
                    className="cept-modal-input cept-modal-label-indented"
                    type="text"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="Space name"
                    data-testid="space-import-new-name"
                  />
                )}

                <label className="cept-modal-label">
                  <input
                    type="radio"
                    name="target"
                    checked={targetMode === 'existing'}
                    onChange={() => setTargetMode('existing')}
                    data-testid="space-import-target-existing"
                  />
                  {' '}Existing space
                </label>
                {targetMode === 'existing' && spaces.length > 0 && (
                  <select
                    className="cept-modal-input cept-modal-label-indented"
                    value={targetSpaceId}
                    onChange={(e) => setTargetSpaceId(e.target.value)}
                    data-testid="space-import-target-select"
                  >
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </fieldset>

              {/* Conflict resolution */}
              {conflicts.length > 0 && (
                <fieldset className="cept-modal-fieldset cept-modal-fieldset--warning">
                  <legend>
                    {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
                  </legend>
                  {(Object.keys(CONFLICT_LABELS) as ConflictStrategy[]).map((strategy) => (
                    <label key={strategy} className="cept-modal-label">
                      <input
                        type="radio"
                        name="conflict"
                        checked={conflictStrategy === strategy}
                        onChange={() => setConflictStrategy(strategy)}
                        data-testid={`space-import-conflict-${strategy}`}
                      />
                      {' '}{CONFLICT_LABELS[strategy]}
                    </label>
                  ))}
                </fieldset>
              )}

              {/* Additional options */}
              <label className="cept-modal-label">
                <input
                  type="checkbox"
                  checked={importWorkspaceState}
                  onChange={(e) => setImportWorkspaceState(e.target.checked)}
                  data-testid="space-import-workspace-state"
                />
                {' '}Import page tree (workspace state)
              </label>

              <button
                className="cept-modal-btn"
                onClick={handleImport}
                data-testid="space-import-button"
              >
                Import
              </button>
            </div>
          )}

          {/* Step 3: Progress */}
          {state === 'importing' && (
            <div data-testid="space-import-progress">
              <p>
                {progress?.phase === 'validating' && 'Validating archive...'}
                {progress?.phase === 'scanning-conflicts' && 'Checking for conflicts...'}
                {progress?.phase === 'importing' && `Importing: ${progress.currentFile}`}
                {!progress && 'Starting import...'}
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

          {/* Step 4: Results */}
          {state === 'done' && result && (
            <div data-testid="space-import-done">
              <p className="cept-modal-success">
                Import complete!
              </p>
              <ul>
                <li>{result.imported.length} files imported</li>
                {result.replaced.length > 0 && <li>{result.replaced.length} files replaced</li>}
                {result.renamed.length > 0 && <li>{result.renamed.length} files renamed</li>}
                {result.skipped.length > 0 && <li>{result.skipped.length} files skipped</li>}
                {result.errors.length > 0 && (
                  <li className="cept-modal-warning">{result.errors.length} errors</li>
                )}
              </ul>
              <button className="cept-modal-btn cept-modal-btn--secondary" onClick={handleClose} data-testid="space-import-done-close">
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div data-testid="space-import-error">
              <p className="cept-modal-error">Error: {error}</p>
              <button
                className="cept-modal-btn cept-modal-btn--secondary"
                onClick={() => { setState('idle'); setError(null); }}
                data-testid="space-import-retry"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
