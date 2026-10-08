import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatAuthProvider, PAT_STORE_KEY } from '@cept/core';
import type { AuthToken, TokenStore } from '@cept/core';
import { GitHubAccountProvider } from './github-account.js';
import type { PatAuth } from './github-account.js';
import { GitHubAccountSection, describeGrants } from './GitHubAccountSection.js';

const GOOD = 'ghp_goodtoken123';

class MemoryStore implements TokenStore {
  readonly tokens = new Map<string, AuthToken>();
  async get(key: string) {
    return this.tokens.get(key) ?? null;
  }
  async set(key: string, token: AuthToken) {
    this.tokens.set(key, token);
  }
  async delete(key: string) {
    this.tokens.delete(key);
  }
}

/** A GitHub that accepts only {@link GOOD}. */
function fakeGitHub(): typeof fetch {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('Authorization');
    if (auth !== `Bearer ${GOOD}`)
      return new Response('{"message":"Bad credentials"}', { status: 401 });
    return new Response(
      JSON.stringify({ login: 'octocat', name: 'The Octocat', avatar_url: 'https://a/octo.png' }),
      { status: 200, headers: { 'X-OAuth-Scopes': 'repo, read:org' } },
    );
  }) as unknown as typeof fetch;
}

function renderSection(auth: PatAuth | null) {
  return render(
    <GitHubAccountProvider auth={auth}>
      <GitHubAccountSection />
    </GitHubAccountProvider>,
  );
}

function setup(store = new MemoryStore()) {
  const auth = new PatAuthProvider({ tokenStore: store, fetch: fakeGitHub() });
  renderSection(auth);
  return store;
}

async function signIn(token: string) {
  fireEvent.change(await screen.findByTestId('github-token-input'), {
    target: { value: token },
  });
  fireEvent.click(screen.getByTestId('github-sign-in-btn'));
}

describe('GitHubAccountSection', () => {
  it('renders nothing when the host offers no GitHub sign-in', () => {
    renderSection(null);
    expect(screen.queryByTestId('github-account')).toBeNull();
  });

  it('signs in with a valid token and shows the account', async () => {
    const store = setup();
    await signIn(`  ${GOOD} `);

    expect((await screen.findByTestId('github-login')).textContent).toContain(
      'The Octocat (@octocat)',
    );
    expect(screen.getByTestId('github-grants').textContent).toContain(
      'Classic token · repo, read:org',
    );
    expect(screen.getByTestId('github-avatar').getAttribute('src')).toBe('https://a/octo.png');
    expect(store.tokens.get(PAT_STORE_KEY)?.accessToken).toBe(GOOD);
    expect(screen.queryByTestId('github-token-input')).toBeNull();
  });

  it('shows why an invalid token was rejected and saves nothing', async () => {
    const store = setup();
    await signIn('ghp_wrongtoken999');

    const error = await screen.findByTestId('github-error');
    expect(error.textContent).toContain('GitHub rejected the token (401)');
    expect(error.textContent).not.toContain('ghp_wrongtoken999');
    expect(store.tokens.size).toBe(0);
    expect(screen.getByTestId('github-sign-in')).toBeTruthy();
  });

  it('disables sign-in until a token is typed', async () => {
    setup();
    expect(((await screen.findByTestId('github-sign-in-btn')) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('signs out and clears the saved token', async () => {
    const store = setup();
    await signIn(GOOD);
    fireEvent.click(await screen.findByTestId('github-sign-out'));

    expect(await screen.findByTestId('github-sign-in')).toBeTruthy();
    expect(store.tokens.size).toBe(0);
  });

  it('restores a saved token at startup', async () => {
    const store = new MemoryStore();
    await store.set(PAT_STORE_KEY, { accessToken: GOOD, scopes: [] });
    setup(store);

    expect(screen.getByTestId('github-checking')).toBeTruthy();
    expect((await screen.findByTestId('github-login')).textContent).toContain('@octocat');
  });

  it('drops a saved token GitHub now rejects', async () => {
    const store = new MemoryStore();
    await store.set(PAT_STORE_KEY, { accessToken: 'ghp_revoked', scopes: [] });
    setup(store);

    expect(await screen.findByTestId('github-sign-in')).toBeTruthy();
    expect(store.tokens.size).toBe(0);
  });

  it('keeps a saved token when GitHub cannot be reached', async () => {
    const logout = vi.fn(async () => undefined);
    renderSection({
      signIn: vi.fn(),
      restore: () => Promise.reject(new Error('offline')),
      logout,
    });

    expect(await screen.findByTestId('github-unverified')).toBeTruthy();
    fireEvent.click(screen.getByTestId('github-sign-out'));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(await screen.findByTestId('github-sign-in')).toBeTruthy();
  });

  it('says the git proxy can see the token', async () => {
    setup();
    expect((await screen.findByTestId('github-proxy-notice')).textContent).toContain(
      'which can see the token',
    );
  });
});

describe('describeGrants', () => {
  it('describes fine-grained, classic and expiring tokens', () => {
    expect(describeGrants({ kind: 'fine-grained', scopes: null })).toBe('Fine-grained token');
    expect(describeGrants({ kind: 'classic', scopes: [] })).toBe('Classic token · no scopes');
    const expiresAt = Date.UTC(2027, 0, 2, 12);
    expect(describeGrants({ kind: 'unknown', scopes: null, expiresAt })).toBe(
      `Token · expires ${new Date(expiresAt).toLocaleDateString()}`,
    );
  });
});
