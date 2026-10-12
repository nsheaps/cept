import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type {
  AutodiscoveryOptions,
  AutodiscoveryResult,
  GitAuthRecord,
  RemoteSpace,
} from '@cept/core';
import { useGitHubAccount } from './github-account.js';
import { GitAuthsProvider } from './git-auths.js';
import type { GitAuths } from './git-auths.js';
import {
  clearDiscoveries,
  discoveredSpaceId,
  loadDiscovery,
  previousSpaces,
  saveDiscovery,
  useDiscoveredSpaces,
} from './discovered-spaces.js';
import type { Discover, DiscoveredSpacesState } from './discovered-spaces.js';

const TOKEN = 'ghp_discovery_token';

function record(login: string): GitAuthRecord {
  return {
    id: 'auth-1',
    host: 'github.com',
    username: 'x-access-token',
    label: `@${login}`,
    status: 'ok',
    createdAt: '2026-01-01T00:00:00.000Z',
    account: { login, name: null, avatarUrl: '' },
    grants: { kind: 'classic', scopes: ['repo'] },
  };
}

/** Host auths with one GitHub auth signed in as `login` (null: none saved). */
function fakeAuth(login: string | null): GitAuths {
  let saved: GitAuthRecord[] = login ? [record(login)] : [];
  return {
    restore: async () => ({ records: saved, unreachable: [] }),
    list: async () => saved,
    add: async () => record('someone'),
    remove: async () => {
      saved = [];
    },
    rename: async () => record('someone'),
    replaceToken: async () => record('someone'),
    httpAuth: async () => {
      if (!saved.length) throw new Error('none');
      return { username: 'x-access-token', password: TOKEN };
    },
  };
}

/** Several GitHub auths, each with its own token (`token-<id>`). */
function fakeAuths(entries: { id: string; login: string }[]): GitAuths {
  const saved = entries.map((e) => ({ ...record(e.login), id: e.id }));
  return {
    restore: async () => ({ records: saved, unreachable: [] }),
    list: async () => saved,
    add: async () => record('someone'),
    remove: async () => undefined,
    rename: async () => record('someone'),
    replaceToken: async () => record('someone'),
    httpAuth: async (id) => ({ username: 'x-access-token', password: `token-${id}` }),
  };
}

function remote(repo: string, path = ''): RemoteSpace {
  return {
    repo,
    url: `https://github.com/${repo}`,
    path,
    marker: 'space.cept.yaml',
    name: path || repo,
    slug: 's',
    branch: 'main',
    defaultBranch: 'main',
    private: false,
    errors: [],
    warnings: [],
  };
}

function result(spaces: RemoteSpace[], extra: Partial<AutodiscoveryResult> = {}) {
  return { spaces, lost: [], warnings: [], complete: true, ...extra } as AutodiscoveryResult;
}

let latest: DiscoveredSpacesState | null = null;
let signOut: (() => Promise<void>) | null = null;

function Probe({ discover }: { discover: Discover }) {
  latest = useDiscoveredSpaces({ discover });
  signOut = useGitHubAccount()?.signOut ?? null;
  return <span data-testid="status">{latest ? latest.status : 'none'}</span>;
}

function renderWith(auth: GitAuths | null, discover: Discover) {
  return render(
    <GitAuthsProvider auths={auth}>
      <Probe discover={discover} />
    </GitAuthsProvider>,
  );
}

