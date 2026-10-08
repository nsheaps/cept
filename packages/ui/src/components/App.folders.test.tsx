/**
 * App tests for folder spaces (REQ-WS-012, REQ-WEB-023, REQ-WS-019): the
 * "Open folder" entry points, the choice shown for a folder that is not a
 * space, reconnecting a folder after a reload, and that opening a folder
 * writes nothing to it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { FolderHandleStore, StorageBackend } from '@cept/core';
import { App } from './App.js';
import { StorageProvider } from './storage/StorageContext.js';
import { FolderHostProvider } from './storage/folder-host.js';
import type { FolderHost } from './storage/folder-host.js';
import { MemoryBackend } from './storage/test-helpers.js';

/** Records each call that would change a backend, passing every call through. */
function writeSpy(inner: StorageBackend): { backend: StorageBackend; writes: string[] } {
  const writes: string[] = [];
  const backend: StorageBackend = {
    type: inner.type,
    capabilities: inner.capabilities,
    readFile: (p) => inner.readFile(p),
    listDirectory: (p) => inner.listDirectory(p),
    exists: (p) => inner.exists(p),
    stat: (p) => inner.stat(p),
    watch: (p, cb) => inner.watch(p, cb),
    writeFile: (p, d) => {
      writes.push(`writeFile ${p}`);
      return inner.writeFile(p, d);
    },
    deleteFile: (p) => {
      writes.push(`deleteFile ${p}`);
      return inner.deleteFile(p);
    },
    initialize: (c) => {
      writes.push('initialize');
      return inner.initialize(c);
    },
    close: () => inner.close(),
  };
  return { backend, writes };
}

/** A directory handle whose permission is `permission` until it is asked for again. */
function folderHandle(name: string, permission: PermissionState = 'granted') {
  const state = { permission };
  return {
    kind: 'directory',
    name,
    isSameEntry: async (other: { name: string }) => other.name === name,
    queryPermission: async () => state.permission,
    requestPermission: async () => {
      state.permission = 'granted';
      return state.permission;
    },
  } as unknown as FileSystemDirectoryHandle;
}

function memoryStore(): FolderHandleStore {
  const map = new Map<string, FileSystemDirectoryHandle>();
  return {
    save: async (id, handle) => void map.set(id, handle),
    load: async (id) => map.get(id) ?? null,
    list: async () => [...map].map(([id, handle]) => ({ id, handle })),
    remove: async (id) => void map.delete(id),
  };
}

/** A FolderHost over in-memory folders; `pick` returns `next.handle`. */
function fakeHost(folders: Map<string, StorageBackend>, handles = memoryStore()) {
  const next: { handle: FileSystemDirectoryHandle | null } = { handle: null };
  const host: FolderHost = {
    pick: async () => next.handle,
    open: (handle) => {
      const folder = folders.get(handle.name);
      if (!folder) throw new Error(`no folder ${handle.name}`);
      return folder;
    },
    handles,
  };
  return { host, next };
}

function renderApp(app: MemoryBackend, host: FolderHost | null) {
  return render(
    <StorageProvider backend={app}>
      <FolderHostProvider host={host}>
        <App />
      </FolderHostProvider>
    </StorageProvider>,
  );
}

function notesFolder() {
  const folder = new MemoryBackend();
  folder.seedText('space.cept.yaml', 'version: 1\nname: Notes\nslug: notes\n');
  folder.seedText('Welcome.md', '# Welcome\n\nHello from a folder.\n');
  folder.seedText('Guides/Setup.md', '# Setup\n');
  return folder;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 600));

