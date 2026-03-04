import { useState, useMemo, useCallback } from 'react';
import type { CommitInfo, DiffResult } from '@cept/core';

export interface HistoryViewerProps {
  /** Commit history entries */
  commits: CommitInfo[];
  /** Whether commits are loading */
  loading?: boolean;
  /** Currently selected commit's diff (null if none selected) */
  diff: DiffResult | null;
  /** Whether diff is loading */
  diffLoading?: boolean;
  /** Called when a commit is selected to view its diff */
  onSelectCommit?: (hash: string) => void;
  /** Called to restore a file to a specific commit */
  onRestore?: (hash: string, path: string) => void;
  /** Path filter — showing history for a specific file */
  filePath?: string;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp * 1000;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return formatTimestamp(timestamp);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

export function HistoryViewer({
  commits,
  loading = false,
  diff,
  diffLoading = false,
  onSelectCommit,
  onRestore,
  filePath,
}: HistoryViewerProps) {
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredCommits = useMemo(() => {
    if (!search.trim()) return commits;
    const q = search.toLowerCase();
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.hash.startsWith(q),
    );
  }, [commits, search]);

  const handleSelectCommit = useCallback(
    (hash: string) => {
      setSelectedHash(hash);
      onSelectCommit?.(hash);
    },
    [onSelectCommit],
  );

  return (
    <div className="cept-history-viewer" data-testid="history-viewer">
      <div className="cept-history-header" data-testid="history-header">
        <h3 className="cept-history-title">
          {filePath ? `History: ${filePath}` : 'Page History'}
        </h3>
        <input
          className="cept-history-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commits..."
          data-testid="history-search"
        />
      </div>

      <div className="cept-history-content">
        <div className="cept-history-commits" data-testid="history-commits">
          {loading && (
            <div className="cept-history-loading" data-testid="history-loading">
              Loading history...
            </div>
          )}
          {!loading && filteredCommits.length === 0 && (
            <div className="cept-history-empty" data-testid="history-empty">
              {search ? 'No commits match your search.' : 'No history available.'}
            </div>
          )}
          {filteredCommits.map((commit) => (
            <div
              key={commit.hash}
              className={`cept-history-commit${selectedHash === commit.hash ? ' is-selected' : ''}`}
              onClick={() => handleSelectCommit(commit.hash)}
              data-testid={`history-commit-${shortHash(commit.hash)}`}
            >
              <div className="cept-history-commit-message" data-testid="history-commit-message">
                {commit.message}
              </div>
              <div className="cept-history-commit-meta">
                <span className="cept-history-commit-author" data-testid="history-commit-author">
                  {commit.author.name}
                </span>
                <span className="cept-history-commit-hash" data-testid="history-commit-hash">
                  {shortHash(commit.hash)}
                </span>
                <span className="cept-history-commit-time" data-testid="history-commit-time">
                  {formatRelativeTime(commit.author.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {selectedHash && (
          <div className="cept-history-diff" data-testid="history-diff">
            {diffLoading && (
              <div className="cept-history-diff-loading" data-testid="history-diff-loading">
                Loading changes...
              </div>
            )}
            {!diffLoading && diff && (
              <div className="cept-history-diff-files" data-testid="history-diff-files">
                {diff.files.length === 0 && (
                  <div className="cept-history-diff-empty" data-testid="history-diff-empty">
                    No changes in this commit.
                  </div>
                )}
                {diff.files.map((file) => (
                  <div
                    key={file.path}
                    className="cept-history-diff-file"
                    data-testid={`history-diff-file-${file.path}`}
                  >
                    <div className="cept-history-diff-file-header">
                      <span
                        className={`cept-history-diff-type cept-history-diff-type--${file.type}`}
                        data-testid="history-diff-type"
                      >
                        {file.type === 'add' ? '+' : file.type === 'delete' ? '-' : '~'}
                      </span>
                      <span className="cept-history-diff-path" data-testid="history-diff-path">
                        {file.path}
                      </span>
                      {onRestore && file.type !== 'delete' && (
                        <button
                          className="cept-history-restore"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestore(selectedHash, file.path);
                          }}
                          data-testid={`history-restore-${file.path}`}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                    {file.hunks.length > 0 && (
                      <div className="cept-history-diff-hunks">
                        {file.hunks.map((hunk, idx) => (
                          <pre
                            key={idx}
                            className="cept-history-diff-hunk"
                            data-testid="history-diff-hunk"
                          >
                            {hunk}
                          </pre>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
