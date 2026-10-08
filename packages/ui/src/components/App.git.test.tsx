/**
 * App tests for writable GitHub spaces (REQ-WS-027) without an editing
 * session: the pages are read from the space's kept clone, the space is shown
 * as read-only until the user signs in, and nothing is written to the clone.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App.js';
import { StorageProvider } from './storage/StorageContext.js';
import { MemoryBackend } from './storage/test-helpers.js';
import { generateRemoteSpaceId } from './storage/SpaceManager.js';
import { cloneSpaceRoot } from './storage/git-space.js';

const URL = 'https://github.com/octo/notes';
const ID = generateRemoteSpaceId(URL, 'main');

async function appWithGitSpace(readOnly: boolean) {
  const app = new MemoryBackend();
  app.seedText(
    '.cept/spaces.json',
    JSON.stringify({
      activeSpaceId: ID,
      spaces: [
        { id: 'default', name: 'My Space', createdAt: '2026-01-01T00:00:00Z' },
        {
          id: ID,
          name: 'Notes',
          createdAt: '2026-01-01T00:00:00Z',
          remoteUrl: URL,
          branch: 'main',
          access: 'token',
          readOnly,
        },
      ],
    }),
  );
  const write = (file: string, text: string) =>
    app.writeFile(`${cloneSpaceRoot(ID)}/${file}`, new TextEncoder().encode(text));
  await write('space.cept.yaml', 'version: 1\nname: Notes\n');
  await write('Hello.md', '# Hello\n\nFrom GitHub.\n');
  return app;
}

describe('App writable GitHub spaces (REQ-WS-027)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('shows the clone pages read-only and asks to sign in while signed out', async () => {
    const app = await appWithGitSpace(false);
    render(
      <StorageProvider backend={app}>
        <App />
      </StorageProvider>,
    );
    expect((await screen.findAllByText('Hello', {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect((await screen.findByTestId('sync-state')).textContent).toMatch(/sign in to edit/);
    expect(screen.queryByTestId('sync-now')).toBeNull();

    fireEvent.click(screen.getAllByText('Hello')[0]);
    const editor = await screen.findByTestId('cept-editor', {}, { timeout: 3000 });
    expect(editor.querySelector('[contenteditable="true"]')).toBeNull();
  });

  it('shows no sync indicator for a read-only GitHub space', async () => {
    const app = await appWithGitSpace(true);
    app.seedText(
      `.cept/spaces/${ID}/workspace-state.json`,
      JSON.stringify({
        pages: [{ id: 'page-1', title: 'Copied page', children: [] }],
        favorites: [],
        recentPages: [],
        selectedPageId: 'page-1',
        spaceName: 'Notes',
      }),
    );
    render(
      <StorageProvider backend={app}>
        <App />
      </StorageProvider>,
    );
    expect(
      (await screen.findAllByText('Copied page', {}, { timeout: 3000 })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId('sync-indicator')).toBeNull();
  });
});