describe('App folder spaces', () => {
  beforeEach(() => {
    // Each test starts at the app root, not at the previous test's space.
    window.history.replaceState(null, '', '/');
  });

  it('offers no "Open folder" without a folder host', async () => {
    renderApp(new MemoryBackend(), null);
    const button = await screen.findByTestId('landing-open-folder');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens a folder that is a space from the landing page, writing nothing to it', async () => {
    const app = new MemoryBackend();
    const { backend, writes } = writeSpy(notesFolder());
    const { host, next } = fakeHost(new Map([['notes', backend]]));
    next.handle = folderHandle('notes');
    renderApp(app, host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Guides').length).toBeGreaterThan(0);
    await settle(); // autosave runs

    expect(writes).toEqual([]);
    const manifest = JSON.parse(app.readText('.cept/spaces.json')!) as {
      spaces: { id: string; name: string; backend?: string }[];
      activeSpaceId: string;
    };
    const space = manifest.spaces.find((s) => s.backend === 'folder');
    expect(space?.name).toBe('Notes');
    expect(manifest.activeSpaceId).toBe(space?.id);
    expect((await host.handles.list()).map((e) => e.id)).toEqual([space?.id]);
  });

  it('asks before making a plain folder a space, and then adds only its marker', async () => {
    const plain = new MemoryBackend();
    plain.seedText('todo.md', '# Todo\n');
    const { backend, writes } = writeSpy(plain);
    const { host, next } = fakeHost(new Map([['plain', backend]]));
    next.handle = folderHandle('plain');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    await screen.findByTestId('open-folder-dialog');
    expect(writes).toEqual([]);

    fireEvent.click(screen.getByTestId('open-folder-make-space'));
    expect((await screen.findAllByText('todo')).length).toBeGreaterThan(0);
    await settle();
    expect(writes).toEqual(['writeFile /space.cept.yaml']);
    expect(plain.readText('todo.md')).toBe('# Todo\n');
  });

  it('cancelling the choice writes nothing and opens nothing', async () => {
    const plain = new MemoryBackend();
    plain.seedText('todo.md', '# Todo\n');
    const { backend, writes } = writeSpy(plain);
    const { host, next } = fakeHost(new Map([['plain', backend]]));
    next.handle = folderHandle('plain');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    fireEvent.click(await screen.findByTestId('open-folder-cancel'));
    expect(screen.queryByTestId('open-folder-dialog')).toBeNull();
    expect(screen.getByTestId('landing-page')).toBeDefined();
    expect(writes).toEqual([]);
  });

  it('opens a space found in a subfolder', async () => {
    const repo = new MemoryBackend();
    repo.seedText('README.md', '# repo\n');
    repo.seedText('docs/space.cept.yaml', 'version: 1\nname: Docs\nslug: docs\n');
    repo.seedText('docs/Intro.md', '# Intro\n');
    const { backend, writes } = writeSpy(repo);
    const { host, next } = fakeHost(new Map([['repo', backend]]));
    next.handle = folderHandle('repo');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    fireEvent.click(await screen.findByTestId('open-folder-space-docs'));
    expect((await screen.findAllByText('Intro')).length).toBeGreaterThan(0);
    expect(screen.queryByText('README')).toBeNull();
    await settle();
    expect(writes).toEqual([]);
  });

  it('after a reload, reopens the folder once the user reconnects it', async () => {
    const app = new MemoryBackend();
    const folder = notesFolder();
    const handles = memoryStore();
    const first = fakeHost(new Map([['notes', folder]]), handles);
    first.next.handle = folderHandle('notes');
    renderApp(app, first.host);
    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    await settle();
    cleanup();

    // A reload: the saved handle needs permission asked for again.
    const [{ id }] = await handles.list();
    await handles.save(id, folderHandle('notes', 'prompt'));
    const second = fakeHost(new Map([['notes', folder]]), handles);
    renderApp(app, second.host);

    fireEvent.click(await screen.findByTestId('folder-reconnect-btn'));
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('folder-reconnect')).toBeNull();
  });

  it('a link to a page of a folder space waits for the folder, then shows the page', async () => {
    const app = new MemoryBackend();
    const folder = notesFolder();
    const handles = memoryStore();
    const first = fakeHost(new Map([['notes', folder]]), handles);
    first.next.handle = folderHandle('notes');
    renderApp(app, first.host);
    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    const [item] = await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    fireEvent.click(item!);
    await screen.findByText('Hello from a folder.', {}, { timeout: 3000 });
    await settle();
    const link = window.location.pathname;
    cleanup();

    // Reload at the page's link, with the folder needing permission again.
    window.history.replaceState(null, '', link);
    const [{ id }] = await handles.list();
    await handles.save(id, folderHandle('notes', 'prompt'));
    renderApp(app, fakeHost(new Map([['notes', folder]]), handles).host);

    fireEvent.click(await screen.findByTestId('folder-reconnect-btn', {}, { timeout: 3000 }));
    expect(await screen.findByText('Hello from a folder.', {}, { timeout: 3000 })).toBeDefined();
    expect(screen.queryByText('Page not found')).toBeNull();
  });

  it('reopens a still-allowed folder after a reload without asking', async () => {
    const app = new MemoryBackend();
    const folder = notesFolder();
    const handles = memoryStore();
    const first = fakeHost(new Map([['notes', folder]]), handles);
    first.next.handle = folderHandle('notes');
    renderApp(app, first.host);
    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    await settle();
    cleanup();

    renderApp(app, fakeHost(new Map([['notes', folder]]), handles).host);
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('folder-reconnect')).toBeNull();
  });
});
