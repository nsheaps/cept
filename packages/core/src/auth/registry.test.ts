import { describe, expect, it, vi } from 'vitest';
import { MemoryTokenStore } from './github.js';
import type { FetchFn } from './github.js';
import { PAT_STORE_KEY, PatAuthError } from './pat.js';
import {
  GitAuthError,
  GitAuthRegistry,
  MemoryAuthIndexStore,
  normalizeHost,
  type AuthIndexStore,
} from './registry.js';

const ALICE = ['github_pat_', 'aliceFake'].join('') + '0'.repeat(40);
const ALICE_2 = ['github_pat_', 'alice_2Fake'].join('') + '0'.repeat(40);
const BOB = ['ghp_', 'bobFake'].join('') + '0'.repeat(30);
const GITLAB = ['glpat-', 'gitlabFake'].join('') + '0'.repeat(40);

const USERS: Record<string, { login: string; id: number }> = {
  [ALICE]: { login: 'alice', id: 1 },
  [ALICE_2]: { login: 'alice', id: 1 },
  [BOB]: { login: 'bob', id: 2 },
};

/** A GitHub that knows the tokens above; `down` makes it unreachable, `revoked` rejects tokens. */
function github(state: { down?: boolean; revoked?: Set<string> } = {}) {
  const calls: string[] = [];
  const fetch = vi.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push(url);
    if (state.down) throw new Error('offline');
    const token = init?.headers?.Authorization?.replace('Bearer ', '') ?? '';
    const user = USERS[token];
    if (!user || state.revoked?.has(token)) return new Response(null, { status: 401 });
    return new Response(
      JSON.stringify({ ...user, name: user.login, avatar_url: `https://a/${user.login}.png` }),
      { status: 200, headers: { 'X-OAuth-Scopes': 'repo' } },
    );
  }) as unknown as FetchFn & ReturnType<typeof vi.fn>;
  return { fetch, calls };
}

function setup(state: { down?: boolean; revoked?: Set<string> } = {}) {
  const tokenStore = new MemoryTokenStore();
  const indexStore = new MemoryAuthIndexStore();
  const gh = github(state);
  let n = 0;
  const registry = new GitAuthRegistry({
    tokenStore,
    indexStore,
    fetch: gh.fetch,
    newId: () => `auth-${++n}`,
    now: () => new Date('2026-10-12T12:00:00Z'),
  });
  return { registry, tokenStore, indexStore, gh, state };
}

