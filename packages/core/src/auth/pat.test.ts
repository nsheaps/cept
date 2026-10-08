import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryTokenStore } from './github.js';
import type { FetchFn } from './github.js';
import { PAT_STORE_KEY, PatAuthError, PatAuthProvider, redactTokens } from './pat.js';

const CLASSIC = 'ghp_classicSecret0123456789abcdefABCDEF';
const FINE = 'github_pat_11AAAAAAA0fineSecret_0123456789abcdefghijklmnop';

const USER = {
  login: 'octo',
  name: 'Octo Cat',
  avatar_url: 'https://avatars.example/octo.png',
};

interface Reply {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function fetchReplying(...replies: Array<Reply | Error>): ReturnType<typeof vi.fn> & FetchFn {
  let call = 0;
  return vi.fn(async () => {
    const reply = replies[Math.min(call++, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return new Response(reply?.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply?.status ?? 200,
      headers: reply?.headers,
    });
  }) as ReturnType<typeof vi.fn> & FetchFn;
}

/** Everything a failure might show a user or a log: message, stack, string and JSON forms. */
function surfaces(err: unknown): string {
  const e = err as Error & { cause?: unknown };
  return [String(e), e.message, e.stack ?? '', JSON.stringify(e), String(e.cause ?? '')].join('\n');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PatAuthProvider.signIn', () => {
  it('keeps the account id GitHub sends, for the commit noreply address', async () => {
    const fetch = fetchReplying({ status: 200, body: { ...USER, id: 583231 } });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });

    const account = await provider.signIn(CLASSIC);

    expect(account.id).toBe(583231);
  });

