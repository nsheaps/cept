import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type {
  AutodiscoveryOptions,
  AutodiscoveryResult,
  PatAccount,
  RemoteSpace,
} from '@cept/core';
import { GitHubAccountProvider, useGitHubAccount } from './github-account.js';
import type { PatAuth } from './github-account.js';
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

function account(login: string): PatAccount {
  return {
    login,
    name: null,
    avatarUrl: '',
    grants: { kind: 'classic', scopes: ['repo'] },
  } as unknown as PatAccount;
}

/** A host auth whose saved token signs in as `login` (null: nothing saved). */
function fakeAuth(login: string | null): PatAuth {
  let saved = login;
  return {
    signIn: async () => account('someone'),
    restore: async () => (saved ? account(saved) : null),
    logout: async () => {
      saved = null;
    },
    getHttpAuth: async () => {
      if (!saved) throw new Error('none');
      return { username: 'x-access-token', password: TOKEN };
    },
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

function renderWith(auth: PatAuth | null, discover: Discover) {
  return render(
    <GitHubAccountProvider auth={auth}>
      <Probe discover={discover} />
    </GitHubAccountProvider>,
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