describe('GitAuthRegistry.add', () => {
  it('starts with no auths', async () => {
    expect(await setup().registry.list()).toEqual([]);
  });

  it('checks a github.com token and records the account it signs in as', async () => {
    const { registry } = setup();

    const record = await registry.add({ token: ALICE });

    expect(record).toMatchObject({
      id: 'auth-1',
      host: 'github.com',
      username: 'x-access-token',
      label: '@alice',
      status: 'ok',
      createdAt: '2026-10-12T12:00:00.000Z',
      account: { login: 'alice', id: 1, avatarUrl: 'https://a/alice.png' },
      grants: { kind: 'fine-grained' },
    });
    expect(await registry.list()).toEqual([record]);
  });

  it('keeps several auths, including two different tokens for one account', async () => {
    const { registry } = setup();

    await registry.add({ token: ALICE });
    await registry.add({ token: ALICE_2, label: 'Alice (work org)' });
    await registry.add({ token: BOB });

    expect((await registry.list()).map((r) => r.label)).toEqual([
      '@alice',
      'Alice (work org)',
      '@bob',
    ]);
  });

  it('saves nothing when GitHub rejects the token', async () => {
    const { registry, tokenStore } = setup();

    await expect(registry.add({ token: 'ghp_unknownToken0123456789' })).rejects.toMatchObject({
      reason: 'invalid',
    });

    expect(await registry.list()).toEqual([]);
    expect(await tokenStore.get('cept:auth:token:auth-1')).toBeNull();
  });

  it('refuses a token that is already added, without asking GitHub', async () => {
    const { registry, gh } = setup();
    await registry.add({ token: ALICE });
    gh.fetch.mockClear();

    await expect(registry.add({ token: ` ${ALICE} ` })).rejects.toMatchObject({
      reason: 'duplicate',
      message: 'That token is already added as @alice.',
    });
    expect(gh.fetch).not.toHaveBeenCalled();
  });

  it('saves a token for another host unchecked, with its username', async () => {
    const { registry, gh } = setup();

    const record = await registry.add({
      host: 'https://GitLab.example.com/some/path',
      username: 'oauth2',
      token: GITLAB,
    });

    expect(record).toMatchObject({
      host: 'gitlab.example.com',
      username: 'oauth2',
      label: 'gitlab.example.com',
      status: 'unchecked',
    });
    expect(record.account).toBeUndefined();
    expect(gh.fetch).not.toHaveBeenCalled();
    expect(await registry.httpAuth(record.id)).toEqual({
      username: 'oauth2',
      password: GITLAB,
      token: GITLAB,
    });
  });

  it('needs a username for hosts other than github.com, and a real host name', async () => {
    const { registry } = setup();

    await expect(registry.add({ host: 'git.example.com', token: GITLAB })).rejects.toMatchObject({
      reason: 'invalid',
      message: 'Enter the username for git.example.com.',
    });
    await expect(registry.add({ host: 'not a host', token: GITLAB })).rejects.toBeInstanceOf(
      GitAuthError,
    );
    await expect(registry.add({ token: '  ' })).rejects.toMatchObject({ reason: 'invalid' });
  });

  it('does not lose an auth when two are added at once', async () => {
    const { registry } = setup();

    await Promise.all([registry.add({ token: ALICE }), registry.add({ token: BOB })]);

    expect(await registry.list()).toHaveLength(2);
  });

  it('rolls the token back when the list cannot be saved', async () => {
    const tokenStore = new MemoryTokenStore();
    const failing: AuthIndexStore = {
      load: async () => [],
      save: async () => {
        throw new Error('disk full');
      },
    };
    const registry = new GitAuthRegistry({
      tokenStore,
      indexStore: failing,
      fetch: github().fetch,
      newId: () => 'auth-1',
    });

    await expect(registry.add({ token: ALICE })).rejects.toThrow('disk full');

    expect(await tokenStore.get('cept:auth:token:auth-1')).toBeNull();
  });
});

describe('what the list holds', () => {
  it('never holds a token, and errors never show one', async () => {
    const { registry, indexStore } = setup();
    await registry.add({ token: ALICE });
    await registry.add({ host: 'git.example.com', username: 'me', token: GITLAB });

    const stored = JSON.stringify(await indexStore.load());
    expect(stored).not.toContain(ALICE);
    expect(stored).not.toContain(GITLAB);

    const failure = await registry.add({ token: ALICE }).catch((err: Error) => err);
    expect(`${failure}${(failure as Error).stack}`).not.toContain(ALICE);
  });
});

describe('GitAuthRegistry.remove and rename', () => {
  it('removes one auth and its token and leaves the others', async () => {
    const { registry, tokenStore } = setup();
    const a = await registry.add({ token: ALICE });
    const b = await registry.add({ token: BOB });

    await registry.remove(a.id);

    expect(await registry.list()).toEqual([b]);
    expect(await tokenStore.get(`cept:auth:token:${a.id}`)).toBeNull();
    expect(await tokenStore.get(`cept:auth:token:${b.id}`)).not.toBeNull();
    await expect(registry.httpAuth(a.id)).rejects.toMatchObject({ reason: 'unknown-auth' });
  });

  it('ignores an unknown id', async () => {
    const { registry } = setup();
    await expect(registry.remove('nope')).resolves.toBeUndefined();
  });

  it('renames an auth, refusing an empty name', async () => {
    const { registry } = setup();
    const a = await registry.add({ token: ALICE });

    expect((await registry.rename(a.id, ' Work ')).label).toBe('Work');
    await expect(registry.rename(a.id, ' ')).rejects.toMatchObject({ reason: 'invalid' });
    await expect(registry.rename('nope', 'x')).rejects.toMatchObject({ reason: 'unknown-auth' });
  });
});

