import { useState, useMemo, useCallback } from 'react';
import type { RepoInfo } from '@cept/core';

export interface RepoPickerProps {
  /** Currently authenticated user info (null if not signed in) */
  user: { login: string; name: string | null; avatarUrl: string } | null;
  /** List of available repositories */
  repos: RepoInfo[];
  /** Whether repos are currently loading */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Called when user wants to sign in */
  onSignIn?: () => void;
  /** Called when user wants to sign out */
  onSignOut?: () => void;
  /** Called when a repository is selected */
  onSelectRepo?: (repo: RepoInfo) => void;
  /** Called to create a new repository */
  onCreateRepo?: (options: { name: string; description: string; private: boolean }) => void;
  /** Called when user wants to refresh repos list */
  onRefresh?: () => void;
}

type ViewMode = 'list' | 'create';

export function RepoPicker({
  user,
  repos,
  loading = false,
  error = null,
  onSignIn,
  onSignOut,
  onSelectRepo,
  onCreateRepo,
  onRefresh,
}: RepoPickerProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');

  const filteredRepos = useMemo(() => {
    let result = repos;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q),
      );
    }
    if (filter === 'public') {
      result = result.filter((r) => !r.private);
    } else if (filter === 'private') {
      result = result.filter((r) => r.private);
    }
    return result;
  }, [repos, search, filter]);

  const handleCreate = useCallback(() => {
    if (newRepoName.trim() && onCreateRepo) {
      onCreateRepo({
        name: newRepoName.trim(),
        description: newRepoDesc.trim(),
        private: newRepoPrivate,
      });
      setNewRepoName('');
      setNewRepoDesc('');
      setNewRepoPrivate(true);
      setViewMode('list');
    }
  }, [newRepoName, newRepoDesc, newRepoPrivate, onCreateRepo]);

  if (!user) {
    return (
      <div className="cept-repo-picker" data-testid="repo-picker">
        <div className="cept-repo-picker-auth" data-testid="repo-picker-auth">
          <p className="cept-repo-picker-message" data-testid="repo-picker-message">
            Sign in to GitHub to access your repositories.
          </p>
          {onSignIn && (
            <button
              className="cept-repo-picker-signin"
              onClick={onSignIn}
              data-testid="repo-picker-signin"
            >
              Sign in with GitHub
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cept-repo-picker" data-testid="repo-picker">
      <div className="cept-repo-picker-header" data-testid="repo-picker-header">
        <div className="cept-repo-picker-user" data-testid="repo-picker-user">
          <img
            className="cept-repo-picker-avatar"
            src={user.avatarUrl}
            alt={user.login}
            data-testid="repo-picker-avatar"
          />
          <span className="cept-repo-picker-username" data-testid="repo-picker-username">
            {user.name ?? user.login}
          </span>
          {onSignOut && (
            <button
              className="cept-repo-picker-signout"
              onClick={onSignOut}
              data-testid="repo-picker-signout"
            >
              Sign out
            </button>
          )}
        </div>

        <div className="cept-repo-picker-actions">
          {viewMode === 'list' ? (
            <>
              <input
                className="cept-repo-picker-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repositories..."
                data-testid="repo-picker-search"
              />
              <div className="cept-repo-picker-filters" data-testid="repo-picker-filters">
                {(['all', 'public', 'private'] as const).map((f) => (
                  <button
                    key={f}
                    className={`cept-repo-picker-filter${filter === f ? ' is-active' : ''}`}
                    onClick={() => setFilter(f)}
                    data-testid={`repo-picker-filter-${f}`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="cept-repo-picker-toolbar">
                {onRefresh && (
                  <button
                    className="cept-repo-picker-refresh"
                    onClick={onRefresh}
                    disabled={loading}
                    data-testid="repo-picker-refresh"
                  >
                    Refresh
                  </button>
                )}
                {onCreateRepo && (
                  <button
                    className="cept-repo-picker-new"
                    onClick={() => setViewMode('create')}
                    data-testid="repo-picker-new"
                  >
                    New repository
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              className="cept-repo-picker-back"
              onClick={() => setViewMode('list')}
              data-testid="repo-picker-back"
            >
              Back to list
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="cept-repo-picker-error" data-testid="repo-picker-error">
          {error}
        </div>
      )}

      {viewMode === 'create' ? (
        <div className="cept-repo-picker-create" data-testid="repo-picker-create">
          <label className="cept-repo-picker-label">
            Repository name
            <input
              className="cept-repo-picker-input"
              type="text"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              placeholder="my-workspace"
              data-testid="repo-picker-create-name"
            />
          </label>
          <label className="cept-repo-picker-label">
            Description (optional)
            <input
              className="cept-repo-picker-input"
              type="text"
              value={newRepoDesc}
              onChange={(e) => setNewRepoDesc(e.target.value)}
              placeholder="My Cept workspace"
              data-testid="repo-picker-create-desc"
            />
          </label>
          <label className="cept-repo-picker-checkbox-label" data-testid="repo-picker-create-private-label">
            <input
              type="checkbox"
              checked={newRepoPrivate}
              onChange={(e) => setNewRepoPrivate(e.target.checked)}
              data-testid="repo-picker-create-private"
            />
            Private repository
          </label>
          <button
            className="cept-repo-picker-create-btn"
            onClick={handleCreate}
            disabled={!newRepoName.trim()}
            data-testid="repo-picker-create-submit"
          >
            Create repository
          </button>
        </div>
      ) : (
        <div className="cept-repo-picker-list" data-testid="repo-picker-list">
          {loading && (
            <div className="cept-repo-picker-loading" data-testid="repo-picker-loading">
              Loading repositories...
            </div>
          )}
          {!loading && filteredRepos.length === 0 && (
            <div className="cept-repo-picker-empty" data-testid="repo-picker-empty">
              {search ? 'No repositories match your search.' : 'No repositories found.'}
            </div>
          )}
          {filteredRepos.map((repo) => (
            <div
              key={repo.fullName}
              className="cept-repo-picker-item"
              onClick={() => onSelectRepo?.(repo)}
              data-testid={`repo-picker-item-${repo.fullName}`}
            >
              <div className="cept-repo-picker-item-name" data-testid="repo-picker-item-name">
                {repo.fullName}
                {repo.private && (
                  <span className="cept-repo-picker-badge" data-testid="repo-picker-badge-private">
                    Private
                  </span>
                )}
              </div>
              {repo.description && (
                <div className="cept-repo-picker-item-desc" data-testid="repo-picker-item-desc">
                  {repo.description}
                </div>
              )}
              <div className="cept-repo-picker-item-meta" data-testid="repo-picker-item-meta">
                {repo.defaultBranch}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
