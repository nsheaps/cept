import { useState, useEffect, useCallback } from 'react';
import type { StorageBackend, DirEntry, FileStat } from '@cept/core';

export interface FileBrowserProps {
  backend: StorageBackend;
  rootPath?: string;
  onNavigateToPage?: (pageId: string) => void;
  onClose: () => void;
}

interface FileEntry extends DirEntry {
  path: string;
  stat?: FileStat | null;
}

export function FileBrowser({ backend, rootPath = '/', onNavigateToPage, onClose }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileContent(null);
    setConfirmDelete(null);
    try {
      const dirEntries = await backend.listDirectory(path);
      const enriched: FileEntry[] = [];
      for (const entry of dirEntries) {
        const entryPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
        let stat: FileStat | null = null;
        try {
          stat = await backend.stat(entryPath);
        } catch {
          // stat may fail for some entries
        }
        enriched.push({ ...entry, path: entryPath, stat });
      }
      // Sort: directories first, then alphabetically
      enriched.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to list directory');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const handleNavigate = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
    } else {
      setSelectedFile(entry);
      void backend.readFile(entry.path).then((data) => {
        if (data) {
          try {
            setFileContent(new TextDecoder().decode(data));
          } catch {
            setFileContent('[Binary content]');
          }
        } else {
          setFileContent(null);
        }
      });
    }
  }, [backend]);

  const handleGoUp = useCallback(() => {
    if (currentPath === '/' || currentPath === '') return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    setCurrentPath(parent);
  }, [currentPath]);

  const handleDelete = useCallback(async (entry: FileEntry) => {
    try {
      await backend.deleteFile(entry.path);
      void loadDirectory(currentPath);
      if (selectedFile?.path === entry.path) {
        setSelectedFile(null);
        setFileContent(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
    setConfirmDelete(null);
  }, [backend, currentPath, loadDirectory, selectedFile]);

  const handleJumpToPage = useCallback((entry: FileEntry) => {
    // Extract page ID from path like "pages/my-page.html"
    const match = entry.path.match(/\/pages\/(.+)\.html$/);
    if (match && onNavigateToPage) {
      onNavigateToPage(match[1]);
      onClose();
    }
  }, [onNavigateToPage, onClose]);

  const visibleEntries = showHidden
    ? entries
    : entries.filter((e) => !e.name.startsWith('.'));

  const pathSegments = currentPath === '/' ? [''] : currentPath.split('/');

  return (
    <div className="cept-fb" data-testid="file-browser">
      <div className="cept-fb-header">
        <button className="cept-settings-back-btn" onClick={onClose} data-testid="file-browser-close">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 4l-4 4 4 4" />
          </svg>
          Back
        </button>
        <label className="cept-fb-toggle">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            data-testid="file-browser-show-hidden"
          />
          <span>Show hidden files</span>
        </label>
      </div>

      <div className="cept-fb-breadcrumb" data-testid="file-browser-path">
        {pathSegments.map((seg, i) => {
          const path = i === 0 ? '/' : pathSegments.slice(0, i + 1).join('/');
          const isLast = i === pathSegments.length - 1;
          return (
            <span key={i}>
              {i > 0 && <span className="cept-fb-breadcrumb-sep">/</span>}
              {isLast ? (
                <span className="cept-fb-breadcrumb-current">{seg || 'root'}</span>
              ) : (
                <button
                  className="cept-fb-breadcrumb-link"
                  onClick={() => setCurrentPath(path)}
                >
                  {seg || 'root'}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {error && (
        <div className="cept-fb-error" data-testid="file-browser-error">{error}</div>
      )}

      {loading ? (
        <div className="cept-fb-loading">Loading...</div>
      ) : (
        <div className="cept-fb-list" data-testid="file-browser-list">
          {currentPath !== '/' && (
            <button className="cept-fb-entry" onClick={handleGoUp} data-testid="file-browser-go-up">
              <span className="cept-fb-entry-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 4l-4 4 4 4" />
                </svg>
              </span>
              <span className="cept-fb-entry-name">..</span>
            </button>
          )}
          {visibleEntries.length === 0 && !loading && (
            <div className="cept-fb-empty">Empty directory</div>
          )}
          {visibleEntries.map((entry) => (
            <div key={entry.path} className="cept-fb-entry-row" data-testid={`fb-entry-${entry.name}`}>
              <button
                className={`cept-fb-entry ${selectedFile?.path === entry.path ? 'is-selected' : ''}`}
                onClick={() => handleNavigate(entry)}
              >
                <span className="cept-fb-entry-icon">
                  {entry.isDirectory ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 3h4l2 2h6v8H2z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="1" width="10" height="14" rx="1" />
                      <path d="M6 5h4M6 8h4M6 11h2" />
                    </svg>
                  )}
                </span>
                <span className="cept-fb-entry-name">{entry.name}</span>
                {entry.stat && !entry.isDirectory && (
                  <span className="cept-fb-entry-size">{formatSize(entry.stat.size)}</span>
                )}
              </button>
              <div className="cept-fb-entry-actions">
                {!entry.isDirectory && entry.path.match(/\/pages\/.+\.html$/) && onNavigateToPage && (
                  <button
                    className="cept-fb-action-btn"
                    onClick={() => handleJumpToPage(entry)}
                    title="Open as page"
                    data-testid={`fb-jump-${entry.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 3l6 5-6 5" />
                    </svg>
                  </button>
                )}
                {!entry.isDirectory && (
                  confirmDelete === entry.path ? (
                    <button
                      className="cept-fb-action-btn cept-fb-action-btn--danger"
                      onClick={() => void handleDelete(entry)}
                      title="Confirm delete"
                      data-testid={`fb-confirm-delete-${entry.name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,8 7,12 13,4" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="cept-fb-action-btn"
                      onClick={() => setConfirmDelete(entry.path)}
                      title="Delete file"
                      data-testid={`fb-delete-${entry.name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFile && fileContent !== null && (
        <div className="cept-fb-preview" data-testid="file-browser-preview">
          <div className="cept-fb-preview-header">
            <span className="cept-fb-preview-name">{selectedFile.name}</span>
            {selectedFile.stat && (
              <span className="cept-fb-preview-meta">
                {formatSize(selectedFile.stat.size)}
                {selectedFile.stat.modifiedAt && ` · ${formatDate(selectedFile.stat.modifiedAt)}`}
              </span>
            )}
          </div>
          <pre className="cept-fb-preview-content" data-testid="file-browser-preview-content">
            {fileContent}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}
