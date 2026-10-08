/**
 * PatAuthProvider — GitHub sign-in with a personal access token (REQ-AUTH-005).
 *
 * The token is checked with `GET /user` before it is saved, and the provider
 * reports what GitHub says the token grants: classic tokens list their OAuth
 * scopes, fine-grained tokens do not (their access is per repository).
 *
 * The provider knows nothing about where it runs: storage is a `TokenStore`
 * the host supplies (encrypted IndexedDB on web, the keychain on desktop) and
 * HTTP is an injectable `fetch` (AUTH-001). No error or log line it produces
 * contains the token.
 */

import type { FetchFn, TokenStore } from './github.js';
import type { AuthProvider, AuthToken, HttpAuth, RepoInfo } from './provider.js';

/** The `TokenStore` key the PAT is saved under. */
export const PAT_STORE_KEY = 'cept:github:pat';

const GITHUB_API_BASE = 'https://api.github.com';

/** What GitHub reports a token can do. */
export interface PatGrants {
  /** `classic` (`ghp_…`), `fine-grained` (`github_pat_…`) or `unknown` (any other prefix). */
  kind: 'classic' | 'fine-grained' | 'unknown';
  /** OAuth scopes of a classic token; `null` when GitHub lists none (fine-grained tokens). */
  scopes: string[] | null;
  /** When the token expires (ms since epoch), if it has an expiry. */
  expiresAt?: number;
}

/** The GitHub account a token signs in as. */
export interface PatAccount {
  login: string;
  name: string | null;
  avatarUrl: string;
  grants: PatGrants;
}

export interface PatAuthConfig {
  tokenStore: TokenStore;
  fetch?: FetchFn;
  /** REST API root (default `https://api.github.com`), for a proxy or GitHub Enterprise. */
  apiBase?: string;
}

/**
 * Why a PAT operation failed: `invalid` (GitHub rejected the token, or none is
 * signed in), `http` (another HTTP failure or an unexpected reply) or `network`.
 */
export type PatAuthFailure = 'invalid' | 'http' | 'network';

/** A PAT failure. Its message never contains a token. */
export class PatAuthError extends Error {
  constructor(
    readonly reason: PatAuthFailure,
    message: string,
    readonly status?: number,
  ) {
    super(redactTokens(message));
    this.name = 'PatAuthError';
  }
}

/** GitHub token formats: `ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_` and fine-grained `github_pat_`. */
const TOKEN_PATTERN = /\b(?:gh[pousr]_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+)/g;

/** `text` with anything shaped like a GitHub token replaced by `[redacted]`. */
export function redactTokens(text: string): string {
  return text.replace(TOKEN_PATTERN, '[redacted]');
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  description: string | null;
  default_branch: string;
}

export class PatAuthProvider implements AuthProvider {
  readonly type = 'github' as const;
  /** Distinguishes this provider from the OAuth one, which shares the `github` type. */
  readonly mode = 'pat' as const;

  private readonly store: TokenStore;
  private readonly fetchFn: FetchFn;
  private readonly apiBase: string;

  constructor(config: PatAuthConfig) {
    this.store = config.tokenStore;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.apiBase = (config.apiBase ?? GITHUB_API_BASE).replace(/\/+$/, '');
  }

  /**
   * Check `token` with GitHub and, if it is valid, save it. Rejects with a
   * {@link PatAuthError} (and saves nothing) otherwise.
   */
  async signIn(token: string): Promise<PatAccount> {
    const accessToken = token.trim();
    if (!accessToken) throw new PatAuthError('invalid', 'Paste a GitHub personal access token.');
    const account = await this.validate(accessToken);
    await this.save(accessToken, account.grants);
    return account;
  }

  /**
   * The account of the saved token, checked again with GitHub; `null` when no
   * token is saved or GitHub now rejects it (it is then deleted). A network
   * failure rejects and keeps the token, so an offline start does not sign out.
   */
  async restore(): Promise<PatAccount | null> {
    const stored = await this.store.get(PAT_STORE_KEY);
    if (!stored) return null;
    try {
      const account = await this.validate(stored.accessToken);
      await this.save(stored.accessToken, account.grants);
      return account;
    } catch (err) {
      if (err instanceof PatAuthError && err.reason === 'invalid') {
        await this.store.delete(PAT_STORE_KEY);
        return null;
      }
      throw err;
    }
  }

  async authenticate(): Promise<AuthToken> {
    return this.requireToken();
  }

