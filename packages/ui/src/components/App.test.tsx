import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App } from './App.js';
import { StorageProvider } from './storage/StorageContext.js';
import { MemoryBackend } from './storage/test-helpers.js';
import { DEFAULT_SETTINGS } from './settings/SettingsModal.js';

// Mock d3 for KnowledgeGraph (transitive dep)
vi.mock('d3', () => {
  const selection = {
    append: vi.fn().mockReturnThis(),
    attr: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    remove: vi.fn().mockReturnThis(),
  };
  return {
    select: vi.fn(() => selection),
    zoom: vi.fn(() => ({ scaleExtent: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() })),
    forceSimulation: vi.fn(() => ({
      force: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      alphaTarget: vi.fn().mockReturnThis(),
      restart: vi.fn(),
      stop: vi.fn(),
    })),
    forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() })),
    forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
    forceCenter: vi.fn(),
    forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
    drag: vi.fn(() => ({ on: vi.fn().mockReturnThis() })),
  };
});

function renderApp(backend?: MemoryBackend) {
  const b = backend ?? new MemoryBackend();
  return render(
    <StorageProvider backend={b}>
      <App />
    </StorageProvider>,
  );
}

/** Helper: seed workspace tree state (no pageContents — individual files instead) */
function seedWorkspace(backend: MemoryBackend, state: Record<string, unknown>) {
  backend.seedFile('.cept/workspace-state.json', state);
}

/** Helper: seed a single page's content as an individual file */
function seedPageContent(backend: MemoryBackend, pageId: string, content: string) {
  backend.seedText(`pages/${pageId}.md`, content);
}

