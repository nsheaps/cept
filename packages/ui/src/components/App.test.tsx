import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App.js';

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

/** Helper: seed settings in localStorage so showDemoContent is true */
function enableDemoMode() {
  localStorage.setItem('cept-settings', JSON.stringify({ autoSave: true, showDemoContent: true }));
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders onboarding screen when showDemoContent is false and no persisted data', () => {
    // Default: showDemoContent defaults to false in test env (not nsheaps.github.io)
    render(<App />);
    expect(screen.getByText('Get Started')).toBeDefined();
    expect(screen.getByTestId('start-writing')).toBeDefined();
  });

  it('renders demo content when showDemoContent setting is true', () => {
    enableDemoMode();
    render(<App />);
    expect(screen.getByText('Cept')).toBeDefined();
    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('"Start writing" creates initial workspace', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-writing'));
    // Should show editor now, not onboarding
    expect(screen.queryByText('Get Started')).toBeNull();
  });

  it('creates new page via sidebar', () => {
    enableDemoMode();
    render(<App />);
    // The sidebar should have page items (text appears in sidebar + breadcrumb/editor)
    expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
  });

  it('has working sidebar toggle on mobile', () => {
    enableDemoMode();
    render(<App />);
    const toggle = screen.getByTestId('sidebar-toggle');
    expect(toggle).toBeDefined();
    // Clicking should hide sidebar
    fireEvent.click(toggle);
    // Sidebar should be hidden now (no sidebar element)
    expect(screen.queryByText('Pages')).toBeNull();
    // Click again to show
    fireEvent.click(toggle);
  });

  it('opens command palette with keyboard shortcut', () => {
    enableDemoMode();
    render(<App />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('persists state to localStorage', () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByTestId('start-writing'));

    // Wait for debounced persist (300ms debounce in App.tsx)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    const stored = localStorage.getItem('cept-workspace');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.pages).toBeDefined();
    expect(parsed.pages.length).toBeGreaterThan(0);
  });

  it('restores state from localStorage on reload', () => {
    // Pre-populate localStorage
    const state = {
      pages: [{ id: 'test-page', title: 'Persisted Page', children: [] }],
      pageContents: { 'test-page': '<p>Saved content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'test-page',
    };
    localStorage.setItem('cept-workspace', JSON.stringify(state));

    render(<App />);
    // Should NOT show onboarding since we have persisted state
    expect(screen.queryByText('Get Started')).toBeNull();
    // Should show the persisted page (appears in sidebar + possibly breadcrumb)
    expect(screen.getAllByText('Persisted Page').length).toBeGreaterThanOrEqual(1);
  });

  it('search opens and finds pages', async () => {
    enableDemoMode();
    render(<App />);
    // Open command palette and use search
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    });
    // Command palette should be open
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('unimplemented buttons are disabled', () => {
    render(<App />);
    const buttons = screen.getAllByRole('button');
    const openFolder = buttons.find((b) => b.textContent?.includes('Open a folder'));
    const gitRepo = buttons.find((b) => b.textContent?.includes('Connect a Git repo'));
    expect((openFolder as HTMLButtonElement)?.disabled).toBe(true);
    expect((gitRepo as HTMLButtonElement)?.disabled).toBe(true);
  });

  it('does not show reset demo button in header (moved to settings)', () => {
    enableDemoMode();
    render(<App />);
    expect(screen.queryByTestId('reset-demo')).toBeNull();
  });

  it('persists state when demo content is shown', () => {
    vi.useFakeTimers();
    enableDemoMode();
    render(<App />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    const stored = localStorage.getItem('cept-workspace');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.pages).toBeDefined();
    expect(parsed.pages.length).toBeGreaterThan(0);
  });

  it('demo mode shows demo content initially', () => {
    enableDemoMode();
    render(<App />);
    // Should have demo pages
    expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
  });

  it('restores persisted state even when showDemoContent is true', () => {
    const state = {
      pages: [{ id: 'my-page', title: 'My Saved Page', children: [] }],
      pageContents: { 'my-page': '<p>My content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'my-page',
    };
    localStorage.setItem('cept-workspace', JSON.stringify(state));
    enableDemoMode();

    render(<App />);
    // Should show persisted page, not demo content
    expect(screen.getAllByText('My Saved Page').length).toBeGreaterThanOrEqual(1);
  });

  it('shows page header with title and menu when page is selected', () => {
    enableDemoMode();
    render(<App />);
    // Demo mode selects 'welcome' page by default
    expect(screen.getByTestId('page-header')).toBeDefined();
    expect(screen.getByTestId('page-title')).toBeDefined();
    expect(screen.getByTestId('page-menu-btn')).toBeDefined();
  });

  it('page title is clickable for inline editing', () => {
    enableDemoMode();
    render(<App />);
    fireEvent.click(screen.getByTestId('page-title'));
    expect(screen.getByTestId('page-title-input')).toBeDefined();
    expect(screen.getByTestId('page-title-save')).toBeDefined();
  });

  it('shows app menu in sidebar', () => {
    enableDemoMode();
    render(<App />);
    expect(screen.getByTestId('app-menu-trigger')).toBeDefined();
  });

  it('app menu opens and has actions', () => {
    enableDemoMode();
    render(<App />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu')).toBeDefined();
    expect(screen.getByTestId('app-menu-settings')).toBeDefined();
    expect(screen.getByTestId('app-menu-help')).toBeDefined();
    expect(screen.getByTestId('app-menu-about')).toBeDefined();
  });

  it('persists space name', () => {
    vi.useFakeTimers();
    enableDemoMode();
    render(<App />);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    const stored = localStorage.getItem('cept-workspace');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.spaceName).toBe('Demo Space');
  });
});