  async getRepos(): Promise<RepoInfo[]> {
    const { accessToken } = await this.requireToken();
    const repos: RepoInfo[] = [];
    let url: string | null = `${this.apiBase}/user/repos?per_page=100&sort=updated`;
    while (url) {
      const response = await this.get(url, accessToken);
      const page = (await response.json()) as GitHubRepo[];
      for (const repo of page) {
        repos.push({
          name: repo.name,
          fullName: repo.full_name,
          url: repo.html_url,
          httpsUrl: repo.clone_url,
          sshUrl: repo.ssh_url,
          private: repo.private,
          description: repo.description ?? undefined,
          defaultBranch: repo.default_branch,
        });
      }
      url = nextLink(response.headers.get('Link'));
    }
    return repos;
  }

  /** Basic auth for Git over HTTPS: GitHub takes the token as the password. */
  async getHttpAuth(): Promise<HttpAuth> {
    const { accessToken } = await this.requireToken();
    return { username: 'x-access-token', password: accessToken, token: accessToken };
  }

  /**
   * Whether a token is saved. Unlike `GitHubAuthProvider` this does not ask
   * GitHub, so it answers offline; use {@link restore} to check the token is
   * still valid (it drops a revoked one).
   */
  async isAuthenticated(): Promise<boolean> {
    return (await this.store.get(PAT_STORE_KEY)) !== null;
  }

  async logout(): Promise<void> {
    await this.store.delete(PAT_STORE_KEY);
  }

  /** Saves the token with what GitHub last said it grants. */
  private async save(accessToken: string, grants: PatGrants): Promise<void> {
    const stored: AuthToken = { accessToken, scopes: grants.scopes ?? [] };
    if (grants.expiresAt !== undefined) stored.expiresAt = grants.expiresAt;
    await this.store.set(PAT_STORE_KEY, stored);
  }

  private async requireToken(): Promise<AuthToken> {
    const token = await this.store.get(PAT_STORE_KEY);
    if (!token) throw new PatAuthError('invalid', 'Not signed in to GitHub.');
    return token;
  }

  private async validate(accessToken: string): Promise<PatAccount> {
    const response = await this.get(`${this.apiBase}/user`, accessToken);
    const user = (await response.json().catch(() => null)) as Partial<GitHubUser> | null;
    if (typeof user?.login !== 'string') {
      throw new PatAuthError('http', 'GitHub sent an unexpected reply to GET /user.');
    }
    return {
      login: user.login,
      name: user.name ?? null,
      avatarUrl: user.avatar_url ?? '',
      grants: grantsOf(accessToken, response.headers),
    };
  }

  /** A GET with the token. Failures carry only the status, never response text. */
  private async get(url: string, accessToken: string): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new PatAuthError(
        'network',
        `Could not reach GitHub: ${detail.split(accessToken).join('[redacted]')}`,
      );
    }
    if (response.status === 401) {
      throw new PatAuthError(
        'invalid',
        'GitHub rejected the token (401). It may be mistyped, expired or revoked.',
        401,
      );
    }
    if (!response.ok) {
      throw new PatAuthError('http', `GitHub API error ${response.status}.`, response.status);
    }
    return response;
  }
}

function grantsOf(token: string, headers: Headers): PatGrants {
  const kind = token.startsWith('github_pat_')
    ? 'fine-grained'
    : token.startsWith('ghp_')
      ? 'classic'
      : 'unknown';
  const scopeHeader = headers.get('X-OAuth-Scopes');
  const listed =
    scopeHeader === null
      ? null
      : scopeHeader
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  // Fine-grained tokens have no OAuth scopes; GitHub may still send an empty header.
  const scopes = kind === 'fine-grained' && listed?.length === 0 ? null : listed;
  const grants: PatGrants = { kind, scopes };
  const expiry = parseGitHubDate(headers.get('GitHub-Authentication-Token-Expiration'));
  if (expiry !== undefined) grants.expiresAt = expiry;
  return grants;
}

/** `2027-01-02 03:04:05 UTC`, as GitHub sends token expiry, or with a `T`, `Z` or `±hh[:]mm` offset. */
const GITHUB_DATE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*(UTC|Z|[+-]\d{2}:?\d{2})?$/;

/** The time in ms since epoch, or `undefined` for a missing or unrecognised value. */
function parseGitHubDate(value: string | null): number | undefined {
  const match = value ? GITHUB_DATE.exec(value.trim()) : null;
  if (!match) return undefined;
  const [, date, time, zone] = match;
  const offset =
    !zone || zone === 'UTC' || zone === 'Z' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(-2)}`;
  const ms = Date.parse(`${date}T${time}${offset}`);
  return Number.isNaN(ms) ? undefined : ms;
}

/** The `rel="next"` URL of a GitHub `Link` header, if any. */
function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}
