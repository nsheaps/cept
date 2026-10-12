import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GitAuthRegistry, MemoryAuthIndexStore, MemoryTokenStore } from '@cept/core';
import { AuthSection } from './AuthSection.js';
import { GitAuthsProvider } from './git-auths.js';
import { useGitHubAccount } from './github-account.js';

// Built at runtime so the secret scanner does not mistake them for real tokens.
const ALICE = ['github_pat_', 'aliceFake'].join('') + '0'.repeat(30);
const BOB = ['ghp_', 'bobFake'].join('') + '0'.repeat(30);
const GITLAB = ['glpat-', 'gitlabFake'].join('') + '0'.repeat(20);

const USERS: Record<string, { login: string; name: string }> = {
  [ALICE]: { login: 'alice', name: 'Alice A' },
  [BOB]: { login: 'bob', name: 'Bob B' },
};

/** A GitHub that knows {@link USERS} and rejects every other token. */
function fakeGitHub(revoked: ReadonlySet<string> = new Set()): typeof fetch {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const token = (new Headers(init?.headers).get('Authorization') ?? '').replace('Bearer ', '');
    const user = USERS[token];
    if (!user || revoked.has(token))
      return new Response('{"message":"Bad credentials"}', { status: 401 });
    return new Response(
      JSON.stringify({ login: user.login, name: user.name, avatar_url: `https://a/${user.login}` }),
      {
        status: 200,
        headers: {
          'X-OAuth-Scopes': token.startsWith('ghp_') ? 'repo, read:org' : '',
        },
      },
    );
  }) as unknown as typeof fetch;
}

function stores() {
  return { tokenStore: new MemoryTokenStore(), indexStore: new MemoryAuthIndexStore() };
}

function registry(s = stores(), fetch = fakeGitHub()) {
  let n = 0;
  return new GitAuthRegistry({ ...s, fetch, newId: () => `id${++n}` });
}

function renderSection(auths: GitAuthRegistry | null) {
  return render(
    <GitAuthsProvider auths={auths}>
      <AuthSection />
    </GitAuthsProvider>,
  );
}

async function addToken(token: string, extra: { host?: string; username?: string } = {}) {
  if (extra.host !== undefined)
    fireEvent.change(await screen.findByTestId('auth-host-input'), {
      target: { value: extra.host },
    });
  if (extra.username !== undefined)
    fireEvent.change(await screen.findByTestId('auth-username-input'), {
      target: { value: extra.username },
    });
  fireEvent.change(await screen.findByTestId('auth-token-input'), { target: { value: token } });
  fireEvent.click(screen.getByTestId('auth-add-btn'));
}

