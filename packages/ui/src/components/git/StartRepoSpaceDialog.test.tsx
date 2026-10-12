import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { GitAuthRecord, RepoInfo } from '@cept/core';
import { StartRepoSpaceDialog, cleanFolder } from './StartRepoSpaceDialog.js';

const user = { login: 'octo', name: 'Octo', avatarUrl: 'https://avatars.example/octo' };

function repo(name: string): RepoInfo {
  return {
    name,
    fullName: `octo/${name}`,
    url: `https://github.com/octo/${name}`,
    httpsUrl: `https://github.com/octo/${name}.git`,
    sshUrl: `git@github.com:octo/${name}.git`,
    private: true,
    defaultBranch: 'main',
  };
}

describe('cleanFolder', () => {
  it('drops leading, trailing and doubled slashes', () => {
    expect(cleanFolder('/docs//notes/')).toBe('docs/notes');
    expect(cleanFolder('')).toBe('');
  });
});

describe('StartRepoSpaceDialog', () => {
  it('lists the account repositories, then starts a space in the picked one', async () => {
    const onStart = vi.fn(async () => undefined);
    render(
      <StartRepoSpaceDialog
        user={user}
        listRepos={async () => [repo('notes'), repo('wiki')]}
        onStart={onStart}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByTestId('repo-picker-item-octo/wiki'));
    expect((screen.getByTestId('start-repo-space-name') as HTMLInputElement).value).toBe('wiki');
    fireEvent.change(screen.getByTestId('start-repo-space-name'), {
      target: { value: 'Team wiki' },
    });
    fireEvent.change(screen.getByTestId('start-repo-space-folder'), {
      target: { value: '/docs/' },
    });
    fireEvent.click(screen.getByTestId('start-repo-space-confirm'));
    await waitFor(() =>
      expect(onStart).toHaveBeenCalledWith({
        repo: repo('wiki'),
        name: 'Team wiki',
        folder: 'docs',
      }),
    );
  });

  it('creates a repository and picks it', async () => {
    const createRepo = vi.fn(async (options: { name: string; private: boolean }) =>
      repo(options.name),
    );
    render(
      <StartRepoSpaceDialog
        user={user}
        listRepos={async () => []}
        createRepo={createRepo}
        onStart={async () => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByTestId('repo-picker-new'));
    fireEvent.change(screen.getByTestId('repo-picker-create-name'), {
      target: { value: 'journal' },
    });
    fireEvent.click(screen.getByTestId('repo-picker-create-submit'));
    await screen.findByTestId('start-repo-space-form');
    expect(createRepo).toHaveBeenCalledWith({ name: 'journal', private: true });
    expect((screen.getByTestId('start-repo-space-name') as HTMLInputElement).value).toBe('journal');
  });

  it('shows why a space could not be started and lets the user try again', async () => {
    const onStart = vi.fn(async () => {
      throw new Error('push rejected');
    });
    render(
      <StartRepoSpaceDialog
        user={user}
        listRepos={async () => [repo('notes')]}
        onStart={onStart}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByTestId('repo-picker-item-octo/notes'));
    fireEvent.click(screen.getByTestId('start-repo-space-confirm'));
    expect((await screen.findByTestId('start-repo-space-error')).textContent).toBe('push rejected');
    expect((screen.getByTestId('start-repo-space-confirm') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('shows when the repositories cannot be listed', async () => {
    render(
      <StartRepoSpaceDialog
        user={user}
        listRepos={async () => {
          throw new Error('offline');
        }}
        onStart={async () => undefined}
        onClose={() => undefined}
      />,
    );
    expect((await screen.findByTestId('repo-picker-error')).textContent).toMatch(/offline/);
  });

  it('asks a signed-out user to sign in', () => {
    const onSignIn = vi.fn();
    const listRepos = vi.fn(async () => []);
    render(
      <StartRepoSpaceDialog
        user={null}
        listRepos={listRepos}
        onStart={async () => undefined}
        onSignIn={onSignIn}
        onClose={() => undefined}
      />,
    );
    expect(listRepos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('repo-picker-signin'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});

function authRecord(id: string, login: string): GitAuthRecord {
  return {
    id,
    host: 'github.com',
    username: 'x-access-token',
    label: `@${login}`,
    status: 'ok',
    createdAt: '2026-01-01T00:00:00.000Z',
    account: { login, name: null, avatarUrl: '' },
    grants: { kind: 'classic', scopes: ['repo'] },
  };
}

describe('StartRepoSpaceDialog with several auths (REQ-AUTH-020)', () => {
  const auths = [authRecord('a', 'octo'), authRecord('b', 'hubot')];

  it("lists the chosen auth's repositories and starts the space with that auth", async () => {
    const listRepos = vi.fn(async (authId?: string) =>
      authId === 'b' ? [repo('bots')] : [repo('notes')],
    );
    const onStart = vi.fn(async () => undefined);
    render(
      <StartRepoSpaceDialog
        user={user}
        auths={auths}
        defaultAuthId="a"
        listRepos={listRepos}
        onStart={onStart}
        onClose={() => undefined}
      />,
    );
    await screen.findByTestId('repo-picker-item-octo/notes');
    expect(listRepos).toHaveBeenLastCalledWith('a');
    fireEvent.change(screen.getByTestId('start-repo-space-auth'), { target: { value: 'b' } });
    fireEvent.click(await screen.findByTestId('repo-picker-item-octo/bots'));
    expect(screen.queryByTestId('repo-picker-item-octo/notes')).toBeNull();
    fireEvent.click(screen.getByTestId('start-repo-space-confirm'));
    await waitFor(() =>
      expect(onStart).toHaveBeenCalledWith({
        repo: repo('bots'),
        name: 'bots',
        folder: '',
        authId: 'b',
      }),
    );
  });

  it('creates the repository with the chosen auth', async () => {
    const createRepo = vi.fn(async (options: { name: string }) => repo(options.name));
    render(
      <StartRepoSpaceDialog
        user={user}
        auths={auths}
        defaultAuthId="a"
        listRepos={async () => []}
        createRepo={createRepo}
        onStart={async () => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(await screen.findByTestId('start-repo-space-auth'), {
      target: { value: 'b' },
    });
    fireEvent.click(await screen.findByTestId('repo-picker-new'));
    fireEvent.change(screen.getByTestId('repo-picker-create-name'), {
      target: { value: 'journal' },
    });
    fireEvent.click(screen.getByTestId('repo-picker-create-submit'));
    await screen.findByTestId('start-repo-space-form');
    expect(createRepo).toHaveBeenCalledWith({ name: 'journal', private: true }, 'b');
  });

  it('shows no picker with a single auth, and still starts the space with it', async () => {
    const onStart = vi.fn(async () => undefined);
    render(
      <StartRepoSpaceDialog
        user={user}
        auths={[auths[0]!]}
        defaultAuthId="a"
        listRepos={async () => [repo('notes')]}
        onStart={onStart}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByTestId('repo-picker-item-octo/notes'));
    expect(screen.queryByTestId('start-repo-space-auth')).toBeNull();
    fireEvent.click(screen.getByTestId('start-repo-space-confirm'));
    await waitFor(() =>
      expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ authId: 'a' })),
    );
  });
});
