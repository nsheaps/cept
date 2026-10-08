/**
 * PublishSpaceDialog — publish a space kept on this device to a new GitHub
 * repository (REQ-WS-020, as limited by D-29). The app creates the repository
 * with the sign-in, pushes the space's files to it and opens the published
 * copy, which is edited and synced from then on. The local space is kept.
 */

import { useCallback, useState } from 'react';
import { slugFor } from '../storage/folder-space.js';

export interface PublishSpaceRequest {
  /** The new repository's name. */
  repoName: string;
  description?: string;
  private: boolean;
}

export interface PublishSpaceDialogProps {
  /** The name of the space being published. */
  spaceName: string;
  /** The signed-in GitHub login. */
  login: string;
  /** Publish; rejects with the reason it could not, which the dialog shows. */
  onPublish: (request: PublishSpaceRequest) => Promise<void>;
  onClose: () => void;
}

/** What to tell the user when GitHub refused to create a repository. */
export function createRepoErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 404) {
    return 'GitHub did not accept the sign-in for creating a repository. Sign in again under Settings → GitHub; if it still fails, the token may lack the permission to create repositories.';
  }
  if (status === 403) {
    return 'Your GitHub token cannot create repositories. A classic token needs the "repo" scope (or "public_repo" for a public repository); a fine-grained token needs access to all repositories with the "Administration" permission set to read and write.';
  }
  if (status === 422) {
    return 'GitHub would not create a repository with that name; you may already have one. Pick another name.';
  }
  return err instanceof Error ? err.message : String(err);
}

/** Repository names GitHub accepts: letters, digits, `.`, `-` and `_`, not starting with `.` or `-`. */
export function isValidRepoName(name: string): boolean {
  return /^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$/.test(name);
}

export function PublishSpaceDialog({
  spaceName,
  login,
  onPublish,
  onClose,
}: PublishSpaceDialogProps) {
  const [repoName, setRepoName] = useState(() => slugFor(spaceName) || 'cept-space');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = repoName.trim();
  const valid = isValidRepoName(name);

  const handlePublish = useCallback(async () => {
    if (!valid) return;
    setPublishing(true);
    setError(null);
    try {
      await onPublish({
        repoName: name,
        ...(description.trim() ? { description: description.trim() } : {}),
        private: isPrivate,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPublishing(false);
    }
  }, [valid, name, description, isPrivate, onPublish]);

  return (
    <div
      className="cept-wizard-overlay"
      onClick={publishing ? undefined : onClose}
      data-testid="publish-space-dialog"
    >
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="publish-space-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="publish-space-title">Publish "{spaceName}" to GitHub</h2>
        </div>
        <div className="cept-wizard-content">
          <p className="cept-wizard-desc">
            Cept creates a new repository in <strong>{login}</strong>'s account and pushes this
            space's pages to it. The published space then commits and syncs your edits. The copy on
            this device is kept until you remove it.
          </p>
          <div className="cept-wizard-form-row">
            <label className="cept-wizard-label" htmlFor="publish-space-repo">
              Repository name
            </label>
            <input
              id="publish-space-repo"
              className="cept-wizard-input"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              data-testid="publish-space-repo"
            />
          </div>
          {!valid && name && (
            <p className="cept-wizard-desc" data-testid="publish-space-repo-invalid">
              Use letters, digits, ".", "-" and "_" only, not starting with "." or "-".
            </p>
          )}
          <div className="cept-wizard-form-row">
            <label className="cept-wizard-label" htmlFor="publish-space-description">
              Description (optional)
            </label>
            <input
              id="publish-space-description"
              className="cept-wizard-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="publish-space-description"
            />
          </div>
          <label className="cept-wizard-desc">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              data-testid="publish-space-private"
            />{' '}
            Private repository
          </label>
          {error && (
            <p className="cept-wizard-desc" role="alert" data-testid="publish-space-error">
              {error}
            </p>
          )}
          <div className="cept-wizard-footer">
            <button
              className="cept-wizard-cancel-btn"
              onClick={onClose}
              disabled={publishing}
              data-testid="publish-space-cancel"
            >
              Cancel
            </button>
            <button
              className="cept-wizard-primary-btn"
              onClick={() => void handlePublish()}
              disabled={publishing || !valid}
              data-testid="publish-space-confirm"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
