import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GraphAnimationPlayer } from './GraphAnimationPlayer.js';
import type { TimestampedNode } from './graph-animation.js';
import type { GraphLink } from './graph-types.js';

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

const nodes: TimestampedNode[] = [
  { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z' },
  { id: 'c', title: 'C', createdAt: '2026-01-03T00:00:00Z' },
];

const links: GraphLink[] = [
  { source: 'a', target: 'b', type: 'parent' },
  { source: 'b', target: 'c', type: 'mention' },
];

describe('GraphAnimationPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('renders the player', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('graph-animation-player')).toBeDefined();
  });

  it('renders controls', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('graph-animation-controls')).toBeDefined();
    expect(screen.getByTestId('graph-animation-play')).toBeDefined();
    expect(screen.getByTestId('graph-animation-reset')).toBeDefined();
    expect(screen.getByTestId('graph-animation-scrubber')).toBeDefined();
  });

  it('shows play button initially', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('graph-animation-play').textContent).toBe('Play');
  });

  it('toggles to pause when playing', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    fireEvent.click(screen.getByTestId('graph-animation-play'));
    expect(screen.getByTestId('graph-animation-play').textContent).toBe('Pause');
  });

  it('advances frames when playing', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} intervalMs={100} frameCount={5} />);
    fireEvent.click(screen.getByTestId('graph-animation-play'));

    act(() => {
      vi.advanceTimersByTime(150);
    });

    const scrubber = screen.getByTestId('graph-animation-scrubber') as HTMLInputElement;
    expect(Number(scrubber.value)).toBeGreaterThan(0);
  });

  it('resets to frame 0', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} frameCount={5} />);
    const scrubber = screen.getByTestId('graph-animation-scrubber') as HTMLInputElement;

    // Manually advance
    fireEvent.change(scrubber, { target: { value: '3' } });
    expect(Number(scrubber.value)).toBe(3);

    fireEvent.click(screen.getByTestId('graph-animation-reset'));
    expect(Number(scrubber.value)).toBe(0);
  });

  it('shows node count', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('graph-animation-counter').textContent).toContain('nodes');
  });

  it('shows time label', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('graph-animation-time').textContent).toBeTruthy();
  });

  it('renders empty message when no timestamps', () => {
    const undated = [{ id: 'x', title: 'X' }];
    render(<GraphAnimationPlayer nodes={undated} links={[]} />);
    expect(screen.getByTestId('graph-animation-empty')).toBeDefined();
  });

  it('scrubber allows manual frame selection', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} frameCount={5} />);
    const scrubber = screen.getByTestId('graph-animation-scrubber') as HTMLInputElement;
    fireEvent.change(scrubber, { target: { value: '2' } });
    expect(Number(scrubber.value)).toBe(2);
  });

  it('renders knowledge graph inside player', () => {
    render(<GraphAnimationPlayer nodes={nodes} links={links} />);
    expect(screen.getByTestId('knowledge-graph')).toBeDefined();
  });
});
