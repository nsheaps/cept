/**
 * The Auth section of Settings: the git token auths Cept can use, one per
 * account, and a form to add another (REQ-AUTH-019, REQ-AUTH-020).
 *
 * Any git host works: GitHub tokens are checked when they are added, tokens for
 * other hosts are saved as typed. The link that creates a GitHub token opens
 * GitHub's form with what Cept needs already filled in.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { GITHUB_HOST, newTokenUrl, normalizeHost } from '@cept/core';
import type { GitAuthRecord, PatGrants } from '@cept/core';
import { gitCorsProxy } from '../../config/git-proxy.js';
import { useGitAuths } from './git-auths.js';
import type { GitAuthsState } from './git-auths.js';

/** "Fine-grained token", or "Classic token · repo, read:org". */
export function describeGrants(grants: PatGrants): string {
  const kind =
    grants.kind === 'fine-grained'
      ? 'Fine-grained token'
      : grants.kind === 'classic'
        ? 'Classic token'
        : 'Token';
  const scopes = grants.scopes === null ? '' : ` · ${grants.scopes.join(', ') || 'no scopes'}`;
  const expiry =
    grants.expiresAt === undefined
      ? ''
      : ` · expires ${new Date(grants.expiresAt).toLocaleDateString()}`;
  return `${kind}${scopes}${expiry}`;
}

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/** What an auth line says about the account behind it. */
function describeAccount(auth: GitAuthRecord): string {
  if (auth.account)
    return auth.account.name
      ? `${auth.account.name} (@${auth.account.login})`
      : `@${auth.account.login}`;
  return auth.username;
}

function AuthItem({
  auth,
  state,
  unreachable,
}: {
  auth: GitAuthRecord;
  state: GitAuthsState;
  unreachable: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [replacement, setReplacement] = useState('');

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const submitReplace = (e: FormEvent) => {
    e.preventDefault();
    if (busy || !replacement.trim()) return;
    void run(async () => {
      await state.replaceToken(auth.id, replacement);
      setReplacement('');
    }, 'Could not use that token.');
  };

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    if (busy || renaming === null || !renaming.trim()) return;
    const label = renaming;
    void run(async () => {
      await state.rename(auth.id, label);
      setRenaming(null);
    }, 'Could not rename.');
  };

  return (
    <li className="cept-settings-auth-item" data-testid={`auth-item-${auth.id}`}>
      <div className="cept-settings-github-account">
        {auth.account?.avatarUrl && (
          <img
            className="cept-settings-github-avatar"
            src={auth.account.avatarUrl}
            alt=""
            width={32}
            height={32}
            data-testid="auth-avatar"
          />
        )}
        <div className="cept-settings-toggle-label">
          {renaming === null ? (
            <span className="cept-settings-toggle-name" data-testid="auth-label">
              {auth.label}
            </span>
          ) : (
            <form className="cept-settings-rename-row" onSubmit={submitRename}>
              <input
                className="cept-settings-rename-input"
                aria-label="Name for this auth"
                value={renaming}
                onChange={(e) => setRenaming(e.target.value)}
                autoFocus
                data-testid="auth-rename-input"
              />
              <button
                type="submit"
                className="cept-settings-action-btn"
                disabled={busy || !renaming.trim()}
                data-testid="auth-rename-save"
              >
                Save
              </button>
            </form>
          )}
          <span className="cept-settings-toggle-desc" data-testid="auth-detail">
            {auth.host} · {describeAccount(auth)}
            {auth.grants ? ` · ${describeGrants(auth.grants)}` : ''}
          </span>
          {auth.status === 'unchecked' && (
            <span className="cept-settings-toggle-desc">
              Cept cannot check tokens for this host; it is used as saved.
            </span>
          )}
          {unreachable && auth.status !== 'rejected' && (
            <span className="cept-settings-toggle-desc" data-testid="auth-unverified">
              {auth.host} could not be reached to check this token. It is checked again next time
              Cept starts.
            </span>
          )}
        </div>
        {renaming === null && (
          <button
            className="cept-settings-action-btn"
            onClick={() => setRenaming(auth.label)}
            disabled={busy}
            data-testid="auth-rename"
          >
            Rename
          </button>
        )}
        <button
          className="cept-settings-action-btn"
          onClick={() => void run(() => state.remove(auth.id), 'Could not remove.')}
          disabled={busy}
          data-testid="auth-remove"
        >
          Remove
        </button>
      </div>

      {auth.status === 'rejected' && (
        <form onSubmit={submitReplace} data-testid="auth-rejected">
          <p className="cept-settings-github-error" role="alert">
            {auth.host} no longer accepts this token. Paste a new one to keep using it, or remove
            this auth.
          </p>
          <div className="cept-settings-rename-row">
            <input
              className="cept-settings-rename-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="New token"
              aria-label={`New token for ${auth.label}`}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              data-testid="auth-replace-input"
            />
            <button
              type="submit"
              className="cept-settings-action-btn"
              disabled={busy || !replacement.trim()}
              data-testid="auth-replace-btn"
            >
              {busy ? 'Checking…' : 'Replace token'}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="cept-settings-github-error" role="alert" data-testid="auth-item-error">
          {error}
        </p>
      )}
    </li>
  );
}

