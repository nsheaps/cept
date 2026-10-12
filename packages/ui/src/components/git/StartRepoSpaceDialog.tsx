/**
 * StartRepoSpaceDialog — start a space in a GitHub repository (REQ-WS-027):
 * pick one of the signed-in account's repositories (or create one), name the
 * space and choose the folder it lives in. The app then clones the repository
 * with the sign-in, commits a `space.cept.yaml` in that folder, pushes it and
 * opens the space, which can be edited and synced from then on.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GitAuthRecord, RepoInfo } from '@cept/core';
import { RepoPicker } from './RepoPicker.js';
import { GitAuthPicker } from '../settings/GitAuthPicker.js';

export interface StartRepoSpaceRequest {
  repo: RepoInfo;
  /** The space's name, written to its `space.cept.yaml`. */
  name: string;
  /** The folder in the repository; empty for its root. */
  folder: string;
  /** The saved auth chosen to start the space with; absent when no auths were offered. */
  authId?: string;
}

export interface StartRepoSpaceDialogProps {
  /** The signed-in GitHub account; null when signed out. */
  user: { login: string; name: string | null; avatarUrl: string } | null;
  /** The saved GitHub auths to choose from; the picker shows when there are two or more. */
  auths?: readonly GitAuthRecord[];
  /** The auth to start with; it is suggested in the picker. */
  defaultAuthId?: string;
  /** The repositories of the chosen auth's account (the sign-in when no auth is chosen). */
  listRepos: (authId?: string) => Promise<RepoInfo[]>;
  /** Create a repository with the chosen auth; absent when the sign-in cannot. */
  createRepo?: (
    options: {
      name: string;
      description?: string;
      private: boolean;
    },
    authId?: string,
  ) => Promise<RepoInfo>;
  /** Start the space; rejects with the reason it could not be started. */
  onStart: (request: StartRepoSpaceRequest) => Promise<void>;
  /** Open the GitHub sign-in. */
  onSignIn?: () => void;
  onClose: () => void;
}

/** A folder path in a repository, without leading, trailing or doubled slashes. */
export function cleanFolder(folder: string): string {
  return folder.split('/').filter(Boolean).join('/');
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function StartRepoSpaceDialog({
  user: signedIn,
  auths = [],
  defaultAuthId,
  listRepos,
  createRepo,
  onStart,
  onSignIn,
  onClose,
}: StartRepoSpaceDialogProps) {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [starting, setStarting] = useState(false);
  const [pickedAuth, setPickedAuth] = useState<string | undefined>(defaultAuthId);
  const authId = auths.find((a) => a.id === pickedAuth)?.id ?? auths[0]?.id;
  // Who the space is started as: the chosen auth's account, else the sign-in.
  const user = auths.find((a) => a.id === authId)?.account ?? signedIn;

  // The latest lister, so a parent passing a new function each render does not reload.
  const listRef = useRef(listRepos);
  listRef.current = listRepos;
  const authIdRef = useRef(authId);
  authIdRef.current = authId;
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRepos(await listRef.current(authIdRef.current));
    } catch (err) {
      setError(`Could not list your repositories: ${message(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = user?.login;
  useEffect(() => {
    if (login) void load();
  }, [login, authId, load]);

  const changeAuth = useCallback((id: string) => {
    setPickedAuth(id);
    setRepos([]);
    setRepo(null);
  }, []);

  const choose = useCallback((picked: RepoInfo) => {
    setRepo(picked);
    setName(picked.name);
    setFolder('');
    setError(null);
  }, []);

  const handleCreate = useCallback(
    async (options: { name: string; description: string; private: boolean }) => {
      if (!createRepo) return;
      setLoading(true);
      setError(null);
      try {
        const request = {
          name: options.name,
          ...(options.description ? { description: options.description } : {}),
          private: options.private,
        };
        const created = await (authId ? createRepo(request, authId) : createRepo(request));
        setRepos((prev) => [created, ...prev]);
        choose(created);
      } catch (err) {
        setError(`Could not create the repository: ${message(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [createRepo, choose, authId],
  );

  const handleStart = useCallback(async () => {
    if (!repo || !name.trim()) return;
    setStarting(true);
    setError(null);
    try {
      await onStart({
        repo,
        name: name.trim(),
        folder: cleanFolder(folder),
        ...(authId ? { authId } : {}),
      });
    } catch (err) {
      setError(message(err));
      setStarting(false);
    }
  }, [repo, name, folder, authId, onStart]);

  return (
    <div className="cept-wizard-overlay" onClick={onClose} data-testid="start-repo-space-dialog">
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="start-repo-space-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="start-repo-space-title">Start a space in a GitHub repository</h2>
        </div>
        <div className="cept-wizard-content">
          {!repo ? (
            <>
              <p className="cept-wizard-desc">
                Pick a repository, or create one. Cept adds a <code>space.cept.yaml</code> to it,
                and your pages are committed and pushed as you edit them.
              </p>
              <GitAuthPicker
                auths={auths}
                value={authId}
                recommendedId={defaultAuthId}
                onChange={changeAuth}
                testId="start-repo-space-auth"
              />
              <RepoPicker
                user={user}
                repos={repos}
                loading={loading}
                error={error}
                onSignIn={onSignIn}
                onSelectRepo={choose}
                onCreateRepo={createRepo ? (options) => void handleCreate(options) : undefined}
                onRefresh={() => void load()}
              />
              <div className="cept-wizard-footer">
                <button
                  className="cept-wizard-cancel-btn"
                  onClick={onClose}
                  data-testid="start-repo-space-cancel"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div data-testid="start-repo-space-form">
              <p className="cept-wizard-desc">
                In <strong>{repo.fullName}</strong> ({repo.defaultBranch})
              </p>
              <div className="cept-wizard-form-row">
                <label className="cept-wizard-label" htmlFor="start-repo-space-name">
                  Space name
                </label>
                <input
                  id="start-repo-space-name"
                  className="cept-wizard-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="start-repo-space-name"
                />
              </div>
              <div className="cept-wizard-form-row">
                <label className="cept-wizard-label" htmlFor="start-repo-space-folder">
                  Folder (optional)
                </label>
                <input
                  id="start-repo-space-folder"
                  className="cept-wizard-input"
                  placeholder="the repository root"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  data-testid="start-repo-space-folder"
                />
              </div>
              {error && (
                <p className="cept-wizard-desc" role="alert" data-testid="start-repo-space-error">
                  {error}
                </p>
              )}
              <div className="cept-wizard-footer">
                <button
                  className="cept-wizard-cancel-btn"
                  onClick={() => setRepo(null)}
                  disabled={starting}
                  data-testid="start-repo-space-back"
                >
                  Back
                </button>
                <button
                  className="cept-wizard-primary-btn"
                  onClick={() => void handleStart()}
                  disabled={starting || !name.trim()}
                  data-testid="start-repo-space-confirm"
                >
                  {starting ? 'Starting…' : 'Start space'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
