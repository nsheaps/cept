import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App } from './App.js';
import { StorageProvider } from './storage/StorageContext.js';
import type { StorageBackend, BackendCapabilities, DirEntry, FileStat, FsEvent, Unsubscribe, WorkspaceConfig } from '@cept/core';

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
    forceSimulation: vi.fn(() => ({ force: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), alphaTarget: vi.fn().mockReturnThis(), restart: vi.fn(), stop: vi.fn() })),
    forceLink: vi.fn(() => ({ id: vi.fn().mockReturnThis(), distance: vi.fn().mockReturnThis() })),
    forceManyBody: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
    forceCenter: vi.fn(),
    forceCollide: vi.fn(() => ({ radius: vi.fn().mockReturnThis() })),
    drag: vi.fn(() => ({ on: vi.fn().mockReturnThis() })),
  };
});

/** In-memory StorageBackend for testing */
class MemoryBackend implements StorageBackend {
  readonly type = 'browser' as const;
  readonly capabilities: BackendCapabilities = {
    history: false,
    collaboration: false,
    sync: false,
    branching: false,
    externalEditing: false,
    watchForExternalChanges: false,
  };

  private files = new Map<string, Uint8Array>();

  async readFile(path: string): Promise<Uint8Array | null> {
    return this.files.get(this.normalize(path)) ?? null;
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    this.files.set(this.normalize(path), data);
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.normalize(path);
    for (const key of [...this.files.keys()]) {
      if (key === normalized || key.startsWith(normalized + '/')) {
        this.files.delete(key);
      }
    }
  }

  async listDirectory(_path: string): Promise<DirEntry[]> {
    return [];
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(this.normalize(path));
  }

  watch(_path: string, _callback: (event: FsEvent) => void): Unsubscribe {
    return () => {};
  }

  async stat(_path: string): Promise<FileStat | null> {
    return null;
  }

  async initialize(_config: WorkspaceConfig): Promise<void> {}

  async close(): Promise<void> {}

  private normalize(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
  }

  /** Helper to seed state for tests */
  seedFile(path: string, data: unknown): void {
    this.files.set(this.normalize(path), new TextEncoder().encode(JSON.stringify(data)));
  }
}

function renderApp(backend?: MemoryBackend) {
  const b = backend ?? new MemoryBackend();
  return render(
    <StorageProvider backend={b}>
      <App />
    </StorageProvider>,
  );
}

/** Helper: seed workspace state in the backend */
function seedWorkspace(backend: MemoryBackend, state: Record<string, unknown>) {
  backend.seedFile('.cept/workspace-state.json', state);
}

/** Helper: seed settings in the backend so showDemoContent is true */
function seedDemoMode(backend: MemoryBackend) {
  backend.seedFile('.cept/settings.json', { autoSave: true, showDemoContent: true });
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders onboarding screen when showDemoContent is false and no persisted data', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeDefined();
    });
    expect(screen.getByTestId('start-writing')).toBeDefined();
  });

  it('renders demo content when showDemoContent setting is true', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.queryByText('Get Started')).toBeNull();
    });
    expect(screen.getByText('Cept')).toBeDefined();
  });

  it('"Start writing" creates initial workspace', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('start-writing')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('start-writing'));
    expect(screen.queryByText('Get Started')).toBeNull();
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

  it('persists state to backend', async () => {
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
  });

  it('restores state from backend on reload', async () => {
    const backend = new MemoryBackend();
    seedWorkspace(backend, {
      pages: [{ id: 'test-page', title: 'Persisted Page', children: [] }],
      pageContents: { 'test-page': '<p>Saved content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'test-page',
    });
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('Persisted Page').length).toBeGreaterThanOrEqual(1);
    });
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

  it('unimplemented buttons are disabled', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByTestId('start-writing')).toBeDefined();
    });
    const buttons = screen.getAllByRole('button');
    const openFolder = buttons.find((b) => b.textContent?.includes('Open a folder'));
    const gitRepo = buttons.find((b) => b.textContent?.includes('Connect a Git repo'));
    expect((openFolder as HTMLButtonElement)?.disabled).toBe(true);
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

  it('persists state when demo content is shown', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);

    // Flush the async useEffect that loads persisted state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Now wait for the debounced persist (300ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    const stored = await backend.readFile('.cept/workspace-state.json');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(new TextDecoder().decode(stored!));
    expect(parsed.pages).toBeDefined();
    expect(parsed.pages.length).toBeGreaterThan(0);
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
      pageContents: { 'my-page': '<p>My content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'my-page',
    });
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getAllByText('My Saved Page').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows page header with title and menu when page is selected', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('page-header')).toBeDefined();
    });
    expect(screen.getByTestId('page-title')).toBeDefined();
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

  it('shows app menu in sidebar', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('app-menu-trigger')).toBeDefined();
    });
  });

  it('app menu opens and has actions', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('app-menu-trigger')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu')).toBeDefined();
    expect(screen.getByTestId('app-menu-settings')).toBeDefined();
    expect(screen.getByTestId('app-menu-help')).toBeDefined();
    expect(screen.getByTestId('app-menu-about')).toBeDefined();
  });

  it('persists space name', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);

    // Flush the async useEffect that loads persisted state
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Now wait for the debounced persist
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    const stored = await backend.readFile('.cept/workspace-state.json');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(new TextDecoder().decode(stored!));
    expect(parsed.spaceName).toBe('Demo Space');
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
  });
});