describe('useDiscoveredSpaces (REQ-WS-023)', () => {
  beforeEach(() => {
    localStorage.clear();
    latest = null;
  });

  it('is null and discovers nothing without a signed-in account', async () => {
    const discover = vi.fn<Discover>();
    renderWith(fakeAuth(null), discover);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('none'));
    renderWith(null, discover);
    expect(discover).not.toHaveBeenCalled();
  });

  it('discovers with the saved token when the account signs in, and keeps the result', async () => {
    const discover = vi.fn<Discover>(async () => result([remote('ann/notes', 'docs')]));
    renderWith(fakeAuth('Octocat'), discover);
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(discover).toHaveBeenCalledTimes(1);
    const options = discover.mock.calls[0]![0] as AutodiscoveryOptions;
    expect(options.token).toBe(TOKEN);
    expect(options.previous).toEqual([]);
    expect(latest?.snapshot?.spaces.map(discoveredSpaceId)).toEqual([
      'github.com/ann/notes@main/docs',
    ]);
    // Kept per account (case-insensitively), for the next start.
    expect(loadDiscovery('octocat')?.spaces).toHaveLength(1);
  });

  it('shows the kept list at once and compares the new discovery with it', async () => {
    const kept = remote('ann/old');
    const lostBefore = remote('ann/locked');
    saveDiscovery({
      login: 'octocat',
      spaces: [kept],
      lost: [{ space: lostBefore, reason: 'access' }],
      warnings: [],
      complete: true,
      checkedAt: '2026-10-01T00:00:00.000Z',
    });
    let finish: (r: AutodiscoveryResult) => void = () => {};
    const discover = vi.fn<Discover>(
      () =>
        new Promise<AutodiscoveryResult>((resolve) => {
          finish = resolve;
        }),
    );
    renderWith(fakeAuth('octocat'), discover);
    await waitFor(() => expect(discover).toHaveBeenCalled());
    expect(latest?.status).toBe('running');
    expect(latest?.snapshot?.spaces).toEqual([kept]);
    const options = discover.mock.calls[0]![0] as AutodiscoveryOptions;
    expect(options.previous).toEqual([kept, lostBefore]);

    await act(async () => finish(result([kept])));
    expect(latest?.status).toBe('done');
    expect(latest?.snapshot?.checkedAt).not.toBe('2026-10-01T00:00:00.000Z');
  });

  it('keeps the kept list and reports the error when discovery fails', async () => {
    saveDiscovery({
      login: 'octocat',
      spaces: [remote('ann/old')],
      lost: [],
      warnings: [],
      complete: true,
      checkedAt: 'x',
    });
    const discover = vi.fn<Discover>(async () => {
      throw new Error('GitHub rejected the token');
    });
    renderWith(fakeAuth('octocat'), discover);
    await waitFor(() => expect(latest?.status).toBe('error'));
    expect(latest?.error).toBe('GitHub rejected the token');
    expect(latest?.snapshot?.spaces).toHaveLength(1);
  });

  it('looks again on refresh', async () => {
    const discover = vi.fn<Discover>(async () => result([]));
    renderWith(fakeAuth('octocat'), discover);
    await waitFor(() => expect(latest?.status).toBe('done'));
    act(() => latest?.refresh());
    await waitFor(() => expect(discover).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(latest?.status).toBe('done'));
  });

  it('forgets every kept list on sign-out', async () => {
    saveDiscovery({
      login: 'someone-else',
      spaces: [remote('x/y')],
      lost: [],
      warnings: [],
      complete: true,
      checkedAt: 'x',
    });
    const discover = vi.fn<Discover>(async () => result([remote('ann/notes')]));
    renderWith(fakeAuth('octocat'), discover);
    await waitFor(() => expect(latest?.status).toBe('done'));
    await act(async () => signOut?.());
    expect(screen.getByTestId('status').textContent).toBe('none');
    expect(loadDiscovery('octocat')).toBeNull();
    expect(loadDiscovery('someone-else')).toBeNull();
  });
});