function AddAuthForm({ state }: { state: GitAuthsState }) {
  const [host, setHost] = useState(GITHUB_HOST);
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const [createRepos, setCreateRepos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeHost(host);
  const isGitHub = normalized === GITHUB_HOST;
  const needsUsername = normalized !== null && !isGitHub;
  const ready =
    token.trim() !== '' && normalized !== null && (!needsUsername || username.trim() !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await state.add({
        token,
        host: normalized ?? undefined,
        ...(needsUsername ? { username: username.trim() } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
      });
      setToken('');
      setLabel('');
      setUsername('');
    } catch (err) {
      setError(messageOf(err, 'Could not add this token.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} data-testid="auth-add">
      <h4 className="cept-settings-subtitle">Add a token</h4>
      <div className="cept-settings-auth-fields">
        <label className="cept-settings-auth-field">
          <span className="cept-settings-toggle-desc">Git host</span>
          <input
            className="cept-settings-rename-input"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={normalized === null}
            data-testid="auth-host-input"
          />
        </label>
        {needsUsername && (
          <label className="cept-settings-auth-field">
            <span className="cept-settings-toggle-desc">Username</span>
            <input
              className="cept-settings-rename-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              data-testid="auth-username-input"
            />
          </label>
        )}
        <label className="cept-settings-auth-field">
          <span className="cept-settings-toggle-desc">Token</span>
          <input
            className="cept-settings-rename-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={isGitHub ? 'github_pat_… or ghp_…' : 'Access token'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            data-testid="auth-token-input"
          />
        </label>
        <label className="cept-settings-auth-field">
          <span className="cept-settings-toggle-desc">Name (optional)</span>
          <input
            className="cept-settings-rename-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            data-testid="auth-label-input"
          />
        </label>
      </div>

      {isGitHub && (
        <>
          <label className="cept-settings-toggle-row">
            <span className="cept-settings-toggle-desc">
              Also let Cept create repositories (asks the new token for repository administration)
            </span>
            <input
              type="checkbox"
              checked={createRepos}
              onChange={(e) => setCreateRepos(e.target.checked)}
              data-testid="auth-create-repos"
            />
          </label>
          <p className="cept-settings-toggle-desc">
            <a
              className="cept-settings-link"
              href={newTokenUrl({ createRepos })}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="auth-new-token-link"
            >
              Create a fine-grained token on GitHub
            </a>{' '}
            — the form opens with Cept&apos;s permissions filled in. Pick the repositories it may
            reach, then paste the token here. Tokens are stored encrypted on this device.
          </p>
        </>
      )}

      <button
        type="submit"
        className="cept-settings-action-btn"
        disabled={busy || !ready}
        data-testid="auth-add-btn"
      >
        {busy ? 'Checking…' : 'Add token'}
      </button>
      {error && (
        <p className="cept-settings-github-error" role="alert" data-testid="auth-error">
          {error}
        </p>
      )}
    </form>
  );
}

export function AuthSection() {
  const state = useGitAuths();
  if (!state) return null;

  return (
    <div data-testid="auth-section">
      <div className="cept-settings-section-divider" />
      <h3 className="cept-settings-section-title">Auth</h3>
      {state.status === 'checking' ? (
        <p className="cept-settings-toggle-desc" data-testid="auth-checking">
          Checking your saved tokens…
        </p>
      ) : state.auths.length === 0 ? (
        <p className="cept-settings-toggle-desc" data-testid="auth-empty">
          No tokens yet. Add one to open private repositories and sync spaces. You can add as many
          as you need, for example one per account.
        </p>
      ) : (
        <ul className="cept-settings-auth-list" data-testid="auth-list">
          {state.auths.map((auth) => (
            <AuthItem
              key={auth.id}
              auth={auth}
              state={state}
              unreachable={state.unreachable.includes(auth.id)}
            />
          ))}
        </ul>
      )}
      <AddAuthForm state={state} />
      {state.status === 'ready' && (
        <p className="cept-settings-toggle-desc" data-testid="auth-proxy-notice">
          In the browser, git traffic goes through the proxy at {gitCorsProxy()}, which can see a
          token when Cept clones or syncs a repository.
        </p>
      )}
    </div>
  );
}
