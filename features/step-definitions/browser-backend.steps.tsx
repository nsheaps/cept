import 'fake-indexeddb/auto';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import type { Editor } from '@tiptap/core';
import { expect } from 'vitest';
import { BrowserFsBackend } from '@cept/core';
import { App, StorageProvider } from '@cept/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const feature = await loadFeature('features/storage/browser-backend.feature');

/** A fresh IndexedDB database per scenario, standing in for the browser profile's storage. */
let dbName = '';
let session: BrowserFsBackend | null = null;

/** Open the app the way a browser tab does: on whatever the database holds. */
function openApp(): BrowserFsBackend {
  const backend = new BrowserFsBackend(dbName);
  session = backend;
  window.history.replaceState({}, '', '/');
  render(
    <StorageProvider backend={backend}>
      <App />
    </StorageProvider>,
  );
  return backend;
}

/** Close the tab: unmount, and let go of the connection to the database. */
async function closeTab(): Promise<void> {
  cleanup();
  await session?.close();
  session = null;
}

/** Read from the database with a connection of its own, as a reloaded tab would. */
async function stored(path: string): Promise<string | null> {
  const reader = new BrowserFsBackend(dbName);
  try {
    const data = await reader.readFile(path);
    return data ? new TextDecoder().decode(data) : null;
  } finally {
    await reader.close();
  }
}

const editorOf = async (): Promise<Editor> => {
  const dom = await waitFor(() => {
    const el = screen
      .getByTestId('cept-editor')
      .querySelector<HTMLElement & { editor?: Editor }>('.tiptap');
    if (!el?.editor) throw new Error('editor not ready');
    return el as HTMLElement & { editor: Editor };
  });
  return dom.editor;
};

const startWriting = async () => {
  fireEvent.click(await screen.findByTestId('start-writing'));
  await waitFor(() => expect(screen.queryByTestId('landing-page')).toBeNull());
};

describeFeature(feature, ({ Scenario, BeforeEachScenario, AfterEachScenario }) => {
  BeforeEachScenario(() => {
    dbName = `cept-feature-${Math.random().toString(36).slice(2)}`;
    localStorage.clear();
  });

  AfterEachScenario(() => closeTab());

  Scenario('Create workspace with browser backend', ({ Given, When, Then, And }) => {
    Given('I open the Cept web app', async () => {
      openApp();
      expect(await screen.findByTestId('landing-page')).toBeTruthy();
    });

    When('I click "Start writing"', startWriting);

    Then('a workspace should be created using IndexedDB', async () => {
      expect(session?.type).toBe('browser');
      // The space marker and its first page are in the database, not just in memory.
      await waitFor(
        async () => {
          expect(await stored('space.cept.yaml')).not.toBeNull();
          expect(await stored('Welcome.md')).not.toBeNull();
        },
        { timeout: 5000 },
      );
    });

    And('I should see the editor with a blank page', async () => {
      // A new page opens ready to type: the editor holds only the one-line prompt.
      const editor = await editorOf();
      expect(editor.getText().trim()).toBe('Start typing here...');
    });
  });

  Scenario('Data persists across page reloads', ({ Given, When, Then }) => {
    Given('I have a workspace with a page containing "Hello World"', async () => {
      openApp();
      await startWriting();
      const editor = await editorOf();
      editor.commands.setContent('Hello World');
      // Saved by the app's own autosave, not written by the test.
      await waitFor(async () => expect(await stored('Welcome.md')).toContain('Hello World'), {
        timeout: 5000,
      });
    });

    When('I reload the browser', async () => {
      await closeTab();
      openApp();
    });

    Then('I should see the page with "Hello World"', async () => {
      // No landing page this time: the app finds the space in IndexedDB and reopens it.
      await waitFor(async () => expect((await editorOf()).getText()).toContain('Hello World'), {
        timeout: 5000,
      });
      expect(screen.queryByTestId('landing-page')).toBeNull();
    });
  });

  Scenario('Browser backend reports correct capabilities', ({ Given, Then, And }) => {
    let backend: BrowserFsBackend;

    Given('I have a browser-backed workspace', () => {
      backend = new BrowserFsBackend(dbName);
      session = backend;
      expect(backend.type).toBe('browser');
    });

    Then('the backend should report no history capability', () => {
      expect(backend.capabilities.history).toBe(false);
    });

    And('the backend should report no collaboration capability', () => {
      expect(backend.capabilities.collaboration).toBe(false);
    });

    And('the backend should report no sync capability', () => {
      expect(backend.capabilities.sync).toBe(false);
    });
  });
});