describe('useDiscoveredSpaces with several auths (REQ-AUTH-020)', () => {
  beforeEach(() => {
    localStorage.clear();
    latest = null;
  });

  it('searches each account once and lists a shared space once with every auth that reads it', async () => {
    const discover = vi.fn<Discover>(async (options) =>
      options.token === 'token-a'
        ? result([remote('ann/shared'), remote('ann/only-a')])
        : result([remote('ann/shared'), remote('org/only-b')]),
    );
    renderWith(
      fakeAuths([
        { id: 'a', login: 'alice' },
        { id: 'b', login: 'bob' },
      ]),
      discover,
    );
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(discover).toHaveBeenCalledTimes(2);
    const ids = latest?.snapshot?.spaces.map(discoveredSpaceId);
    expect(ids).toEqual([
      'github.com/ann/shared@main',
      'github.com/ann/only-a@main',
      'github.com/org/only-b@main',
    ]);
    expect(latest?.reachedBy['github.com/ann/shared@main']).toEqual(['a', 'b']);
    expect(latest?.reachedBy['github.com/ann/only-a@main']).toEqual(['a']);
    expect(latest?.reachedBy['github.com/org/only-b@main']).toEqual(['b']);
  });

  it('searches an account once when two tokens sign in as it', async () => {
    const discover = vi.fn<Discover>(async () => result([remote('ann/notes')]));
    renderWith(
      fakeAuths([
        { id: 'a', login: 'alice' },
        { id: 'a2', login: 'Alice' },
      ]),
      discover,
    );
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(discover).toHaveBeenCalledTimes(1);
    expect(latest?.reachedBy['github.com/ann/notes@main']).toEqual(['a', 'a2']);
  });

  it('does not flag a space as lost while another account still reads it', async () => {
    const gone = remote('ann/shared');
    const discover = vi.fn<Discover>(async (options) =>
      options.token === 'token-a'
        ? result([], { lost: [{ space: gone, reason: 'access' }] })
        : result([gone]),
    );
    renderWith(
      fakeAuths([
        { id: 'a', login: 'alice' },
        { id: 'b', login: 'bob' },
      ]),
      discover,
    );
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(latest?.snapshot?.lost).toEqual([]);
    expect(latest?.snapshot?.spaces).toHaveLength(1);
  });

  it('notes a warning once when several accounts hit the same one', async () => {
    const limited = { kind: 'rate-limited', message: 'rate limit' } as const;
    const secret = { kind: 'access', repo: 'org/secret', message: 'org/secret could not be read' };
    const discover = vi.fn<Discover>(async (options) =>
      options.token === 'token-a'
        ? result([], { warnings: [limited, secret] })
        : result([], { warnings: [limited] }),
    );
    renderWith(
      fakeAuths([
        { id: 'a', login: 'alice' },
        { id: 'b', login: 'bob' },
      ]),
      discover,
    );
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(latest?.snapshot?.warnings).toEqual([limited, secret]);
  });

  it("keeps the other account's spaces and names the account that failed", async () => {
    const discover = vi.fn<Discover>(async (options) => {
      if (options.token === 'token-b') throw new Error('GitHub rejected the token');
      return result([remote('ann/notes')]);
    });
    renderWith(
      fakeAuths([
        { id: 'a', login: 'alice' },
        { id: 'b', login: 'bob' },
      ]),
      discover,
    );
    await waitFor(() => expect(latest?.status).toBe('done'));
    expect(latest?.error).toBe('@bob: GitHub rejected the token');
    expect(latest?.snapshot?.spaces).toHaveLength(1);
  });
});

describe('discovery helpers', () => {
  beforeEach(() => localStorage.clear());

  it('ignores a kept list it cannot read', () => {
    localStorage.setItem('cept-discovered-spaces:octocat', '{not json');
    expect(loadDiscovery('octocat')).toBeNull();
    localStorage.setItem('cept-discovered-spaces:octocat', '{"spaces":3}');
    expect(loadDiscovery('octocat')).toBeNull();
  });

  it('dedupes previous spaces by id', () => {
    const a = remote('ann/a');
    expect(
      previousSpaces({
        login: 'o',
        spaces: [a],
        lost: [{ space: a, reason: 'access' }],
        warnings: [],
        complete: true,
        checkedAt: '',
      }),
    ).toEqual([a]);
    expect(previousSpaces(null)).toEqual([]);
  });

  it('only clears discovery lists', () => {
    localStorage.setItem('cept-settings', '{}');
    localStorage.setItem('cept-discovered-spaces:a', '{}');
    clearDiscoveries();
    expect(localStorage.getItem('cept-settings')).toBe('{}');
    expect(localStorage.getItem('cept-discovered-spaces:a')).toBeNull();
  });
});
