import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KnowledgeGraphView } from './KnowledgeGraphView.js';
import type { GraphData } from './graph-types.js';

// Mock D3 — the KnowledgeGraph component uses it internally
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
    each: vi.fn().mockReturnThis(),
  };
  return {
    select: vi.fn(() => selection),
    zoom: vi.fn(() => ({
      scaleExtent: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    forceSimulation: vi.fn(() => ({
      force: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      alphaTarget: vi.fn().mockReturnThis(),
      restart: vi.fn(),
      stop: vi.fn(),
    })),
    forceLink: vi.fn(() => ({
      id: vi.fn().mockReturnThis(),
      distance: vi.fn().mockReturnThis(),
    })),
    forceManyBody: vi.fn(() => ({
      strength: vi.fn().mockReturnThis(),
    })),
    forceCenter: vi.fn(),
    forceCollide: vi.fn(() => ({
      radius: vi.fn().mockReturnThis(),
    })),
    drag: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
    })),
  };
});

const sampleData: GraphData = {
  nodes: [
    { id: 'a', title: 'Node A' },
    { id: 'b', title: 'Node B' },
    { id: 'c', title: 'Node C' },
    { id: 'd', title: 'Node D' },
  ],
  links: [
    { source: 'a', target: 'b', type: 'parent' },
    { source: 'b', target: 'c', type: 'mention' },
    { source: 'c', target: 'd', type: 'mention' },
  ],
};

describe('KnowledgeGraphView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the view container', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.getByTestId('knowledge-graph-view')).toBeDefined();
  });

  it('renders the toolbar', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.getByTestId('graph-toolbar')).toBeDefined();
  });

  it('renders mode toggle buttons', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.getByTestId('graph-mode-global')).toBeDefined();
    expect(screen.getByTestId('graph-mode-local')).toBeDefined();
  });

  it('starts in global mode by default', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    const globalBtn = screen.getByTestId('graph-mode-global');
    expect(globalBtn.className).toContain('is-active');
  });

  it('starts in specified initialMode', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" />);
    const localBtn = screen.getByTestId('graph-mode-local');
    expect(localBtn.className).toContain('is-active');
  });

  it('disables local button when no focus node', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    const localBtn = screen.getByTestId('graph-mode-local') as HTMLButtonElement;
    expect(localBtn.disabled).toBe(true);
  });

  it('shows depth slider in local mode', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" />);
    expect(screen.getByTestId('graph-depth-control')).toBeDefined();
    expect(screen.getByTestId('graph-depth-slider')).toBeDefined();
  });

  it('does not show depth slider in global mode', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.queryByTestId('graph-depth-control')).toBeNull();
  });

  it('shows focus node label in local mode', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" />);
    expect(screen.getByTestId('graph-focus-label').textContent).toContain('Node A');
  });

  it('updates depth when slider changes', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" initialDepth={2} />);
    const slider = screen.getByTestId('graph-depth-slider') as HTMLInputElement;
    expect(screen.getByTestId('graph-depth-value').textContent).toBe('2');

    fireEvent.change(slider, { target: { value: '4' } });
    expect(screen.getByTestId('graph-depth-value').textContent).toBe('4');
  });

  it('renders labels toggle', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.getByTestId('graph-labels-toggle')).toBeDefined();
  });

  it('labels toggle defaults to checked', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    const toggle = screen.getByTestId('graph-labels-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('toggles labels checkbox', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    const toggle = screen.getByTestId('graph-labels-toggle') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
  });

  it('shows back-to-global button in local mode', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" />);
    expect(screen.getByTestId('graph-back-to-global')).toBeDefined();
  });

  it('switches to global when back button clicked', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" />);
    fireEvent.click(screen.getByTestId('graph-back-to-global'));

    const globalBtn = screen.getByTestId('graph-mode-global');
    expect(globalBtn.className).toContain('is-active');
    expect(screen.queryByTestId('graph-depth-control')).toBeNull();
  });

  it('renders the knowledge graph component', () => {
    render(<KnowledgeGraphView data={sampleData} />);
    expect(screen.getByTestId('knowledge-graph')).toBeDefined();
  });

  it('respects maxDepth prop on slider', () => {
    render(<KnowledgeGraphView data={sampleData} initialMode="local" initialFocusNodeId="a" maxDepth={8} />);
    const slider = screen.getByTestId('graph-depth-slider') as HTMLInputElement;
    expect(slider.max).toBe('8');
  });
});
