/**
 * The GitHub section of Settings: paste a personal access token, see the
 * account it signs in as, and sign out (REQ-AUTH-005).
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { PatGrants } from '@cept/core';
import { gitCorsProxy } from '../../config/git-proxy.js';
import { useGitHubAccount } from './github-account.js';

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

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

export function GitHubAccountSection() {
  const github = useGitHubAccount();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!github) return null;
  const { status, account } = github;

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await github.signIn(token);
      setToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await github.signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="github-account">
      <div className="cept-settings-section-divider" />
      <h3 className="cept-settings-section-title">GitHub</h3>
      {status === 'checking' && (
        <p className="cept-settings-toggle-desc" data-testid="github-checking">
          Checking your saved token…
        </p>
      )}

      {status === 'signed-in' && account && (
        <div className="cept-settings-github-account" data-testid="github-signed-in">
          {account.avatarUrl && (
            <img
              className="cept-settings-github-avatar"
              src={account.avatarUrl}
              alt=""
              width={32}
              height={32}
              data-testid="github-avatar"
            />
          )}
          <div className="cept-settings-toggle-label">
            <span className="cept-settings-toggle-name" data-testid="github-login">
              {account.name ? `${account.name} (@${account.login})` : `@${account.login}`}
            </span>
            <span className="cept-settings-toggle-desc" data-testid="github-grants">
              {describeGrants(account.grants)}
            </span>
          </div>
          <button
            className="cept-settings-action-btn"
            onClick={() => void handleSignOut()}
            disabled={busy}
            data-testid="github-sign-out"
          >
            Sign out
          </button>
        </div>
      )}

      {status === 'unverified' && (
        <div className="cept-settings-github-account" data-testid="github-unverified">
          <div className="cept-settings-toggle-label">
            <span className="cept-settings-toggle-name">Token saved</span>
            <span className="cept-settings-toggle-desc">
              GitHub could not be reached to check it. It is checked again next time Cept starts.
            </span>
          </div>
          <button
            className="cept-settings-action-btn"
            onClick={() => void handleSignOut()}
            disabled={busy}
            data-testid="github-sign-out"
          >
            Sign out
          </button>
        </div>
      )}

      {status === 'signed-out' && (
        <form onSubmit={(e) => void handleSignIn(e)} data-testid="github-sign-in">
          <p className="cept-settings-toggle-desc">
            Sign in with a{' '}
            <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">
              personal access token
            </a>{' '}
            to open private repositories. The token is stored encrypted on this device.
          </p>
          <div className="cept-settings-rename-row">
            <input
              className="cept-settings-rename-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_… or ghp_…"
              aria-label="GitHub personal access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              data-testid="github-token-input"
            />
            <button
              type="submit"
              className="cept-settings-action-btn"
              disabled={busy || !token.trim()}
              data-testid="github-sign-in-btn"
            >
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </div>
          {error && (
            <p className="cept-settings-github-error" role="alert" data-testid="github-error">
              {error}
            </p>
          )}
          <p className="cept-settings-toggle-desc" data-testid="github-proxy-notice">
            In the browser, git traffic goes through the proxy at {gitCorsProxy()}, which can see
            the token when Cept clones or syncs a repository.
          </p>
        </form>
      )}
    </div>
  );
}
