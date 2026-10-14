/**
 * App tests for folder spaces (REQ-WS-012, REQ-WEB-023, REQ-WS-019): the
 * "Open folder" entry points, the choice shown for a folder that is not a
 * space, reconnecting a folder after a reload, and that opening a folder
 * writes nothing to it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, createEvent } from '@testing-library/react';
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

/**
 * A directory handle whose permission is `permission` until it is asked for
 * again, when the user answers `answer`.
 */
function folderHandle(
  name: string,
  permission: PermissionState = 'granted',
  answer: PermissionState = 'granted',
) {
  const state = { permission };
  return {
    kind: 'directory',
    name,
    isSameEntry: async (other: { name: string }) => other.name === name,
    queryPermission: async () => state.permission,
    requestPermission: async () => {
      state.permission = answer;
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

  describe('renaming a page that other pages link to', () => {
    async function openLinked(action: 'ctx-rename' | 'move-to-root' = 'ctx-rename') {
      const folder = notesFolder();
      folder.seedText('Welcome.md', 'See [setup](Guides/Setup.md#top).\n');
      const { host, next } = fakeHost(new Map([['notes', folder]]));
      next.handle = folderHandle('notes');
      renderApp(new MemoryBackend(), host);
      fireEvent.click(await screen.findByTestId('landing-open-folder'));
      fireEvent.click(await screen.findByTestId('page-tree-toggle-Guides', {}, { timeout: 3000 }));
      fireEvent.contextMenu(await screen.findByTestId('page-tree-button-Guides/Setup.md'));
      if (action === 'move-to-root') {
        fireEvent.click(await screen.findByTestId('ctx-move-to'));
        fireEvent.click(await screen.findByTestId('move-target-root'));
      } else fireEvent.click(await screen.findByTestId(action));
      if (action === 'ctx-rename') {
        const input = await screen.findByTestId('rename-input');
        fireEvent.change(input, { target: { value: 'Install' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      }
      return folder;
    }

    it('shows the pages to update and rewrites their links when accepted', async () => {
      const folder = await openLinked();
      expect((await screen.findByTestId('link-rewrite-pages')).textContent).toContain('Welcome.md');
      fireEvent.click(screen.getByTestId('link-rewrite-update'));
      await screen.findByTestId('page-tree-button-Guides/Install.md', {}, { timeout: 3000 });
      expect(folder.readText('Welcome.md')).toBe('See [setup](Guides/Install.md#top).\n');
    });

    it('leaves the links alone when the user moves without updating', async () => {
      const folder = await openLinked();
      await screen.findByTestId('link-rewrite-dialog');
      fireEvent.click(screen.getByTestId('link-rewrite-skip'));
      await screen.findByTestId('page-tree-button-Guides/Install.md', {}, { timeout: 3000 });
      expect(folder.readText('Welcome.md')).toBe('See [setup](Guides/Setup.md#top).\n');
    });

    describe('moving the page to the root', () => {
      it('rewrites the links when accepted', async () => {
        const folder = await openLinked('move-to-root');
        fireEvent.click(await screen.findByTestId('link-rewrite-update'));
        await screen.findByTestId('page-tree-button-Setup.md', {}, { timeout: 3000 });
        expect(folder.readText('Welcome.md')).toBe('See [setup](Setup.md#top).\n');
      });

      it('leaves the links alone when the user moves without updating', async () => {
        const folder = await openLinked('move-to-root');
        fireEvent.click(await screen.findByTestId('link-rewrite-skip'));
        await screen.findByTestId('page-tree-button-Setup.md', {}, { timeout: 3000 });
        expect(folder.readText('Welcome.md')).toBe('See [setup](Guides/Setup.md#top).\n');
      });

      it('changes nothing when the user cancels', async () => {
        const folder = await openLinked('move-to-root');
        fireEvent.click(await screen.findByTestId('link-rewrite-cancel'));
        await settle();
        expect(folder.hasFile('Guides/Setup.md')).toBe(true);
        expect(folder.readText('Welcome.md')).toBe('See [setup](Guides/Setup.md#top).\n');
      });
    });

    it('changes nothing when the user cancels', async () => {
      const folder = await openLinked();
      await screen.findByTestId('link-rewrite-dialog');
      fireEvent.click(screen.getByTestId('link-rewrite-cancel'));
      await settle();
      expect(screen.queryByTestId('link-rewrite-dialog')).toBeNull();
      expect(folder.hasFile('Guides/Setup.md')).toBe(true);
      expect(folder.readText('Welcome.md')).toBe('See [setup](Guides/Setup.md#top).\n');
    });
  });

  describe('reordering pages with Alt+ArrowUp (REQ-NTN-012)', () => {
    async function openFolder(folder: MemoryBackend) {
      const { host, next } = fakeHost(new Map([['notes', folder]]));
      next.handle = folderHandle('notes');
      renderApp(new MemoryBackend(), host);
      fireEvent.click(await screen.findByTestId('landing-open-folder'));
    }
    const titles = () =>
      screen
        .getAllByTestId(/^page-tree-button-/)
        .map((el) => el.getAttribute('data-testid')!.replace('page-tree-button-', ''));

    it('writes only the order keys the move needs, and shows the new order', async () => {
      const folder = new MemoryBackend();
      folder.seedText('space.cept.yaml', 'version: 1\nname: Notes\nslug: notes\n');
      folder.seedText('Alpha.md', '# Alpha\n');
      folder.seedText('Welcome.md', '---\ntitle: Welcome\n---\n# Welcome\n');
      folder.seedText('Zebra.md', '# Zebra\n');
      await openFolder(folder);
      const zebra = await screen.findByTestId('page-tree-button-Zebra.md', {}, { timeout: 3000 });
      expect(titles()).toEqual(['Alpha.md', 'Welcome.md', 'Zebra.md']);

      fireEvent.keyDown(zebra, { key: 'ArrowUp', altKey: true });
      await vi.waitFor(() => expect(titles()).toEqual(['Alpha.md', 'Zebra.md', 'Welcome.md']), {
        timeout: 3000,
      });
      expect(folder.readText('Alpha.md')).toBe('---\norder: 0\n---\n# Alpha\n');
      expect(folder.readText('Zebra.md')).toBe('---\norder: 1024\n---\n# Zebra\n');
      expect(folder.readText('Welcome.md')).toBe('---\ntitle: Welcome\n---\n# Welcome\n');
    });

    it('refuses a move that needs a folder without a page to hold an order', async () => {
      const folder = notesFolder();
      folder.seedText('Zebra.md', '# Zebra\n');
      await openFolder(folder);
      const zebra = await screen.findByTestId('page-tree-button-Zebra.md', {}, { timeout: 3000 });
      expect(titles()).toEqual(['Guides', 'Welcome.md', 'Zebra.md']);

      fireEvent.keyDown(zebra, { key: 'ArrowUp', altKey: true });
      expect(
        (await screen.findByText(/Add a page to the folder "Guides" first/)).textContent,
      ).toBeTruthy();
      expect(folder.readText('Zebra.md')).toBe('# Zebra\n');
      expect(folder.readText('Welcome.md')).toBe('# Welcome\n\nHello from a folder.\n');
      expect(titles()).toEqual(['Guides', 'Welcome.md', 'Zebra.md']);
    });

    it('refuses a move when a page front matter is not valid YAML, writing nothing', async () => {
      const folder = new MemoryBackend();
      folder.seedText('space.cept.yaml', 'version: 1\nname: Notes\nslug: notes\n');
      folder.seedText('Alpha.md', '---\nbad: : :\n---\n# Alpha\n');
      folder.seedText('Welcome.md', '# Welcome\n');
      folder.seedText('Zebra.md', '# Zebra\n');
      await openFolder(folder);
      const zebra = await screen.findByTestId('page-tree-button-Zebra.md', {}, { timeout: 3000 });

      fireEvent.keyDown(zebra, { key: 'ArrowUp', altKey: true });
      expect((await screen.findByText(/not valid YAML/)).textContent).toBeTruthy();
      expect(folder.readText('Alpha.md')).toBe('---\nbad: : :\n---\n# Alpha\n');
      expect(folder.readText('Welcome.md')).toBe('# Welcome\n');
      expect(folder.readText('Zebra.md')).toBe('# Zebra\n');
    });
  });

  describe('moving pages into other pages (REQ-NTN-012)', () => {
    async function openFolder(folder: MemoryBackend) {
      const { host, next } = fakeHost(new Map([['notes', folder]]));
      next.handle = folderHandle('notes');
      renderApp(new MemoryBackend(), host);
      fireEvent.click(await screen.findByTestId('landing-open-folder'));
      return screen.findByTestId('page-tree-button-Zebra.md', {}, { timeout: 3000 });
    }
    const moveVia = async (id: string, target: string) => {
      fireEvent.contextMenu(await screen.findByTestId(`page-tree-button-${id}`));
      fireEvent.click(await screen.findByTestId('ctx-move-to'));
      fireEvent.click(await screen.findByTestId(`move-target-${target}`));
    };

    it('nests a page under a file page, which becomes a folder page, from the picker', async () => {
      const folder = notesFolder();
      folder.seedText('Zebra.md', '# Zebra\n');
      await openFolder(folder);
      await moveVia('Zebra.md', 'Welcome.md');
      await screen.findByTestId('page-tree-button-Welcome/Zebra.md', {}, { timeout: 3000 });
      expect(folder.readText('Welcome/Zebra.md')).toBe('# Zebra\n');
      expect(folder.readText('Welcome/index.md')).toBe('# Welcome\n\nHello from a folder.\n');
      expect(folder.hasFile('Welcome.md')).toBe(false);
      expect(folder.hasFile('Zebra.md')).toBe(false);
    });

    it('nests a page dropped onto another row, asking about the links it would break', async () => {
      const folder = notesFolder();
      folder.seedText('Zebra.md', 'Back to [welcome](Welcome.md).\n');
      folder.seedText('Welcome.md', 'See [zebra](Zebra.md).\n');
      const zebra = await openFolder(folder);
      const welcome = await screen.findByTestId('page-tree-button-Welcome.md');
      const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
      fireEvent.dragStart(zebra, { dataTransfer });
      // jsdom lays nothing out and drag events have no coordinates: aim at the middle of the row.
      for (const type of ['dragOver', 'drop'] as const) {
        const event = createEvent[type](welcome, { dataTransfer });
        Object.defineProperty(event, 'clientY', { value: 0.5 });
        fireEvent(welcome, event);
      }
      fireEvent.click(await screen.findByTestId('link-rewrite-update'));
      await screen.findByTestId('page-tree-button-Welcome/Zebra.md', {}, { timeout: 3000 });
      expect(folder.readText('Welcome/index.md')).toBe('See [zebra](Zebra.md).\n');
      expect(folder.readText('Welcome/Zebra.md')).toBe('Back to [welcome](index.md).\n');
    });

    it('shows the folder as it is on disk when a move is refused', async () => {
      const folder = notesFolder();
      folder.seedText('Zebra.md', '# Zebra\n');
      folder.seedText('Guides/Zebra.md', '# Another\n');
      await openFolder(folder);
      folder.seedText('Added.md', '# Added\n');
      await moveVia('Zebra.md', 'Guides');
      expect((await screen.findByText(/already exists/)).textContent).toBeTruthy();
      await screen.findByTestId('page-tree-button-Added.md', {}, { timeout: 3000 });
      expect(folder.readText('Zebra.md')).toBe('# Zebra\n');
      expect(folder.readText('Guides/Zebra.md')).toBe('# Another\n');
    });
  });

  describe('a file that is not a page', () => {
    async function openWithImage(action: 'ctx-rename' | 'move-to-root' | 'ctx-delete') {
      const folder = notesFolder();
      folder.seedText('Welcome.md', 'Logo: ![logo](Guides/logo.png)\n');
      folder.seedText('Guides/logo.png', 'png');
      const { host, next } = fakeHost(new Map([['notes', folder]]));
      next.handle = folderHandle('notes');
      renderApp(new MemoryBackend(), host);
      fireEvent.click(await screen.findByTestId('landing-open-folder'));
      fireEvent.click(await screen.findByTestId('page-tree-toggle-Guides', {}, { timeout: 3000 }));
      fireEvent.contextMenu(await screen.findByTestId('page-tree-button-Guides/logo.png'));
      // No page-only actions for a file.
      expect(screen.queryByTestId('ctx-duplicate')).toBeNull();
      expect(screen.queryByTestId('ctx-toggle-favorite')).toBeNull();
      if (action === 'move-to-root') {
        fireEvent.click(await screen.findByTestId('ctx-move-to'));
        fireEvent.click(await screen.findByTestId('move-target-root'));
      } else fireEvent.click(await screen.findByTestId(action));
      if (action === 'ctx-rename') {
        const input = await screen.findByTestId('rename-input');
        fireEvent.change(input, { target: { value: 'brand' } });
        fireEvent.keyDown(input, { key: 'Enter' });
      }
      return folder;
    }

    it('renames it, keeping its extension, and updates the links to it', async () => {
      const folder = await openWithImage('ctx-rename');
      fireEvent.click(await screen.findByTestId('link-rewrite-update'));
      await screen.findByTestId('page-tree-button-Guides/brand.png', {}, { timeout: 3000 });
      expect(folder.hasFile('Guides/logo.png')).toBe(false);
      expect(folder.readText('Welcome.md')).toBe('Logo: ![logo](Guides/brand.png)\n');
    });

    it('moves it to the root, leaving links alone when asked to', async () => {
      const folder = await openWithImage('move-to-root');
      fireEvent.click(await screen.findByTestId('link-rewrite-skip'));
      await screen.findByTestId('page-tree-button-logo.png', {}, { timeout: 3000 });
      expect(folder.readText('Welcome.md')).toBe('Logo: ![logo](Guides/logo.png)\n');
    });

    it('deletes it only after the user confirms', async () => {
      const folder = await openWithImage('ctx-delete');
      fireEvent.click(await screen.findByTestId('delete-file-cancel'));
      await settle();
      expect(folder.hasFile('Guides/logo.png')).toBe(true);

      fireEvent.contextMenu(screen.getByTestId('page-tree-button-Guides/logo.png'));
      fireEvent.click(await screen.findByTestId('ctx-delete'));
      fireEvent.click(await screen.findByTestId('delete-file-confirm'));
      await settle();
      expect(folder.hasFile('Guides/logo.png')).toBe(false);
      expect(screen.queryByTestId('page-tree-button-Guides/logo.png')).toBeNull();
    });
  });

  it('lists a file that is not a page and previews it read-only', async () => {
    const folder = notesFolder();
    folder.seedText('readme.txt', 'plain words');
    const { backend, writes } = writeSpy(folder);
    const { host, next } = fakeHost(new Map([['notes', backend]]));
    next.handle = folderHandle('notes');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    fireEvent.click(
      await screen.findByTestId('page-tree-button-readme.txt', {}, { timeout: 3000 }),
    );
    expect((await screen.findByTestId('foreign-file-text')).textContent).toBe('plain words');
    expect(screen.queryByTestId('page-tree-menu-readme.txt')).toBeNull();
    // A file that is not a page is not added to Recent.
    expect(screen.queryByTestId('recent-section')).toBeNull();
    await settle();
    expect(writes).toEqual([]);
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

  it('lists the pages that link to the open page, and opens one when clicked (EDT-021)', async () => {
    const folder = notesFolder();
    folder.seedText('Welcome.md', '# Welcome\n\nHello from a folder.\n');
    folder.seedText('Guides/Setup.md', '# Setup\n\nBack to the [start page](../Welcome.md).\n');
    const { host, next } = fakeHost(new Map([['notes', folder]]));
    next.handle = folderHandle('notes');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    const [item] = await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    fireEvent.click(item!);
    await screen.findByText('Hello from a folder.', {}, { timeout: 3000 });

    const backlink = await screen.findByTestId('backlink-Guides/Setup.md', {}, { timeout: 3000 });
    expect(backlink.textContent).toContain('Setup');
    expect(backlink.textContent).toContain('start page');
    fireEvent.click(backlink);
    expect(await screen.findByText(/Back to the/, {}, { timeout: 3000 })).toBeDefined();
  });

  it('finds a page by the text other pages link to it with', async () => {
    const folder = notesFolder();
    folder.seedText(
      'Guides/Setup.md',
      '# Setup\n\nRead the [onboarding checklist](../Welcome.md).\n',
    );
    const { host, next } = fakeHost(new Map([['notes', folder]]));
    next.handle = folderHandle('notes');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    const [item] = await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    fireEvent.click(item!);
    await screen.findByTestId('backlink-Guides/Setup.md', {}, { timeout: 3000 });

    fireEvent.click(screen.getByTestId('sidebar-search'));
    fireEvent.change(await screen.findByTestId('search-input'), {
      target: { value: 'onboarding' },
    });
    // "Welcome" never says "onboarding"; the page that links to it does.
    expect(
      await screen.findByTestId('search-result-Welcome.md', {}, { timeout: 3000 }),
    ).toBeDefined();
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

  it('after the user refuses the saved folder, the next reconnect picks it again', async () => {
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

    const [{ id }] = await handles.list();
    await handles.save(id, folderHandle('notes', 'prompt', 'denied'));
    const second = fakeHost(new Map([['notes', folder]]), handles);
    renderApp(app, second.host);

    fireEvent.click(await screen.findByTestId('folder-reconnect-btn'));
    expect(await screen.findByText(/was not allowed to open the folder "notes"/)).toBeDefined();
    expect(screen.getByTestId('folder-reconnect-btn').textContent).toBe('Pick the folder');

    const picked = folderHandle('notes');
    second.next.handle = picked;
    fireEvent.click(screen.getByTestId('folder-reconnect-btn'));
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('folder-reconnect')).toBeNull();
    expect(await handles.load(id)).toBe(picked);
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

  it('shows a page without its front matter and leaves the file unchanged (EDT-026)', async () => {
    const page = '---\n# Hugo settings\nweight: 3\ndraft: true\n---\n\nHugo body.\n';
    const folder = notesFolder();
    folder.seedText('Hugo.md', page);
    const { backend, writes } = writeSpy(folder);
    const { host, next } = fakeHost(new Map([['notes', backend]]));
    next.handle = folderHandle('notes');
    renderApp(new MemoryBackend(), host);

    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    const [item] = await screen.findAllByText('Hugo', {}, { timeout: 3000 });
    fireEvent.click(item!);
    await screen.findByText('Hugo body.', {}, { timeout: 3000 });
    expect(screen.queryByText(/weight: 3/)).toBeNull();
    expect(screen.queryByText(/Hugo settings/)).toBeNull();
    await settle();

    expect(writes).toEqual([]);
    expect(folder.readText('Hugo.md')).toBe(page);
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

  /** Open the notes folder, then reload with its saved handle gone. */
  async function reloadWithoutHandle(app: MemoryBackend, folders: Map<string, StorageBackend>) {
    const handles = memoryStore();
    const first = fakeHost(folders, handles);
    first.next.handle = folderHandle('notes');
    renderApp(app, first.host);
    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    await screen.findAllByText('Welcome', {}, { timeout: 3000 });
    await settle();
    cleanup();
    const [{ id }] = await handles.list();
    await handles.remove(id);
    const second = fakeHost(folders, handles);
    renderApp(app, second.host);
    await screen.findByTestId('folder-reconnect-btn', {}, { timeout: 3000 });
    return { ...second, handles, id };
  }

  it('without a saved handle, refuses a picked folder that does not hold the space', async () => {
    const app = new MemoryBackend();
    const plain = new MemoryBackend();
    plain.seedText('todo.md', '# Todo\n');
    const { backend, writes } = writeSpy(plain);
    const { next, handles } = await reloadWithoutHandle(
      app,
      new Map<string, StorageBackend>([
        ['notes', notesFolder()],
        ['plain', backend],
      ]),
    );

    next.handle = folderHandle('plain');
    fireEvent.click(screen.getByTestId('folder-reconnect-btn'));
    expect(await screen.findByText(/"plain" is not the folder of "Notes"/)).toBeDefined();
    expect(screen.getByTestId('folder-reconnect')).toBeDefined();
    expect(await handles.list()).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('without a saved handle, asks before using a folder whose space has another name', async () => {
    const app = new MemoryBackend();
    const other = new MemoryBackend();
    other.seedText('space.cept.yaml', 'version: 1\nname: Other\nslug: other\n');
    other.seedText('Elsewhere.md', '# Elsewhere\n');
    const { next, handles, id } = await reloadWithoutHandle(
      app,
      new Map<string, StorageBackend>([
        ['notes', notesFolder()],
        ['other', other],
      ]),
    );

    next.handle = folderHandle('other');
    fireEvent.click(screen.getByTestId('folder-reconnect-btn'));
    expect(await screen.findByTestId('folder-reconnect-mismatch')).toBeDefined();
    expect(screen.queryByText('Elsewhere')).toBeNull();
    expect(await handles.list()).toEqual([]);

    fireEvent.click(screen.getByTestId('folder-reconnect-confirm'));
    expect((await screen.findAllByText('Elsewhere', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('folder-reconnect')).toBeNull();
    expect((await handles.list()).map((e) => e.id)).toEqual([id]);
  });

  it('without a saved handle, binds a picked folder that holds the space', async () => {
    const app = new MemoryBackend();
    const { next, handles, id } = await reloadWithoutHandle(
      app,
      new Map<string, StorageBackend>([['notes', notesFolder()]]),
    );

    next.handle = folderHandle('notes');
    fireEvent.click(screen.getByTestId('folder-reconnect-btn'));
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByTestId('folder-reconnect-mismatch')).toBeNull();
    expect((await handles.list()).map((e) => e.id)).toEqual([id]);
  });
});

describe('App space lifecycle (REQ-WS-024)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  /** An app with an inactive folder-layout space "Work" holding one page, then the notes folder opened. */
  async function openNotesBesideWork() {
    const app = new MemoryBackend();
    app.seedText(
      '.cept/spaces.json',
      JSON.stringify({
        activeSpaceId: 'default',
        spaces: [
          { id: 'default', name: 'My Space', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'space-1', name: 'Work', createdAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    );
    app.seedText('.cept/spaces/space-1/space.cept.yaml', 'version: 1\nname: Work\nslug: work\n');
    app.seedText('.cept/spaces/space-1/Plan.md', '# Plan\n');
    const raw = notesFolder();
    const { backend, writes } = writeSpy(raw);
    const { host, next } = fakeHost(new Map([['notes', backend]]));
    next.handle = folderHandle('notes');
    renderApp(app, host);
    fireEvent.click(await screen.findByTestId('landing-open-folder'));
    expect((await screen.findAllByText('Welcome', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    await settle();
    const manifest = JSON.parse(app.readText('.cept/spaces.json')!) as {
      spaces: { id: string; backend?: string }[];
    };
    const id = manifest.spaces.find((s) => s.backend === 'folder')!.id;
    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-settings'));
    fireEvent.click(screen.getByTestId('settings-tab-spaces'));
    return { app, raw, writes, host, id };
  }

  it('lists real stats for a space that is not open, and labels a folder space', async () => {
    const { id } = await openNotesBesideWork();
    await screen.findByText(/1 page · 7 B/, {}, { timeout: 3000 });
    expect(screen.getByTestId('space-item-space-1').textContent).toMatch(/1 page · 7 B/);
    expect(screen.getByTestId(`space-item-${id}`).textContent).toMatch(/Folder on this device/);
  });

  it('removes a folder space from Cept after asking, writing nothing to the folder', async () => {
    const { app, writes, host, id } = await openNotesBesideWork();
    fireEvent.click(screen.getByTestId(`delete-space-${id}`));
    expect(screen.getByTestId('space-remove-title').textContent).toBe('Remove "Notes" from Cept?');
    fireEvent.click(screen.getByTestId('space-remove-confirm-btn'));
    await settle();
    const manifest = JSON.parse(app.readText('.cept/spaces.json')!) as {
      spaces: { id: string }[];
    };
    expect(manifest.spaces.map((s) => s.id)).toEqual(['default', 'space-1']);
    expect(writes).toEqual([]);
    expect(await host.handles.list()).toEqual([]);
  });

  it('a rename the space file refuses changes nothing and says why', async () => {
    const { raw, id } = await openNotesBesideWork();
    raw.seedText('space.cept.yaml', 'name: [unclosed');
    fireEvent.click(screen.getByTestId(`space-settings-${id}`));
    fireEvent.click(screen.getByTestId('space-details-name'));
    fireEvent.change(screen.getByTestId('space-rename-input'), { target: { value: 'Lab' } });
    fireEvent.click(screen.getByTestId('space-rename-save'));
    await screen.findByText(/Could not rename the space: space\.cept\.yaml/, {}, { timeout: 3000 });
    expect(raw.readText('space.cept.yaml')).toBe('name: [unclosed');
    expect(screen.queryByText('Lab')).toBeNull();
  });
});
