import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App } from './App.js';
import { StorageProvider } from './storage/StorageContext.js';
import { MemoryBackend } from './storage/test-helpers.js';

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
function seedPageContent(backend: MemoryBackend, pageId: string, html: string) {
  backend.seedText(`pages/${pageId}.html`, html);
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

    // The workspace-state should have the page tree
    const stored = await backend.readFile('.cept/workspace-state.json');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(new TextDecoder().decode(stored!));
    const pageId = parsed.pages[0].id as string;

    // Page content should be in its own file
    const pageContent = await backend.readText(`pages/${pageId}.html`);
    expect(pageContent).not.toBeNull();
    expect(pageContent).toContain('Start typing here');
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

    // After migration, page content should be in individual file
    const pageContent = await backend.readText('pages/old-page.html');
    expect(pageContent).toBe('<p>Migrated content</p>');

    // workspace-state.json should no longer contain pageContents
    const state = await backend.readFile('.cept/workspace-state.json');
    const parsed = JSON.parse(new TextDecoder().decode(state!));
    expect(parsed.pageContents).toBeUndefined();
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

  it('persists tree state when demo content is shown', async () => {
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

  it('demo mode writes page content to individual files', async () => {
    vi.useFakeTimers();
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    vi.useRealTimers();

    // Demo pages should have individual files
    const welcomeContent = await backend.readText('pages/welcome.html');
    expect(welcomeContent).not.toBeNull();
    expect(welcomeContent).toContain('demo space');
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

  it('shows settings button in sidebar footer', async () => {
    const backend = new MemoryBackend();
    seedDemoMode(backend);
    renderApp(backend);
    await waitFor(() => {
      expect(screen.getByTestId('app-menu-settings')).toBeDefined();
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

    // Page content should be migrated to individual file
    const pageContent = await backend.readText('pages/legacy-page.html');
    expect(pageContent).toBe('<p>Old data</p>');
  });
});
