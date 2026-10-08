import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listPageHistory,
  PAGE_HISTORY_PAGE_SIZE,
  pageVersionContent,
  pageVersionDiff,
} from '@cept/core';
import type { CommitInfo, DiffResult, PageHistory } from '@cept/core';
import { HistoryViewer } from './HistoryViewer.js';
import type { PageHistorySource } from '../storage/git-space.js';

export interface PageHistoryDialogProps {
  /** The page's title, for the heading. */
  title: string;
  /** Where the history is read; null while it is being found. */
  source: PageHistorySource | null;
  /** Offer "Restore" (only for spaces open for editing). */
  canRestore: boolean;
  /** Write the old text back as a new edit. */
  onRestore: (content: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Page history (REQ-NTN-016): the versions of one page, what each changed,
 * and (in editable spaces) restoring one, which saves its text as a new
 * version. The list grows a page at a time; a shallow clone's older versions
 * are downloaded on request (not for a folder's own repository, which Cept
 * only reads).
 */
export function PageHistoryDialog({
  title,
  source,
  canRestore,
  onRestore,
  onClose,
}: PageHistoryDialogProps) {
  const [limit, setLimit] = useState(PAGE_HISTORY_PAGE_SIZE);
  const [history, setHistory] = useState<PageHistory | null>(null);
  const [reloads, setReloads] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CommitInfo | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const selection = useRef(0);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    listPageHistory(source.git, source.path, limit).then(
      (next) => {
        if (!cancelled) setHistory(next);
      },
      (err: unknown) => {
        if (!cancelled) setError(messageOf(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, limit, reloads]);

  const handleSelect = useCallback(
    (hash: string) => {
      const commit = history?.commits.find((c) => c.hash === hash);
      if (!source || !commit) return;
      const ticket = ++selection.current;
      setSelected(commit);
      setDiff(null);
      setDiffLoading(true);
      pageVersionDiff(source.git, source.path, commit)
        .then(
          (next) => {
            if (ticket === selection.current) setDiff(next);
          },
          (err: unknown) => {
            if (ticket === selection.current) setError(messageOf(err));
          },
        )
        .finally(() => {
          if (ticket === selection.current) setDiffLoading(false);
        });
    },
    [source, history],
  );

  const handleRestore = useCallback(
    async (hash: string) => {
      if (!source) return;
      setBusy(true);
      try {
        const content = await pageVersionContent(source.git, source.path, hash);
        if (content === null) throw new Error('This version of the page has no content.');
        await onRestore(content);
        onClose();
      } catch (err) {
        setError(messageOf(err));
        setBusy(false);
      }
    },
    [source, onRestore, onClose],
  );

  const handleFetchOlder = useCallback(async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      await source.git.fetchFullHistory(source.ref);
      setReloads((n) => n + 1);
    } catch (err) {
      setError(`Older versions could not be downloaded: ${messageOf(err)}`);
    } finally {
      setBusy(false);
    }
  }, [source]);

  const footer = history && (history.more || history.truncated) && (
    <div className="cept-history-more">
      {history.more ? (
        <button
          className="cept-history-action-btn"
          onClick={() => setLimit((n) => n + PAGE_HISTORY_PAGE_SIZE)}
          disabled={busy}
          data-testid="history-show-more"
        >
          Show older versions
        </button>
      ) : source?.canFetchOlder === false ? (
        <p className="cept-history-note" data-testid="history-truncated">
          Older versions are not in this folder's repository (it is a shallow clone).
        </p>
      ) : (
        <>
          <p className="cept-history-note" data-testid="history-truncated">
            Older versions are not downloaded to this device yet.
          </p>
          <button
            className="cept-history-action-btn"
            onClick={() => void handleFetchOlder()}
            disabled={busy}
            data-testid="history-fetch-older"
          >
            Download older versions
          </button>
        </>
      )}
    </div>
  );

  return (
    <div
      className="cept-wizard-overlay"
      // Clicking outside does not close the dialog while a restore or download runs.
      onClick={busy ? undefined : onClose}
      data-testid="page-history-dialog"
    >
      <div
        className="cept-wizard-dialog cept-history-dialog"
        role="dialog"
        aria-labelledby="page-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="page-history-title">History of “{title}”</h2>
        </div>
        <div className="cept-wizard-content">
          {!canRestore && (
            <p className="cept-wizard-desc" data-testid="history-read-only">
              This space is read-only here, so versions can be viewed but not restored.
            </p>
          )}
          {error && (
            <p className="cept-wizard-desc" role="alert" data-testid="history-error">
              {error}
            </p>
          )}
          <HistoryViewer
            commits={history?.commits ?? []}
            loading={!history && !error}
            diff={diff}
            diffLoading={diffLoading}
            onSelectCommit={handleSelect}
            onRestore={
              canRestore && !busy && selected ? (hash) => void handleRestore(hash) : undefined
            }
            footer={footer}
            diffUnavailable={
              selected
                ? 'The version before this one is not downloaded, so its changes cannot be shown.'
                : undefined
            }
          />
          <div className="cept-wizard-footer">
            <button
              className="cept-wizard-cancel-btn"
              onClick={onClose}
              data-testid="history-close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
