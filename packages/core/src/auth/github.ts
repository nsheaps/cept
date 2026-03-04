/**
 * GitHubAuthProvider — Implements AuthProvider for GitHub OAuth.
 *
 * Supports two flows:
 * 1. Web OAuth flow (authorization code grant) — for browser & desktop
 * 2. Device flow — for CLI / environments without redirect URI
 *
 * Token persistence is delegated to a TokenStore abstraction so
 * different platforms (browser localStorage, desktop keychain) can
 * provide their own secure storage.
 */

import type { AuthProvider, AuthToken, HttpAuth, RepoInfo } from './provider.js';

/** Configuration for GitHub OAuth App */
export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret?: string;
  scopes?: string[];
  redirectUri?: string;
  apiBase?: string;
}

/** Abstraction for persisting auth tokens across sessions */
export interface TokenStore {
  get(key: string): Promise<AuthToken | null>;
  set(key: string, token: AuthToken): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Device flow verification info returned to the caller for display */
export interface DeviceFlowVerification {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

/** HTTP fetch function type — injectable for testing */
export type FetchFn = typeof globalThis.fetch;

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_BASE = 'https://github.com';
const DEFAULT_SCOPES = ['repo'];
const TOKEN_STORE_KEY = 'cept:github:token';

/**
 * In-memory token store (default). Tokens are lost on page reload.
 * Replace with localStorage/keychain-backed store for persistence.
 */
export class MemoryTokenStore implements TokenStore {
  private store = new Map<string, AuthToken>();

  async get(key: string): Promise<AuthToken | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, token: AuthToken): Promise<void> {
    this.store.set(key, token);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class GitHubAuthProvider implements AuthProvider {
  readonly type = 'github' as const;

  private config: Required<Pick<GitHubOAuthConfig, 'clientId' | 'scopes'>> & GitHubOAuthConfig;
  private tokenStore: TokenStore;
  private fetchFn: FetchFn;
  private cachedToken: AuthToken | null = null;

  constructor(
    config: GitHubOAuthConfig,
    tokenStore?: TokenStore,
    fetchFn?: FetchFn,
  ) {
    this.config = {
      ...config,
      scopes: config.scopes ?? DEFAULT_SCOPES,
    };
    this.tokenStore = tokenStore ?? new MemoryTokenStore();
    this.fetchFn = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Authenticate using an authorization code (web OAuth flow).
   * The caller is responsible for redirecting the user and capturing the code.
   */
  async authenticate(): Promise<AuthToken> {
    const token = await this.loadToken();
    if (token && !this.isExpired(token)) {
      return token;
    }
    throw new Error(
      'No valid token. Use exchangeCode() or startDeviceFlow() to authenticate.',
    );
  }

  /**
   * Get the authorization URL for the web OAuth flow.
   * The caller redirects the user to this URL.
   */
  getAuthorizationUrl(state: string): string {
    const base = this.config.apiBase
      ? this.config.apiBase.replace('api.', '').replace('/api/v3', '')
      : GITHUB_OAUTH_BASE;

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      state,
    });

    if (this.config.redirectUri) {
      params.set('redirect_uri', this.config.redirectUri);
    }

    return `${base}/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for an access token (web OAuth flow step 2).
   */
  async exchangeCode(code: string, state?: string): Promise<AuthToken> {
    const base = this.config.apiBase
      ? this.config.apiBase.replace('api.', '').replace('/api/v3', '')
      : GITHUB_OAUTH_BASE;

    const body: Record<string, string> = {
      client_id: this.config.clientId,
      code,
    };

    if (this.config.clientSecret) {
      body.client_secret = this.config.clientSecret;
    }
    if (this.config.redirectUri) {
      body.redirect_uri = this.config.redirectUri;
    }
    if (state) {
      body.state = state;
    }

    const response = await this.fetchFn(`${base}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`GitHub OAuth token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description ?? data.error}`);
    }

    if (!data.access_token) {
      throw new Error('GitHub OAuth response missing access_token');
    }

    const token: AuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scopes: data.scope ? data.scope.split(',') : this.config.scopes,
      expiresAt: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
    };