/** Helper: seed settings in the backend so showDemoContent is true */
function seedDemoMode(backend: MemoryBackend) {
  backend.seedFile('.cept/settings.json', { autoSave: true, showDemoContent: true });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('renders landing page when showDemoContent is false and no persisted data', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeDefined();
    });
    expect(screen.getByTestId('start-writing')).toBeDefined();
    expect(screen.getByTestId('try-demo')).toBeDefined();
    expect(screen.getByTestId('feature-grid')).toBeDefined();
    expect(screen.getByTestId('demo-info')).toBeDefined();
  });

  it('renders demo content when showDemoContent setting is true', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.queryByTestId('landing-page')).toBeNull();
    });
    expect(screen.getAllByText('Cept').length).toBeGreaterThanOrEqual(1);
  });

  it('"Start writing" creates initial workspace', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('start-writing')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('start-writing'));
    expect(screen.queryByTestId('landing-page')).toBeNull();
  });

  it('creates new page via sidebar', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('has working sidebar toggle on mobile', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-toggle')).toBeDefined();
    });
    const toggle = screen.getByTestId('sidebar-toggle');
    fireEvent.click(toggle);
    expect(screen.queryByText('Pages')).toBeNull();
    fireEvent.click(toggle);
  });

  it('sidebar starts closed on mobile viewport', async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
    try {
      const backend = new MemoryBackend();
      seedDemoMode(backend);
      renderApp(backend);
      await waitFor(() => {
        expect(screen.getByTestId('sidebar-toggle')).toBeDefined();
      });
      // Sidebar should be closed by default on mobile
      expect(screen.queryByTestId('sidebar-backdrop')).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        value: originalInnerWidth,
        writable: true,
        configurable: true,
      });
    }
  });

  it('opens command palette with keyboard shortcut', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.queryByTestId('app-loading')).toBeNull();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('persists tree state to backend (without pageContents)', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    renderApp(backend);

    // Wait for loading to complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Click start writing
    await act(async () => {
      fireEvent.click(screen.getByTestId('start-writing'));
    });

    // Wait for debounced persist (300ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    const stored = await backend.readFile('.cept/workspace-state.json');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(new TextDecoder().decode(stored!));
    expect(parsed.pages).toBeDefined();
    expect(parsed.pages.length).toBeGreaterThan(0);
    // pageContents should NOT be in the workspace state anymore
    expect(parsed.pageContents).toBeUndefined();
  });

  it('"Start writing" writes page content to individual file', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    renderApp(backend);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('start-writing'));
    });

    // Wait for debounced persist (300ms) and async writes
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    // A new space starts as a folder space: the page is a Markdown file named
    // from its title, and the state file keeps its icon.
    expect(backend.hasFile('space.cept.yaml')).toBe(true);
    expect(backend.readText('Welcome.md')).toContain('Start typing here');
    const parsed = JSON.parse(backend.readText('.cept/workspace-state.json')!);
    expect(parsed.pages[0]).toMatchObject({ id: 'Welcome.md', icon: '\u{1F44B}' });
    expect(backend.hasFile('.cept/migration-backup/manifest.json')).toBe(false);
  });

  it('restores state from backend on reload (individual page files)', async () => {
    const backend = new MemoryBackend();
    seedWorkspace(backend, {
      pages: [{ id: 'test-page', title: 'Persisted Page', children: [] }],
      favorites: [],
      recentPages: [],
      selectedPageId: 'test-page',
    });
    seedPageContent(backend, 'test-page', '<p>Saved content</p>');
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Persisted Page').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('migrates pageContents from blob to individual files', async () => {
    const backend = new MemoryBackend();
    // Seed the old format with pageContents in the workspace state
    seedWorkspace(backend, {
      pages: [{ id: 'old-page', title: 'Old Page', children: [] }],
      pageContents: { 'old-page': '<p>Migrated content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'old-page',
    });
    renderApp(backend);

    await waitFor(() => {
      expect(screen.getAllByText('Old Page').length).toBeGreaterThanOrEqual(1);
    });

    // The space is converted to folders: the content lands in its own file
    await waitFor(() => {
      expect(backend.readText('Old Page.md')).toBe('<p>Migrated content</p>');
    });

    // workspace-state.json should no longer contain pageContents
    const parsed = JSON.parse(backend.readText('.cept/workspace-state.json')!);
    expect(parsed.pageContents).toBeUndefined();
    expect(parsed.selectedPageId).toBe('Old Page.md');
  });

  it('search opens and finds pages', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.queryByTestId('app-loading')).toBeNull();
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('unimplemented storage options are disabled on landing page', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeDefined();
    });
    const buttons = screen.getAllByRole('button');
    const localFolder = buttons.find((b) => b.textContent?.includes('Local folder'));
    const gitRepo = buttons.find((b) => b.textContent?.includes('Git repository'));
    expect((localFolder as HTMLButtonElement)?.disabled).toBe(true);
    expect((gitRepo as HTMLButtonElement)?.disabled).toBe(true);
  });

  it('does not show reset demo button in header (moved to settings)', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.queryByTestId('app-loading')).toBeNull();
    });
    expect(screen.queryByTestId('reset-demo')).toBeNull();
  });

  it('demo mode writes nothing to the app backend', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Let the debounced persist run
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
    expect(backend.hasFile('pages/welcome.md')).toBe(false);
    expect(backend.hasFile('.cept/workspace-state.json')).toBe(false);
    const manifest = JSON.parse(backend.readText('.cept/spaces.json') ?? '{}') as {
      spaces: { id: string; name: string }[];
    };
    expect(manifest.spaces.map((s) => [s.id, s.name])).toEqual([['default', 'My Space']]);
  });

  it('clearing all data empties the default space and shows the demo in memory', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    seedWorkspace(backend, {
      pages: [{ id: 'mine', title: 'Mine', children: [] }],
      favorites: [],
      recentPages: [],
      selectedPageId: 'mine',
      spaceName: 'Mine',
    });
    seedPageContent(backend, 'mine', 'my own words');
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Mine').length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-settings'));
    fireEvent.click(screen.getByTestId('settings-tab-spaces'));
    fireEvent.click(screen.getByTestId('clear-all-data-btn'));
    await waitFor(() => {
      expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(backend.hasFile('pages/mine.md')).toBe(false);
    expect(backend.hasFile('pages/welcome.md')).toBe(false);
    // The default space had been converted to folders on load; its files go too.
    expect(backend.hasFile('Mine.md')).toBe(false);
    expect(backend.hasFile('space.cept.yaml')).toBe(false);
    expect(backend.hasFile('.cept/migration-backup/manifest.json')).toBe(false);
    expect(backend.hasFile('.cept/workspace-state.json')).toBe(false);
    const manifest = JSON.parse(backend.readText('.cept/spaces.json') ?? '{}') as {
      spaces: { id: string; name: string }[];
    };
    expect(manifest.spaces.map((s) => [s.id, s.name])).toEqual([['default', 'My Space']]);
    expect(JSON.parse(backend.readText('.cept/settings.json') ?? '{}')).toEqual(DEFAULT_SETTINGS);
  });

  it('?demo opens the demo without touching saved spaces', async () => {
    const backend = new MemoryBackend();
    seedWorkspace(backend, {
      pages: [{ id: 'mine', title: 'Mine', children: [] }],
      favorites: [],
      recentPages: [],
      selectedPageId: 'mine',
      spaceName: 'Mine',
    });
    seedPageContent(backend, 'mine', 'my own words');
    backend.seedFile('.cept/spaces.json', {
      activeSpaceId: 'default',
      spaces: [{ id: 'default', name: 'Mine', createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    const files = ['.cept/spaces.json', '.cept/workspace-state.json', 'pages/mine.md'];
    const before = files.map((f) => backend.readText(f));
    window.history.pushState({}, '', '/?demo');
    try {
      renderApp(backend);
      await waitFor(() => {
        expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
    } finally {
      window.history.pushState({}, '', '/');
    }

    expect(files.map((f) => backend.readText(f))).toEqual(before);
    expect(backend.hasFile('pages/welcome.md')).toBe(false);
  });

  it('recreating the demo leaves the default space and the manifest untouched', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    seedWorkspace(backend, {
      pages: [{ id: 'mine', title: 'Mine', children: [] }],
      favorites: [],
      recentPages: [],
      selectedPageId: 'mine',
      spaceName: 'Mine',
    });
    seedPageContent(backend, 'mine', 'my own words');
    backend.seedFile('.cept/spaces.json', {
      activeSpaceId: 'default',
      spaces: [{ id: 'default', name: 'Mine', createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Mine').length).toBeGreaterThanOrEqual(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    const files = ['.cept/spaces.json', '.cept/workspace-state.json', 'pages/mine.md'];
    const before = files.map((f) => backend.readText(f));

    fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
    fireEvent.click(screen.getByTestId('sidebar-app-menu-settings'));
    fireEvent.click(screen.getByTestId('settings-tab-spaces'));
    fireEvent.click(screen.getByTestId('recreate-demo-btn'));
    await waitFor(() => {
      expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(files.map((f) => backend.readText(f))).toEqual(before);
    expect(backend.hasFile('pages/welcome.md')).toBe(false);
  });

  it('demo mode shows demo content initially', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('restores persisted state even when showDemoContent is true', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    seedWorkspace(backend, {
      pages: [{ id: 'my-page', title: 'My Saved Page', children: [] }],
      favorites: [],
      recentPages: [],
      selectedPageId: 'my-page',
    });
    seedPageContent(backend, 'my-page', '<p>My content</p>');
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('My Saved Page').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows page header with title when page is selected', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeDefined();
    });
    expect(screen.getByTestId('page-title')).toBeDefined();
    // Page menu is now in the top header bar, not in the page header
    expect(screen.getByTestId('page-menu-btn')).toBeDefined();
  });

  it('page title is clickable for inline editing', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('page-title'));
    expect(screen.getByTestId('page-title-input')).toBeDefined();
    expect(screen.getByTestId('page-title-save')).toBeDefined();
  });

  it('shows app menu trigger in sidebar footer', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-app-menu-trigger')).toBeDefined();
    });
  });

  it('shows new page and trash buttons in sidebar footer', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-add-page')).toBeDefined();
      expect(screen.getByTestId('trash-toggle')).toBeDefined();
    });
  });

  describe('folder spaces', () => {
    const root = '.cept/spaces/space-f';

    function seedFolderSpace(): MemoryBackend {
      const backend = new MemoryBackend();
      backend.seedFile('.cept/spaces.json', {
        activeSpaceId: 'space-f',
        spaces: [
          { id: 'default', name: 'My Space', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'space-f', name: 'Notes', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      });
      backend.seedText(`${root}/space.cept.yaml`, 'version: "1"\nname: Notes\nslug: notes\n');
      backend.seedText(`${root}/guides/index.md`, '# Guides');
      backend.seedText(`${root}/guides/setup.md`, '# Setup');
      backend.seedText(`${root}/todo.md`, '# Todo');
      return backend;
    }

    it('shows the folder hierarchy and folder pages in the sidebar', async () => {
      renderApp(seedFolderSpace());
      await waitFor(() => {
        expect(screen.getByTestId('page-tree-item-guides')).toBeDefined();
      });
      expect(screen.getByTestId('page-tree-item-todo.md')).toBeDefined();
      fireEvent.click(screen.getByTestId('page-tree-toggle-guides'));
      expect(screen.getByTestId('page-tree-item-guides/setup.md')).toBeDefined();
    });

    it('writes new and renamed pages as files at their paths', async () => {
      const backend = seedFolderSpace();
      renderApp(backend);
      await waitFor(() => {
        expect(screen.getByTestId('page-tree-item-todo.md')).toBeDefined();
      });
      fireEvent.click(screen.getByTestId('sidebar-add-page'));
      await waitFor(() => {
        expect(screen.getByTestId('page-tree-item-Untitled.md')).toBeDefined();
      });
      expect(backend.hasFile(`${root}/Untitled.md`)).toBe(true);

      fireEvent.click(await screen.findByTestId('page-title'));
      fireEvent.change(screen.getByTestId('page-title-input'), { target: { value: 'Plans' } });
      fireEvent.mouseDown(screen.getByTestId('page-title-save'));
      await waitFor(() => {
        expect(screen.getByTestId('page-tree-item-Plans.md')).toBeDefined();
      });
      expect(backend.hasFile(`${root}/Plans.md`)).toBe(true);
      expect(backend.hasFile(`${root}/Untitled.md`)).toBe(false);
    });
  });

  describe('deep links (D-42)', () => {
    const root = '.cept/spaces/space-f';

    function seedFolderSpace(): MemoryBackend {
      const backend = new MemoryBackend();
      backend.seedFile('.cept/spaces.json', {
        activeSpaceId: 'space-f',
        spaces: [
          { id: 'default', name: 'My Space', createdAt: '2026-01-01T00:00:00.000Z' },
          { id: 'space-f', name: 'Notes', createdAt: '2026-01-01T00:00:00.000Z' },
        ],
      });
      backend.seedText(`${root}/space.cept.yaml`, 'version: "1"\nname: Notes\nslug: notes\n');
      backend.seedText(`${root}/guides/index.md`, '# Guides');
      backend.seedText(`${root}/guides/set up.md`, '# Set up');
      backend.seedText(`${root}/todo.md`, '# Todo');
      backend.seedFile(`${root}/.cept/workspace-state.json`, {
        pages: [],
        favorites: [],
        recentPages: [],
        selectedPageId: 'todo.md',
        spaceName: 'Notes',
      });
      return backend;
    }

    function visit(path: string) {
      window.history.replaceState({}, '', path);
    }

    beforeEach(() => visit('/'));

    it('opens a nested page from its path', async () => {
      visit('/s/space-f/guides/set%20up.md');
      renderApp(seedFolderSpace());
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumbs').textContent).toContain('set up');
      });
      expect(screen.queryByTestId('not-found')).toBeNull();
      expect(window.location.pathname).toBe('/s/space-f/guides/set%20up.md');
    });

    it('still resolves a deep link when loading the spaces at startup fails', async () => {
      visit('/s/space-f/todo.md');
      const backend = seedFolderSpace();
      // A saved default space, so the app has state to start from.
      backend.seedFile('.cept/workspace-state.json', {
        pages: [{ id: 'mine', title: 'Mine', children: [] }],
        favorites: [],
        recentPages: [],
        spaceName: 'My Space',
      });
      const readFile = backend.readFile.bind(backend);
      let failed = false;
      vi.spyOn(backend, 'readFile').mockImplementation(async (path) => {
        if (path === '.cept/spaces.json' && !failed) {
          failed = true;
          throw new Error('storage unavailable');
        }
        return readFile(path);
      });
      renderApp(backend);
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumbs').textContent).toContain('todo');
      });
      expect(failed).toBe(true);
      expect(window.location.pathname).toBe('/s/space-f/todo.md');
    });

    it('shows the not-found page for a missing page and keeps its URL', async () => {
      visit('/s/space-f/guides/gone.md');
      renderApp(seedFolderSpace());
      await waitFor(() => expect(screen.getByTestId('not-found')).toBeDefined());
      expect(screen.getByTestId('not-found-path').textContent).toBe('/s/space-f/guides/gone.md');
      expect(window.location.pathname).toBe('/s/space-f/guides/gone.md');

      fireEvent.click(screen.getByTestId('not-found-home'));
      await waitFor(() => expect(screen.queryByTestId('not-found')).toBeNull());
      await waitFor(() => expect(window.location.pathname).toBe('/s/space-f/todo.md'));
    });

    it('shows the not-found page for a space that does not exist', async () => {
      visit('/s/no-such-space/todo.md');
      renderApp(seedFolderSpace());
      await waitFor(() => expect(screen.getByTestId('not-found')).toBeDefined());
    });

    it('opens a fresh demo at the linked page after a reload', async () => {
      visit('/s/demo/features');
      renderApp(seedFolderSpace());
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumbs').textContent).toContain('Features');
      });
      expect(screen.queryByTestId('not-found')).toBeNull();
      expect(window.location.pathname).toBe('/s/demo/features');
    });

    it('shows the not-found page for a path that is no route', async () => {
      visit('/nowhere/at/all');
      renderApp(seedFolderSpace());
      await waitFor(() => expect(screen.getByTestId('not-found')).toBeDefined());
    });

    it('sends an old flat page URL to where the page moved', async () => {
      const backend = new MemoryBackend();
      seedWorkspace(backend, {
        pages: [
          { id: 'page-1', title: 'Notes', children: [] },
          { id: 'page-2', title: 'Ideas', children: [] },
        ],
        favorites: [],
        recentPages: [],
        selectedPageId: 'page-1',
        spaceName: 'Mine',
      });
      seedPageContent(backend, 'page-1', '<p>Notes words</p>');
      seedPageContent(backend, 'page-2', '<p>Ideas words</p>');
      visit('/s/default/page-2');
      renderApp(backend);

      await waitFor(() => expect(window.location.pathname).toBe('/s/default/Ideas.md'));
      expect(screen.queryByTestId('not-found')).toBeNull();
    });

    it('opens a default-space link while another space is active', async () => {
      const backend = seedFolderSpace();
      seedWorkspace(backend, {
        pages: [{ id: 'page-2', title: 'Ideas', children: [] }],
        favorites: [],
        recentPages: [],
        selectedPageId: 'page-2',
        spaceName: 'My Space',
      });
      seedPageContent(backend, 'page-2', '<p>Ideas words</p>');
      visit('/s/default/page-2');
      renderApp(backend);

      await waitFor(() => expect(window.location.pathname).toBe('/s/default/Ideas.md'));
      expect(screen.queryByTestId('not-found')).toBeNull();
    });
  });

  it('migrates from legacy localStorage on first load', async () => {
    const legacyState = {
      pages: [{ id: 'legacy-page', title: 'Legacy Page', children: [] }],
      pageContents: { 'legacy-page': '<p>Old data</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'legacy-page',
    };
    localStorage.setItem('cept-workspace', JSON.stringify(legacyState));

    const backend = new MemoryBackend();
    renderApp(backend);

    await waitFor(() => {
      expect(screen.getAllByText('Legacy Page').length).toBeGreaterThanOrEqual(1);
    });

    // Legacy data should be cleaned up from localStorage
    expect(localStorage.getItem('cept-workspace')).toBeNull();

    // Data should be in the backend
    const stored = await backend.readFile('.cept/workspace-state.json');
    expect(stored).not.toBeNull();

    // The space is converted to folders, keeping the content
    await waitFor(() => {
      expect(backend.readText('Legacy Page.md')).toBe('<p>Old data</p>');
    });
  });
  describe('converting a legacy flat space (REQ-WS-025)', () => {
    function seedFlatDefault(backend: MemoryBackend) {
      seedWorkspace(backend, {
        pages: [{ id: 'page-1', title: 'Notes', children: [] }],
        favorites: [{ id: 'page-1', title: 'Notes' }],
        recentPages: [],
        selectedPageId: 'page-1',
        spaceName: 'Mine',
      });
      seedPageContent(backend, 'page-1', '<p>Flat words</p>');
    }

    async function openSpaceDetails() {
      fireEvent.click(screen.getByTestId('sidebar-app-menu-trigger'));
      fireEvent.click(screen.getByTestId('sidebar-app-menu-settings'));
      fireEvent.click(screen.getByTestId('settings-tab-spaces'));
      fireEvent.click(screen.getByTestId('space-settings-default'));
      await waitFor(() => expect(screen.getByTestId('space-migration')).toBeDefined());
    }

    it('converts the space on load, shows the same pages and says a backup is kept', async () => {
      const backend = new MemoryBackend();
      seedFlatDefault(backend);
      renderApp(backend);

      await waitFor(() => {
        expect(screen.getByText(/now keeps its pages as files and folders/)).toBeDefined();
      });
      expect(screen.getAllByText('Notes').length).toBeGreaterThanOrEqual(1);
      expect(backend.readText('Notes.md')).toBe('<p>Flat words</p>');
      expect(backend.hasFile('pages/page-1.md')).toBe(false);
      expect(backend.readText('.cept/migration-backup/pages/page-1.md')).toBe('<p>Flat words</p>');
    });

    it('keeps the conversion and deletes the backup when asked', async () => {
      const backend = new MemoryBackend();
      seedFlatDefault(backend);
      renderApp(backend);
      await waitFor(() => expect(backend.hasFile('Notes.md')).toBe(true));

      await openSpaceDetails();
      fireEvent.click(screen.getByTestId('space-migration-keep'));

      await waitFor(() => {
        expect(backend.hasFile('.cept/migration-backup/manifest.json')).toBe(false);
      });
      expect(backend.readText('Notes.md')).toBe('<p>Flat words</p>');
      await waitFor(() => expect(screen.queryByTestId('space-migration')).toBeNull());
    });

    it('leaves the conversion in place when undo is cancelled', async () => {
      const backend = new MemoryBackend();
      seedFlatDefault(backend);
      renderApp(backend);
      await waitFor(() => expect(backend.hasFile('Notes.md')).toBe(true));

      await openSpaceDetails();
      fireEvent.click(screen.getByTestId('space-migration-undo'));
      fireEvent.click(screen.getByTestId('space-migration-undo-cancel'));

      expect(screen.queryByTestId('space-migration-undo-warning')).toBeNull();
      expect(screen.getByTestId('space-migration-undo')).toBeDefined();
      expect(backend.hasFile('Notes.md')).toBe(true);
      expect(backend.hasFile('.cept/migration-backup/manifest.json')).toBe(true);
    });

    it('undoes the conversion and shows the flat space again', async () => {
      const backend = new MemoryBackend();
      seedFlatDefault(backend);
      renderApp(backend);
      await waitFor(() => expect(backend.hasFile('Notes.md')).toBe(true));

      await openSpaceDetails();
      fireEvent.click(screen.getByTestId('space-migration-undo'));
      // Undo asks first: it loses changes made since the conversion.
      expect(screen.getByTestId('space-migration-undo-warning')).toBeDefined();
      expect(backend.hasFile('Notes.md')).toBe(true);
      fireEvent.click(screen.getByTestId('space-migration-undo-confirm'));

      await waitFor(() => {
        expect(screen.getByText(/back in its old layout/)).toBeDefined();
      });
      expect(backend.hasFile('Notes.md')).toBe(false);
      expect(backend.hasFile('space.cept.yaml')).toBe(false);
      expect(backend.readText('pages/page-1.md')).toBe('<p>Flat words</p>');
      // A later save keeps the flat ids.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      const state = JSON.parse(backend.readText('.cept/workspace-state.json')!);
      expect(state.pages[0].id).toBe('page-1');
      expect(state.selectedPageId).toBe('page-1');
    });
  });
});