describe('AuthSection', () => {
  it('renders nothing when the host offers no git sign-in', () => {
    renderSection(null);
    expect(screen.queryByTestId('auth-section')).toBeNull();
  });

  it('starts empty and explains how to add a token', async () => {
    renderSection(registry());
    expect(await screen.findByTestId('auth-empty')).toBeTruthy();
    expect(screen.queryByTestId('auth-list')).toBeNull();
  });

  describe('the link that creates a token', () => {
    it('is a visible link that opens GitHub with Cept’s permissions filled in', async () => {
      renderSection(registry());
      const link = (await screen.findByTestId('auth-new-token-link')) as HTMLAnchorElement;
      const url = new URL(link.href);
      expect(url.origin + url.pathname).toBe(
        'https://github.com/settings/personal-access-tokens/new',
      );
      expect(url.searchParams.get('contents')).toBe('write');
      expect(url.searchParams.get('administration')).toBeNull();
      expect(url.searchParams.get('name')).toBe('Cept');
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noreferrer');
      expect(link.className).toContain('cept-settings-link');
    });

    it('asks for repository administration only when creating repositories is wanted', async () => {
      renderSection(registry());
      fireEvent.click(await screen.findByTestId('auth-create-repos'));
      const link = screen.getByTestId('auth-new-token-link') as HTMLAnchorElement;
      expect(new URL(link.href).searchParams.get('administration')).toBe('write');
    });

    it('is not shown for another host', async () => {
      renderSection(registry());
      fireEvent.change(await screen.findByTestId('auth-host-input'), {
        target: { value: 'gitlab.com' },
      });
      expect(screen.queryByTestId('auth-new-token-link')).toBeNull();
    });
  });

  it('adds a GitHub token and shows the account it signs in as', async () => {
    renderSection(registry());
    await addToken(`  ${BOB} `);

    const item = await screen.findByTestId('auth-item-id1');
    expect(item.textContent).toContain('github.com · Bob B (@bob)');
    expect(item.textContent).toContain('Classic token · repo, read:org');
    expect(screen.getByTestId('auth-avatar').getAttribute('src')).toBe('https://a/bob');
    expect((screen.getByTestId('auth-token-input') as HTMLInputElement).value).toBe('');
    expect(document.body.textContent).not.toContain(BOB);
  });

  it('keeps several auths, one per account', async () => {
    renderSection(registry());
    await addToken(ALICE);
    await screen.findByTestId('auth-item-id1');
    await addToken(BOB);
    await screen.findByTestId('auth-item-id2');
    expect(screen.getByTestId('auth-list').querySelectorAll('li')).toHaveLength(2);
  });

  it('says why a token was refused and saves nothing', async () => {
    const s = stores();
    renderSection(registry(s));
    await addToken('ghp_not_a_real_token');

    expect((await screen.findByTestId('auth-error')).textContent).toMatch(/GitHub/i);
    expect(screen.queryByTestId('auth-list')).toBeNull();
    expect(await s.indexStore.load()).toEqual([]);
  });

  it('adds a token for another git host with its username', async () => {
    renderSection(registry());
    await addToken(GITLAB, { host: 'https://gitlab.com/', username: 'alice' });

    const item = await screen.findByTestId('auth-item-id1');
    expect(item.textContent).toContain('gitlab.com · alice');
    expect(item.textContent).toContain('Cept cannot check tokens for this host');
  });

  it('needs a username for another host before it can add', async () => {
    renderSection(registry());
    fireEvent.change(await screen.findByTestId('auth-host-input'), {
      target: { value: 'gitlab.com' },
    });
    fireEvent.change(screen.getByTestId('auth-token-input'), { target: { value: GITLAB } });
    expect((screen.getByTestId('auth-add-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('auth-username-input'), { target: { value: 'alice' } });
    expect((screen.getByTestId('auth-add-btn') as HTMLButtonElement).disabled).toBe(false);
  });

  it('removes one auth and keeps the others', async () => {
    renderSection(registry());
    await addToken(ALICE);
    await screen.findByTestId('auth-item-id1');
    await addToken(BOB);
    await screen.findByTestId('auth-item-id2');

    fireEvent.click(within('auth-item-id1', 'auth-remove'));
    await waitFor(() => expect(screen.queryByTestId('auth-item-id1')).toBeNull());
    expect(screen.getByTestId('auth-item-id2')).toBeTruthy();
  });

  it('renames an auth', async () => {
    renderSection(registry());
    await addToken(ALICE);
    await screen.findByTestId('auth-item-id1');

    fireEvent.click(within('auth-item-id1', 'auth-rename'));
    fireEvent.change(screen.getByTestId('auth-rename-input'), { target: { value: 'Work' } });
    fireEvent.click(screen.getByTestId('auth-rename-save'));

    await waitFor(() => expect(screen.getByTestId('auth-label').textContent).toBe('Work'));
  });

  it('trims the new name, and Cancel or Escape leaves the old one', async () => {
    renderSection(registry());
    await addToken(ALICE);
    await screen.findByTestId('auth-item-id1');
    const oldLabel = screen.getByTestId('auth-label').textContent;

    fireEvent.click(within('auth-item-id1', 'auth-rename'));
    fireEvent.change(screen.getByTestId('auth-rename-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('auth-rename-cancel'));
    expect(screen.getByTestId('auth-label').textContent).toBe(oldLabel);

    fireEvent.click(within('auth-item-id1', 'auth-rename'));
    fireEvent.keyDown(screen.getByTestId('auth-rename-input'), { key: 'Escape' });
    expect(screen.getByTestId('auth-label').textContent).toBe(oldLabel);

    fireEvent.click(within('auth-item-id1', 'auth-rename'));
    fireEvent.change(screen.getByTestId('auth-rename-input'), { target: { value: '  Work  ' } });
    fireEvent.click(screen.getByTestId('auth-rename-save'));
    await waitFor(() => expect(screen.getByTestId('auth-label').textContent).toBe('Work'));
  });

  it('forgets the repository-creation choice after an add', async () => {
    renderSection(registry());
    const box = (await screen.findByTestId('auth-create-repos')) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
    await addToken(ALICE);
    await screen.findByTestId('auth-item-id1');
    expect((screen.getByTestId('auth-create-repos') as HTMLInputElement).checked).toBe(false);
  });

  it('explains a host it cannot read', async () => {
    renderSection(registry());
    expect(screen.queryByTestId('auth-host-hint')).toBeNull();
    fireEvent.change(await screen.findByTestId('auth-host-input'), {
      target: { value: 'https:/github.com' },
    });
    expect(screen.getByTestId('auth-host-hint').textContent).toContain('github.com');
    fireEvent.change(screen.getByTestId('auth-host-input'), { target: { value: 'github.com' } });
    expect(screen.queryByTestId('auth-host-hint')).toBeNull();
  });

  it('keeps a token added while the startup check is still running', async () => {
    const s = stores();
    await registry(s).add({ token: ALICE });
    // The first request (the startup check of ALICE) waits until released.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const inner = fakeGitHub();
    let first = true;
    const slow = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (first) {
        first = false;
        await gate;
      }
      return inner(url, init);
    }) as unknown as typeof fetch;
    let n = 100;
    renderSection(new GitAuthRegistry({ ...s, fetch: slow, newId: () => `id${++n}` }));

    await addToken(BOB);
    release();
    await screen.findByTestId('auth-item-id101');
    await waitFor(() =>
      expect(screen.getByTestId('auth-list').querySelectorAll('li')).toHaveLength(2),
    );
  });

  it('asks for a new token when GitHub rejects a saved one, and takes it', async () => {
    const s = stores();
    await registry(s).add({ token: ALICE });
    // Next start: the old token has been revoked.
    renderSection(registry(s, fakeGitHub(new Set([ALICE]))));

    const rejected = await screen.findByTestId('auth-rejected');
    expect(rejected.textContent).toContain('no longer accepts this token');

    // The same account with a new token.
    USERS[BOB] = { login: 'alice', name: 'Alice A' };
    try {
      fireEvent.change(screen.getByTestId('auth-replace-input'), { target: { value: BOB } });
      fireEvent.click(screen.getByTestId('auth-replace-btn'));
      await waitFor(() => expect(screen.queryByTestId('auth-rejected')).toBeNull());
    } finally {
      USERS[BOB] = { login: 'bob', name: 'Bob B' };
    }
  });

  it('notes that a token could not be checked while the host was unreachable', async () => {
    const s = stores();
    await registry(s).add({ token: ALICE });
    const offline = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    renderSection(registry(s, offline));
    expect((await screen.findByTestId('auth-unverified')).textContent).toContain('checked again');
  });

  it('still tells the rest of the app which GitHub account is the default', async () => {
    let login: string | undefined;
    function Probe() {
      login = useGitHubAccount()?.account?.login;
      return null;
    }
    const s = stores();
    await registry(s).add({ token: BOB });
    render(
      <GitAuthsProvider auths={registry(s)}>
        <Probe />
      </GitAuthsProvider>,
    );
    await waitFor(() => expect(login).toBe('bob'));
  });
});

/** The button `testid` inside the auth item `item`. */
function within(item: string, testid: string): HTMLElement {
  const button = screen.getByTestId(item).querySelector(`[data-testid="${testid}"]`);
  if (!(button instanceof HTMLElement)) throw new Error(`${testid} not in ${item}`);
  return button;
}