describe('GitAuthRegistry.httpAuth', () => {
  it('gives the token as the password for GitHub', async () => {
    const { registry } = setup();
    const a = await registry.add({ token: ALICE });

    expect(await registry.httpAuth(a.id)).toEqual({
      username: 'x-access-token',
      password: ALICE,
      token: ALICE,
    });
  });
});

describe('GitAuthRegistry.restore', () => {
  it('moves the token an earlier version saved into the list as the first auth', async () => {
    const { registry, tokenStore } = setup();
    await tokenStore.set(PAT_STORE_KEY, { accessToken: ALICE, scopes: [] });

    const { records } = await registry.restore();

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ host: 'github.com', label: '@alice', status: 'ok' });
    expect(await tokenStore.get(PAT_STORE_KEY)).toBeNull();
    expect(await registry.httpAuth(records[0]!.id)).toMatchObject({ password: ALICE });
  });

  it('keeps the earlier token for next time when GitHub cannot be reached', async () => {
    const { registry, tokenStore, state } = setup({ down: true });
    await tokenStore.set(PAT_STORE_KEY, { accessToken: ALICE, scopes: [] });

    expect((await registry.restore()).records).toEqual([]);
    expect(await tokenStore.get(PAT_STORE_KEY)).not.toBeNull();

    state.down = false;
    expect((await registry.restore()).records).toHaveLength(1);
    expect(await tokenStore.get(PAT_STORE_KEY)).toBeNull();
  });

  it('drops an earlier token GitHub rejects', async () => {
    const { registry, tokenStore } = setup();
    await tokenStore.set(PAT_STORE_KEY, { accessToken: 'ghp_revokedToken0123456789', scopes: [] });

    expect((await registry.restore()).records).toEqual([]);
    expect(await tokenStore.get(PAT_STORE_KEY)).toBeNull();
  });

  it('marks a token GitHub now rejects, deletes it and keeps the auth listed', async () => {
    const { registry, tokenStore, state } = setup();
    const a = await registry.add({ token: ALICE });
    const b = await registry.add({ token: BOB });
    state.revoked = new Set([ALICE]);

    const { records } = await registry.restore();

    expect(records.find((r) => r.id === a.id)?.status).toBe('rejected');
    expect(records.find((r) => r.id === b.id)?.status).toBe('ok');
    expect(await tokenStore.get(`cept:auth:token:${a.id}`)).toBeNull();
    await expect(registry.httpAuth(a.id)).rejects.toBeInstanceOf(PatAuthError);
    expect((await registry.get(a.id))?.status).toBe('rejected');
  });

  it('leaves auths as they were when GitHub cannot be reached', async () => {
    const { registry, state } = setup();
    const a = await registry.add({ token: ALICE });
    state.down = true;

    const { records, unreachable } = await registry.restore();

    expect(unreachable).toEqual([a.id]);
    expect(records).toEqual([a]);
    expect(await registry.httpAuth(a.id)).toMatchObject({ password: ALICE });
  });

  it('does not ask GitHub about other hosts', async () => {
    const { registry, gh } = setup();
    await registry.add({ host: 'git.example.com', username: 'me', token: GITLAB });
    gh.fetch.mockClear();

    const { records } = await registry.restore();

    expect(records[0]?.status).toBe('unchecked');
    expect(gh.fetch).not.toHaveBeenCalled();
  });
});

