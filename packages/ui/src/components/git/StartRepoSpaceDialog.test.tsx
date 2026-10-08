import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { RepoInfo } from '@cept/core';
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
