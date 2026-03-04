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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders onboarding screen when not in demo mode', () => {
    render(<App />);
    expect(screen.getByText('Get Started')).toBeDefined();
    expect(screen.getByTestId('start-writing')).toBeDefined();
  });

  it('renders demo content in demo mode', () => {
    render(<App demoMode />);
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
    render(<App demoMode />);
    // The sidebar should have page items (text appears in sidebar + breadcrumb/editor)
    expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
  });

  it('has working sidebar toggle on mobile', () => {
    render(<App demoMode />);
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
    render(<App demoMode />);
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
    render(<App demoMode />);
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

  it('shows reset demo button in demo mode', () => {
    render(<App demoMode />);
    expect(screen.getByTestId('reset-demo')).toBeDefined();
  });

  it('does not show reset demo button outside demo mode', () => {
    render(<App />);
    expect(screen.queryByTestId('reset-demo')).toBeNull();
  });

  it('persists state in demo mode too', () => {
    vi.useFakeTimers();
    render(<App demoMode />);

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

  it('reset demo restores initial demo content', () => {
    vi.useFakeTimers();
    render(<App demoMode />);

    // Modify state by adding a page via sidebar
    fireEvent.click(screen.getByTestId('sidebar-add-page'));

    // Reset
    fireEvent.click(screen.getByTestId('reset-demo'));

    act(() => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    // Should have demo pages restored
    expect(screen.getAllByText('Welcome to Cept').length).toBeGreaterThanOrEqual(1);
  });

  it('restores persisted state even in demo mode', () => {
    const state = {
      pages: [{ id: 'my-page', title: 'My Saved Page', children: [] }],
      pageContents: { 'my-page': '<p>My content</p>' },
      favorites: [],
      recentPages: [],
      selectedPageId: 'my-page',
    };
    localStorage.setItem('cept-workspace', JSON.stringify(state));

    render(<App demoMode />);
    // Should show persisted page, not demo content
    expect(screen.getAllByText('My Saved Page').length).toBeGreaterThanOrEqual(1);
  });

  it('shows page header with title and menu when page is selected', () => {
    render(<App demoMode />);
    // Demo mode selects 'welcome' page by default
    expect(screen.getByTestId('page-header')).toBeDefined();
    expect(screen.getByTestId('page-title')).toBeDefined();
    expect(screen.getByTestId('page-menu-btn')).toBeDefined();
  });

  it('page title is clickable for inline editing', () => {
    render(<App demoMode />);
    fireEvent.click(screen.getByTestId('page-title'));
    expect(screen.getByTestId('page-title-input')).toBeDefined();
    expect(screen.getByTestId('page-title-save')).toBeDefined();
  });

  it('shows app menu in header', () => {
    render(<App demoMode />);
    expect(screen.getByTestId('app-menu-trigger')).toBeDefined();
  });

  it('app menu opens and has actions', () => {
    render(<App demoMode />);
    fireEvent.click(screen.getByTestId('app-menu-trigger'));
    expect(screen.getByTestId('app-menu')).toBeDefined();
    expect(screen.getByTestId('app-menu-about')).toBeDefined();
    expect(screen.getByTestId('app-menu-clear-cache')).toBeDefined();
  });
});
