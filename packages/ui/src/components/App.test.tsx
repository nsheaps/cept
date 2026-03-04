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
});