    await this.saveToken(token);
    return token;
  }

  /**
   * Start a device flow authentication (GitHub Device Authorization Grant).
   * Returns verification info for the user to visit and enter the code.
   * Call pollDeviceFlow() to wait for the user to complete authorization.
   */
  async startDeviceFlow(): Promise<DeviceFlowVerification> {
    const base = this.config.apiBase
      ? this.config.apiBase.replace('api.', '').replace('/api/v3', '')
      : GITHUB_OAUTH_BASE;

    const response = await this.fetchFn(`${base}/login/device/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        scope: this.config.scopes.join(' '),
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub device flow initiation failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    return {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
    };
  }

  /**
   * Poll for device flow completion. Call after startDeviceFlow().
   * The device_code is obtained from the startDeviceFlow step but kept internal
   * via a follow-up call pattern.
   */
  async pollDeviceFlow(deviceCode: string): Promise<AuthToken> {
    const base = this.config.apiBase
      ? this.config.apiBase.replace('api.', '').replace('/api/v3', '')
      : GITHUB_OAUTH_BASE;

    const response = await this.fetchFn(`${base}/login/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub device flow poll failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      scope?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (data.error === 'authorization_pending') {
      throw new AuthPendingError('User has not yet entered the code');
    }

    if (data.error === 'slow_down') {
      throw new AuthSlowDownError('Polling too fast, increase interval');
    }

    if (data.error === 'expired_token') {
      throw new Error('Device flow expired. Please restart authentication.');
    }

    if (data.error) {
      throw new Error(`GitHub device flow error: ${data.error_description ?? data.error}`);
    }

    if (!data.access_token) {
      throw new Error('GitHub device flow response missing access_token');
    }

    const token: AuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scopes: data.scope ? data.scope.split(',') : this.config.scopes,
      expiresAt: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
    };

    await this.saveToken(token);
    return token;
  }

  /**
   * Set a token directly (e.g. from a personal access token).
   */
  async setToken(token: AuthToken): Promise<void> {
    await this.saveToken(token);
  }

  async getRepos(): Promise<RepoInfo[]> {
    const token = await this.requireToken();
    const apiBase = this.config.apiBase ?? GITHUB_API_BASE;

    const repos: RepoInfo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.fetchFn(
        `${apiBase}/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        {
          headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          await this.clearToken();
          throw new Error('GitHub token expired or revoked');
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        name: string;
        full_name: string;
        html_url: string;
        clone_url: string;
        ssh_url: string;
        private: boolean;
        description: string | null;
        default_branch: string;
      }>;

      for (const repo of data) {
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

      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  async getHttpAuth(): Promise<HttpAuth> {
    const token = await this.requireToken();
    return {
      username: token.accessToken,
      password: 'x-oauth-basic',
      token: token.accessToken,
    };
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.loadToken();
    if (!token) return false;
    if (this.isExpired(token)) return false;

    // Verify token is still valid with a lightweight API call
    const apiBase = this.config.apiBase ?? GITHUB_API_BASE;
    try {
      const response = await this.fetchFn(`${apiBase}/user`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.clearToken();
  }

  /**
   * Get the authenticated user's info.
   */
  async getUser(): Promise<{ login: string; name: string | null; email: string | null; avatarUrl: string }> {
    const token = await this.requireToken();
    const apiBase = this.config.apiBase ?? GITHUB_API_BASE;

    const response = await this.fetchFn(`${apiBase}/user`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string;
    };

    return {
      login: data.login,
      name: data.name,
      email: data.email,
      avatarUrl: data.avatar_url,
    };
  }

  /**
   * Create a new repository on GitHub.
   */
  async createRepo(options: {
    name: string;
    description?: string;
    private?: boolean;
  }): Promise<RepoInfo> {
    const token = await this.requireToken();
    const apiBase = this.config.apiBase ?? GITHUB_API_BASE;

    const response = await this.fetchFn(`${apiBase}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description ?? '',
        private: options.private ?? true,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const errBody = (await response.json()) as { message?: string };
      throw new Error(`GitHub create repo failed: ${errBody.message ?? response.status}`);
    }

    const repo = (await response.json()) as {
      name: string;
      full_name: string;
      html_url: string;
      clone_url: string;
      ssh_url: string;
      private: boolean;
      description: string | null;
      default_branch: string;
    };

    return {
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      httpsUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      private: repo.private,
      description: repo.description ?? undefined,
      defaultBranch: repo.default_branch,
    };
  }

  // -- Internal helpers --

  private isExpired(token: AuthToken): boolean {
    if (!token.expiresAt) return false;
    return Date.now() >= token.expiresAt;
  }

  private async loadToken(): Promise<AuthToken | null> {
    if (this.cachedToken && !this.isExpired(this.cachedToken)) {
      return this.cachedToken;
    }
    const token = await this.tokenStore.get(TOKEN_STORE_KEY);
    if (token) {
      this.cachedToken = token;
    }
    return token;
  }

  private async saveToken(token: AuthToken): Promise<void> {
    this.cachedToken = token;
    await this.tokenStore.set(TOKEN_STORE_KEY, token);
  }

  private async clearToken(): Promise<void> {
    this.cachedToken = null;
    await this.tokenStore.delete(TOKEN_STORE_KEY);
  }

  private async requireToken(): Promise<AuthToken> {
    const token = await this.loadToken();
    if (!token) {
      throw new Error('Not authenticated. Call authenticate() or exchangeCode() first.');
    }
    if (this.isExpired(token)) {
      await this.clearToken();
      throw new Error('Token expired. Re-authenticate required.');
    }
    return token;
  }
}

/** Thrown when device flow is still pending user authorization */
export class AuthPendingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthPendingError';
  }
}

/** Thrown when device flow polling is too fast */
export class AuthSlowDownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthSlowDownError';
  }
}
