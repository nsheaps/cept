import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  PublishSpaceDialog,
  createRepoErrorMessage,
  isValidRepoName,
} from './PublishSpaceDialog.js';

describe('createRepoErrorMessage', () => {
  it('names the permission a token lacks when GitHub refuses', () => {
    const refused = Object.assign(new Error('GitHub API error 403.'), { status: 403 });
    expect(createRepoErrorMessage(refused)).toContain('"repo" scope');
    expect(createRepoErrorMessage(refused)).toContain('"Administration"');
  });

  it('asks to sign in again when GitHub does not know the sign-in', () => {
    expect(createRepoErrorMessage({ status: 404 })).toContain('Sign in again');
  });

  it('explains a name GitHub would not take, and passes other errors on', () => {
    expect(createRepoErrorMessage({ status: 422 })).toContain('Pick another name');
    expect(createRepoErrorMessage(new Error('offline'))).toBe('offline');
  });
});

describe('isValidRepoName', () => {
  it('accepts the characters GitHub allows', () => {
    expect(isValidRepoName('my-notes_2.0')).toBe(true);
    expect(isValidRepoName('my notes')).toBe(false);
    expect(isValidRepoName('..')).toBe(false);
    expect(isValidRepoName('.notes')).toBe(false);
    expect(isValidRepoName('-notes')).toBe(false);
    expect(isValidRepoName('_notes')).toBe(true);
    expect(isValidRepoName('')).toBe(false);
  });
});

describe('PublishSpaceDialog', () => {
  it('suggests a repository name from the space and publishes it private by default', async () => {
    const onPublish = vi.fn(async () => undefined);
    render(
      <PublishSpaceDialog
        spaceName="My Notes"
        login="octo"
        onPublish={onPublish}
        onClose={() => undefined}
      />,
    );
    expect((screen.getByTestId('publish-space-repo') as HTMLInputElement).value).toBe('my-notes');
    fireEvent.change(screen.getByTestId('publish-space-description'), {
      target: { value: 'Mine' },
    });
    fireEvent.click(screen.getByTestId('publish-space-confirm'));
    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith({
        repoName: 'my-notes',
        description: 'Mine',
        private: true,
      }),
    );
  });

  it('will not publish under an invalid name', () => {
    const onPublish = vi.fn(async () => undefined);
    render(
      <PublishSpaceDialog
        spaceName="X"
        login="octo"
        onPublish={onPublish}
        onClose={() => undefined}
      />,
    );
    fireEvent.change(screen.getByTestId('publish-space-repo'), { target: { value: 'a b' } });
    expect(screen.getByTestId('publish-space-repo-invalid')).toBeTruthy();
    expect((screen.getByTestId('publish-space-confirm') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows why publishing failed and lets the user try again', async () => {
    const onPublish = vi.fn(async () => {
      throw new Error('Your GitHub token cannot create repositories.');
    });
    render(
      <PublishSpaceDialog
        spaceName="X"
        login="octo"
        onPublish={onPublish}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId('publish-space-private'));
    fireEvent.click(screen.getByTestId('publish-space-confirm'));
    expect((await screen.findByTestId('publish-space-error')).textContent).toContain(
      'cannot create repositories',
    );
    expect(onPublish).toHaveBeenCalledWith({ repoName: 'x', private: false });
    expect((screen.getByTestId('publish-space-confirm') as HTMLButtonElement).disabled).toBe(false);
  });
});