  it('validates a classic token with GET /user and reports its scopes and expiry', async () => {
    const fetch = fetchReplying({
      status: 200,
      body: USER,
      headers: {
        'X-OAuth-Scopes': 'repo, read:org',
        'GitHub-Authentication-Token-Expiration': '2027-01-02 03:04:05 UTC',
      },
    });
    const store = new MemoryTokenStore();
    const provider = new PatAuthProvider({ tokenStore: store, fetch });

    const account = await provider.signIn(`  ${CLASSIC}\n`);

    expect(account).toEqual({
      login: 'octo',
      name: 'Octo Cat',
      avatarUrl: 'https://avatars.example/octo.png',
      grants: {
        kind: 'classic',
        scopes: ['repo', 'read:org'],
        expiresAt: Date.UTC(2027, 0, 2, 3, 4, 5),
      },
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${CLASSIC}`);
    expect(await store.get(PAT_STORE_KEY)).toEqual({
      accessToken: CLASSIC,
      scopes: ['repo', 'read:org'],
      expiresAt: Date.UTC(2027, 0, 2, 3, 4, 5),
    });
  });

  it('reports a fine-grained token, which GitHub gives no scope list for', async () => {
    const fetch = fetchReplying({ status: 200, body: USER });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });

    const account = await provider.signIn(FINE);

    expect(account.grants).toEqual({ kind: 'fine-grained', scopes: null });
  });

  it('reports no scopes for a fine-grained token even when GitHub sends an empty scope header', async () => {
    const fetch = fetchReplying({ status: 200, body: USER, headers: { 'X-OAuth-Scopes': '' } });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    expect((await provider.signIn(FINE)).grants.scopes).toBeNull();
  });

  it.each([
    ['2027-01-02 03:04:05 UTC', Date.UTC(2027, 0, 2, 3, 4, 5)],
    ['2027-01-02 03:04:05 +01:00', Date.UTC(2027, 0, 2, 2, 4, 5)],
    ['2027-01-02 03:04:05 -0130', Date.UTC(2027, 0, 2, 4, 34, 5)],
    ['2027-01-02T03:04:05Z', Date.UTC(2027, 0, 2, 3, 4, 5)],
    ['next tuesday', undefined],
  ])('reads the expiry header %j', async (header, expected) => {
    const fetch = fetchReplying({
      status: 200,
      body: USER,
      headers: { 'GitHub-Authentication-Token-Expiration': header },
    });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    expect((await provider.signIn(CLASSIC)).grants.expiresAt).toBe(expected);
  });

  it('uses a configured API base (for a proxy or GitHub Enterprise)', async () => {
    const fetch = fetchReplying({ status: 200, body: USER });
    const provider = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch,
      apiBase: 'https://ghe.example/api/v3/',
    });
    await provider.signIn(CLASSIC);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://ghe.example/api/v3/user');
  });

  it('rejects a 401 without saving the token', async () => {
    const store = new MemoryTokenStore();
    const provider = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({ status: 401, body: { message: 'Bad credentials' } }),
    });

    const err = await provider.signIn(CLASSIC).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PatAuthError);
    expect((err as PatAuthError).reason).toBe('invalid');
    expect(await store.get(PAT_STORE_KEY)).toBeNull();
    expect(await provider.isAuthenticated()).toBe(false);
  });

  it('rejects an empty token without calling GitHub', async () => {
    const fetch = fetchReplying({ status: 200, body: USER });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    await expect(provider.signIn('   ')).rejects.toMatchObject({ reason: 'invalid' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports other HTTP failures and network failures distinctly', async () => {
    const forbidden = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch: fetchReplying({ status: 403, body: { message: 'rate limited' } }),
    });
    await expect(forbidden.signIn(CLASSIC)).rejects.toMatchObject({ reason: 'http', status: 403 });

    const offline = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch: fetchReplying(new TypeError('Failed to fetch')),
    });
    await expect(offline.signIn(CLASSIC)).rejects.toMatchObject({ reason: 'network' });
  });

  it('rejects a reply that is not a GitHub user', async () => {
    const provider = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch: fetchReplying({ status: 200, body: { hello: 'proxy page' } }),
    });
    await expect(provider.signIn(CLASSIC)).rejects.toMatchObject({ reason: 'http' });
  });
});

describe('PatAuthProvider after sign-in', () => {
  it('restores the account from the store on a new provider', async () => {
    const store = new MemoryTokenStore();
    await new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({ status: 200, body: USER }),
    }).signIn(CLASSIC);

    const later = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({ status: 200, body: USER }),
    });
    expect((await later.restore())?.login).toBe('octo');
    expect(await later.isAuthenticated()).toBe(true);
  });

  it('refreshes the stored scopes and expiry when it restores', async () => {
    const store = new MemoryTokenStore();
    await store.set(PAT_STORE_KEY, { accessToken: CLASSIC, scopes: ['repo'] });
    const provider = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({
        status: 200,
        body: USER,
        headers: {
          'X-OAuth-Scopes': 'repo, workflow',
          'GitHub-Authentication-Token-Expiration': '2027-01-02 03:04:05 UTC',
        },
      }),
    });
    await provider.restore();
    expect(await store.get(PAT_STORE_KEY)).toEqual({
      accessToken: CLASSIC,
      scopes: ['repo', 'workflow'],
      expiresAt: Date.UTC(2027, 0, 2, 3, 4, 5),
    });
  });

  it('forgets a stored token GitHub now rejects', async () => {
    const store = new MemoryTokenStore();
    await store.set(PAT_STORE_KEY, { accessToken: CLASSIC, scopes: [] });
    const provider = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({ status: 401 }),
    });
    expect(await provider.restore()).toBeNull();
    expect(await store.get(PAT_STORE_KEY)).toBeNull();
  });

  it('keeps a stored token when GitHub cannot be reached', async () => {
    const store = new MemoryTokenStore();
    await store.set(PAT_STORE_KEY, { accessToken: CLASSIC, scopes: [] });
    const provider = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying(new TypeError('Failed to fetch')),
    });
    await expect(provider.restore()).rejects.toMatchObject({ reason: 'network' });
    expect(await store.get(PAT_STORE_KEY)).not.toBeNull();
  });

  it('restores nothing when no token is stored', async () => {
    const fetch = fetchReplying({ status: 200, body: USER });
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    expect(await provider.restore()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives Git the token as basic auth and the stored token to authenticate()', async () => {
    const provider = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch: fetchReplying({ status: 200, body: USER }),
    });
    await expect(provider.getHttpAuth()).rejects.toBeInstanceOf(PatAuthError);
    await provider.signIn(CLASSIC);
    expect(await provider.getHttpAuth()).toEqual({
      username: 'x-access-token',
      password: CLASSIC,
      token: CLASSIC,
    });
    expect((await provider.authenticate()).accessToken).toBe(CLASSIC);
  });

  it('lists repositories across pages', async () => {
    const repo = (n: number) => ({
      name: `r${n}`,
      full_name: `octo/r${n}`,
      html_url: `https://github.com/octo/r${n}`,
      clone_url: `https://github.com/octo/r${n}.git`,
      ssh_url: `git@github.com:octo/r${n}.git`,
      private: n % 2 === 0,
      description: null,
      default_branch: 'main',
    });
    const fetch = fetchReplying(
      { status: 200, body: USER },
      {
        status: 200,
        body: [repo(1)],
        headers: { Link: '<https://api.github.com/user/repos?page=2>; rel="next"' },
      },
      { status: 200, body: [repo(2)] },
    );
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    await provider.signIn(CLASSIC);

    const repos = await provider.getRepos();

    expect(repos.map((r) => r.fullName)).toEqual(['octo/r1', 'octo/r2']);
    expect(repos[1]).toMatchObject({ private: true, defaultBranch: 'main' });
    expect(fetch.mock.calls[2]?.[0]).toBe('https://api.github.com/user/repos?page=2');
  });