describe('GitAuthRegistry.replaceToken', () => {
  it('gives a rejected auth a new token under the same id', async () => {
    const { registry, state } = setup();
    const a = await registry.add({ token: ALICE });
    state.revoked = new Set([ALICE]);
    await registry.restore();
    state.revoked = new Set();

    const updated = await registry.replaceToken(a.id, ALICE_2);

    expect(updated).toMatchObject({ id: a.id, status: 'ok' });
    expect(await registry.httpAuth(a.id)).toMatchObject({ password: ALICE_2 });
  });

  it('refuses a token another auth holds', async () => {
    const { registry } = setup();
    const a = await registry.add({ token: ALICE });
    await registry.add({ token: BOB });

    await expect(registry.replaceToken(a.id, BOB)).rejects.toMatchObject({ reason: 'duplicate' });
  });
});

describe('GitAuthRegistry.repos and createRepo', () => {
  it('lists repositories with the chosen auth only', async () => {
    const { registry, gh } = setup();
    const a = await registry.add({ token: ALICE });
    await registry.add({ token: BOB });
    gh.fetch.mockClear();

    await registry.repos(a.id).catch(() => undefined);

    const auths = gh.fetch.mock.calls.map(
      (call) => (call[1] as { headers: Record<string, string> }).headers.Authorization,
    );
    expect(auths.length).toBeGreaterThan(0);
    expect(new Set(auths)).toEqual(new Set([`Bearer ${ALICE}`]));
  });

  it('has no repository list for other hosts', async () => {
    const { registry } = setup();
    const a = await registry.add({ host: 'git.example.com', username: 'me', token: GITLAB });

    await expect(registry.repos(a.id)).rejects.toMatchObject({ reason: 'unsupported' });
  });
});

describe('normalizeHost', () => {
  it('reads a host from a bare name, a URL or a name with a path', () => {
    expect(normalizeHost('GitHub.com')).toBe('github.com');
    expect(normalizeHost('https://git.example.com:8443/org/repo')).toBe('git.example.com:8443');
    expect(normalizeHost('  gitlab.com/ ')).toBe('gitlab.com');
  });

  it('rejects anything that is not a host', () => {
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('a b')).toBeNull();
    expect(normalizeHost('-bad.example')).toBeNull();
  });

  it('rejects ports outside 1-65535', () => {
    expect(normalizeHost('git.example.com:65535')).toBe('git.example.com:65535');
    expect(normalizeHost('git.example.com:65536')).toBeNull();
    expect(normalizeHost('git.example.com:0')).toBeNull();
  });
});

describe('GitAuthRegistry failures', () => {
  it('puts the old token back when replacing it cannot be saved to the list', async () => {
    const { registry, tokenStore, indexStore } = setup();
    const a = await registry.add({ token: ALICE });
    const save = indexStore.save.bind(indexStore);
    indexStore.save = async () => {
      throw new Error('disk full');
    };

    await expect(registry.replaceToken(a.id, ALICE_2)).rejects.toThrow('disk full');

    indexStore.save = save;
    expect((await tokenStore.get(`cept:auth:token:${a.id}`))?.accessToken).toBe(ALICE);
    expect((await registry.httpAuth(a.id)).password).toBe(ALICE);
  });

  it('removes the new token again when a rejected auth cannot be saved', async () => {
    const { registry, tokenStore, indexStore, state } = setup();
    const a = await registry.add({ token: ALICE });
    state.revoked = new Set([ALICE]);
    await registry.restore();
    expect((await registry.get(a.id))?.status).toBe('rejected');
    indexStore.save = async () => {
      throw new Error('disk full');
    };

    await expect(registry.replaceToken(a.id, BOB)).rejects.toThrow('disk full');

    expect(await tokenStore.get(`cept:auth:token:${a.id}`)).toBeNull();
  });

  it('keeps token-shaped text out of its messages', () => {
    const error = new GitAuthError('invalid', `bad ${BOB}`);
    expect(error.message).not.toContain(BOB);
  });
});
