import { describe, it, expect, vi } from 'vitest';
import {
  GitHubAuthProvider,
  MemoryTokenStore,
  AuthPendingError,
  AuthSlowDownError,
} from './github.js';
import type { AuthToken } from './provider.js';
import type { FetchFn, GitHubOAuthConfig } from './github.js';

function mockFetch(responses: Array<{ status: number; body: unknown }>): FetchFn {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: async () => resp.body,
    } as Response;
  });
}

const defaultConfig: GitHubOAuthConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  scopes: ['repo'],
  redirectUri: 'http://localhost:3000/callback',
};

const validToken: AuthToken = {
  accessToken: 'gho_test_token_123',
  scopes: ['repo'],
};

describe('GitHubAuthProvider', () => {
  describe('constructor', () => {
    it('creates provider with github type', () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      expect(provider.type).toBe('github');
    });

    it('uses default scopes when not specified', () => {
      const provider = new GitHubAuthProvider({ clientId: 'test' });
      expect(provider.type).toBe('github');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns correct authorization URL', () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      const url = provider.getAuthorizationUrl('random-state');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=repo');
      expect(url).toContain('state=random-state');
      expect(url).toContain('redirect_uri=http');
    });

    it('omits redirect_uri when not configured', () => {
      const provider = new GitHubAuthProvider({ clientId: 'test' });
      const url = provider.getAuthorizationUrl('state');
      expect(url).not.toContain('redirect_uri');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for token', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: {
          access_token: 'gho_abc123',
          token_type: 'bearer',
          scope: 'repo',
        },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      const token = await provider.exchangeCode('auth-code-123', 'state');
      expect(token.accessToken).toBe('gho_abc123');
      expect(token.scopes).toEqual(['repo']);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('throws on HTTP error', async () => {
      const fetch = mockFetch([{ status: 500, body: {} }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.exchangeCode('bad-code')).rejects.toThrow('token exchange failed');
    });

    it('throws on OAuth error response', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { error: 'bad_verification_code', error_description: 'The code is invalid' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.exchangeCode('bad-code')).rejects.toThrow('The code is invalid');
    });

    it('handles token with expiry', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: {
          access_token: 'gho_abc',
          scope: 'repo',
          refresh_token: 'ghr_refresh',
          expires_in: 3600,
        },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      const token = await provider.exchangeCode('code');
      expect(token.accessToken).toBe('gho_abc');
      expect(token.refreshToken).toBe('ghr_refresh');
      expect(token.expiresAt).toBeDefined();
      expect(token.expiresAt!).toBeGreaterThan(Date.now());
    });

    it('stores token after exchange', async () => {
      const store = new MemoryTokenStore();
      const fetch = mockFetch([{
        status: 200,
        body: { access_token: 'gho_stored', scope: 'repo' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      await provider.exchangeCode('code');
      const stored = await store.get('cept:github:token');
      expect(stored).not.toBeNull();
      expect(stored!.accessToken).toBe('gho_stored');
    });
  });

  describe('authenticate', () => {
    it('returns cached token if valid', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);
      const provider = new GitHubAuthProvider(defaultConfig, store);

      const token = await provider.authenticate();
      expect(token.accessToken).toBe('gho_test_token_123');
    });

    it('throws when no token exists', async () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      await expect(provider.authenticate()).rejects.toThrow('No valid token');
    });

    it('throws when token is expired', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', {
        ...validToken,
        expiresAt: Date.now() - 1000,
      });
      const provider = new GitHubAuthProvider(defaultConfig, store);

      await expect(provider.authenticate()).rejects.toThrow('No valid token');
    });
  });

  describe('startDeviceFlow', () => {
    it('returns device verification info', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: {
          device_code: 'dc_123',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      const result = await provider.startDeviceFlow();
      expect(result.userCode).toBe('ABCD-1234');
      expect(result.verificationUri).toBe('https://github.com/login/device');
      expect(result.expiresIn).toBe(900);
      expect(result.interval).toBe(5);
    });

    it('throws on HTTP error', async () => {
      const fetch = mockFetch([{ status: 500, body: {} }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.startDeviceFlow()).rejects.toThrow('device flow initiation failed');
    });
  });

  describe('pollDeviceFlow', () => {
    it('returns token when user completes authorization', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { access_token: 'gho_device', scope: 'repo' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      const token = await provider.pollDeviceFlow('dc_123');
      expect(token.accessToken).toBe('gho_device');
    });

    it('throws AuthPendingError when authorization pending', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { error: 'authorization_pending' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.pollDeviceFlow('dc_123')).rejects.toThrow(AuthPendingError);
    });

    it('throws AuthSlowDownError when polling too fast', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { error: 'slow_down' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.pollDeviceFlow('dc_123')).rejects.toThrow(AuthSlowDownError);
    });

    it('throws on expired token', async () => {
      const fetch = mockFetch([{
        status: 200,
        body: { error: 'expired_token' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, undefined, fetch);

      await expect(provider.pollDeviceFlow('dc_123')).rejects.toThrow('expired');
    });
  });

  describe('setToken', () => {
    it('stores token for later use', async () => {
      const store = new MemoryTokenStore();
      const provider = new GitHubAuthProvider(defaultConfig, store);

      await provider.setToken(validToken);
      const stored = await store.get('cept:github:token');
      expect(stored!.accessToken).toBe('gho_test_token_123');
    });
  });

  describe('getRepos', () => {
    it('fetches user repositories', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{
        status: 200,
        body: [{
          name: 'my-repo',
          full_name: 'user/my-repo',
          html_url: 'https://github.com/user/my-repo',
          clone_url: 'https://github.com/user/my-repo.git',
          ssh_url: 'git@github.com:user/my-repo.git',
          private: false,
          description: 'A test repo',
          default_branch: 'main',
        }],
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const repos = await provider.getRepos();
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('my-repo');
      expect(repos[0].fullName).toBe('user/my-repo');
      expect(repos[0].httpsUrl).toBe('https://github.com/user/my-repo.git');
      expect(repos[0].private).toBe(false);
      expect(repos[0].defaultBranch).toBe('main');
    });

    it('paginates through all repos', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const makeRepos = (count: number) =>
        Array.from({ length: count }, (_, idx) => ({
          name: `repo-${idx}`,
          full_name: `user/repo-${idx}`,
          html_url: `https://github.com/user/repo-${idx}`,
          clone_url: `https://github.com/user/repo-${idx}.git`,
          ssh_url: `git@github.com:user/repo-${idx}.git`,
          private: false,
          description: null,
          default_branch: 'main',
        }));

      const fetch = mockFetch([
        { status: 200, body: makeRepos(100) },
        { status: 200, body: makeRepos(30) },
      ]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const repos = await provider.getRepos();
      expect(repos).toHaveLength(130);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('throws when not authenticated', async () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      await expect(provider.getRepos()).rejects.toThrow('Not authenticated');
    });

    it('clears token on 401 response', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{ status: 401, body: {} }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      await expect(provider.getRepos()).rejects.toThrow('expired or revoked');
      const stored = await store.get('cept:github:token');
      expect(stored).toBeNull();
    });
  });

  describe('getHttpAuth', () => {
    it('returns HTTP auth for isomorphic-git', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);
      const provider = new GitHubAuthProvider(defaultConfig, store);

      const auth = await provider.getHttpAuth();
      expect(auth.username).toBe('gho_test_token_123');
      expect(auth.password).toBe('x-oauth-basic');
      expect(auth.token).toBe('gho_test_token_123');
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token', async () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      const result = await provider.isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns true when token is valid and API responds', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{ status: 200, body: { login: 'user' } }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const result = await provider.isAuthenticated();
      expect(result).toBe(true);
    });

    it('returns false when API rejects token', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{ status: 401, body: {} }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const result = await provider.isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false when token is expired', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', {
        ...validToken,
        expiresAt: Date.now() - 1000,
      });
      const provider = new GitHubAuthProvider(defaultConfig, store);

      const result = await provider.isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = vi.fn(async () => {
        throw new Error('Network error');
      }) as unknown as FetchFn;
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const result = await provider.isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears stored token', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);
      const provider = new GitHubAuthProvider(defaultConfig, store);

      await provider.logout();
      const stored = await store.get('cept:github:token');
      expect(stored).toBeNull();
    });
  });

  describe('getUser', () => {
    it('returns user info', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{
        status: 200,
        body: {
          login: 'octocat',
          name: 'Octocat',
          email: 'octo@github.com',
          avatar_url: 'https://avatars.githubusercontent.com/u/1',
        },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const user = await provider.getUser();
      expect(user.login).toBe('octocat');
      expect(user.name).toBe('Octocat');
      expect(user.email).toBe('octo@github.com');
      expect(user.avatarUrl).toContain('avatars');
    });

    it('throws when not authenticated', async () => {
      const provider = new GitHubAuthProvider(defaultConfig);
      await expect(provider.getUser()).rejects.toThrow('Not authenticated');
    });
  });

  describe('createRepo', () => {
    it('creates a new repository', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{
        status: 201,
        body: {
          name: 'new-repo',
          full_name: 'user/new-repo',
          html_url: 'https://github.com/user/new-repo',
          clone_url: 'https://github.com/user/new-repo.git',
          ssh_url: 'git@github.com:user/new-repo.git',
          private: true,
          description: 'Created by Cept',
          default_branch: 'main',
        },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      const repo = await provider.createRepo({
        name: 'new-repo',
        description: 'Created by Cept',
        private: true,
      });
      expect(repo.name).toBe('new-repo');
      expect(repo.private).toBe(true);
    });

    it('throws on API error', async () => {
      const store = new MemoryTokenStore();
      await store.set('cept:github:token', validToken);

      const fetch = mockFetch([{
        status: 422,
        body: { message: 'Repository creation failed. Name already exists.' },
      }]);
      const provider = new GitHubAuthProvider(defaultConfig, store, fetch);

      await expect(provider.createRepo({ name: 'existing' })).rejects.toThrow('Name already exists');
    });
  });
});

describe('MemoryTokenStore', () => {
  it('stores and retrieves tokens', async () => {
    const store = new MemoryTokenStore();
    await store.set('key', validToken);
    const result = await store.get('key');
    expect(result!.accessToken).toBe('gho_test_token_123');
  });

  it('returns null for missing keys', async () => {
    const store = new MemoryTokenStore();
    const result = await store.get('missing');
    expect(result).toBeNull();
  });

  it('deletes tokens', async () => {
    const store = new MemoryTokenStore();
    await store.set('key', validToken);
    await store.delete('key');
    const result = await store.get('key');
    expect(result).toBeNull();
  });
});