  it('creates a repository with a first commit', async () => {
    const fetch = fetchReplying(
      { status: 200, body: USER },
      {
        status: 201,
        body: {
          name: 'notes',
          full_name: 'octo/notes',
          html_url: 'https://github.com/octo/notes',
          clone_url: 'https://github.com/octo/notes.git',
          ssh_url: 'git@github.com:octo/notes.git',
          private: true,
          description: 'Mine',
          default_branch: 'main',
        },
      },
    );
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    await provider.signIn(CLASSIC);

    const repo = await provider.createRepo({ name: 'notes', description: 'Mine' });

    expect(repo).toMatchObject({ fullName: 'octo/notes', private: true, defaultBranch: 'main' });
    const [url, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/user/repos');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'notes',
      description: 'Mine',
      private: true,
      auto_init: true,
    });
  });

  it('reports a refused repository creation by its status only', async () => {
    const fetch = fetchReplying(
      { status: 200, body: USER },
      { status: 422, body: { message: `name already exists ${CLASSIC}` } },
    );
    const provider = new PatAuthProvider({ tokenStore: new MemoryTokenStore(), fetch });
    await provider.signIn(CLASSIC);

    const failure = await provider.createRepo({ name: 'notes' }).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(PatAuthError);
    expect((failure as PatAuthError).status).toBe(422);
    expect(surfaces(failure)).not.toContain('classicSecret');
    // No description was asked for, so none is sent.
    const [, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty('description');
  });

  it('signs out by deleting the stored token', async () => {
    const store = new MemoryTokenStore();
    const provider = new PatAuthProvider({
      tokenStore: store,
      fetch: fetchReplying({ status: 200, body: USER }),
    });
    await provider.signIn(CLASSIC);
    await provider.logout();
    expect(await store.get(PAT_STORE_KEY)).toBeNull();
    expect(await provider.isAuthenticated()).toBe(false);
  });
});

describe('token redaction', () => {
  it('redacts GitHub tokens in free text', () => {
    expect(redactTokens(`a ${CLASSIC} b ${FINE} c gho_abc123DEF456ghi789JKL0`)).toBe(
      'a [redacted] b [redacted] c [redacted]',
    );
  });

  it('never puts the token in an error or a log line, whatever fails', async () => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const failures: unknown[] = [];
    const replies: Array<Reply | Error> = [
      { status: 401, body: { message: `Bad credentials for ${CLASSIC}` } },
      { status: 500, body: { message: `boom ${CLASSIC}` } },
      new TypeError(`fetch to https://x.test/?t=${CLASSIC} failed`),
      { status: 200, body: { message: CLASSIC } },
    ];
    for (const reply of replies) {
      const provider = new PatAuthProvider({
        tokenStore: new MemoryTokenStore(),
        fetch: fetchReplying(reply),
      });
      failures.push(await provider.signIn(CLASSIC).catch((e: unknown) => e));
    }
    const listing = new PatAuthProvider({
      tokenStore: new MemoryTokenStore(),
      fetch: fetchReplying(
        { status: 200, body: USER },
        { status: 502, body: { message: `upstream saw ${CLASSIC}` } },
      ),
    });
    await listing.signIn(CLASSIC);
    failures.push(await listing.getRepos().catch((e: unknown) => e));

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(PatAuthError);
      expect(surfaces(failure)).not.toContain(CLASSIC);
      expect(surfaces(failure)).not.toContain('classicSecret');
    }
    for (const spy of logs) {
      for (const args of spy.mock.calls) {
        expect(
          args.map((a) => (a instanceof Error ? surfaces(a) : String(a))).join(' '),
        ).not.toContain('classicSecret');
      }
    }
  });
});
