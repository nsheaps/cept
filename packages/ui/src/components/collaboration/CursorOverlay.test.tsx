import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CursorOverlay } from './CursorOverlay.js';
import type { CursorData } from './CursorOverlay.js';

function makeCursor(id: string, name: string, top = 100, left = 50): CursorData {
  return {
    user: { id, name, color: '#3b82f6' },
    top,
    left,
  };
}

describe('CursorOverlay', () => {
  it('renders empty overlay with no cursors', () => {
    render(<CursorOverlay cursors={[]} />);
    const overlay = screen.getByTestId('cursor-overlay');
    expect(overlay).toBeDefined();
    expect(overlay.children).toHaveLength(0);
  });

  it('renders cursor line for remote user', () => {
    render(<CursorOverlay cursors={[makeCursor('u1', 'Alice')]} />);
    expect(screen.getByTestId('cursor-line-u1')).toBeDefined();
  });

  it('renders name label for remote user', () => {
    render(<CursorOverlay cursors={[makeCursor('u1', 'Alice')]} />);
    const label = screen.getByTestId('cursor-label-u1');
    expect(label.textContent).toBe('Alice');
  });

  it('positions cursor at specified coordinates', () => {
    render(<CursorOverlay cursors={[makeCursor('u1', 'Alice', 200, 150)]} />);
    const line = screen.getByTestId('cursor-line-u1');
    expect(line.style.top).toBe('200px');
    expect(line.style.left).toBe('150px');
  });

  it('excludes current user from display', () => {
    render(
      <CursorOverlay
        cursors={[makeCursor('u1', 'Alice'), makeCursor('u2', 'Bob')]}
        currentUserId="u1"
      />,
    );
    expect(screen.queryByTestId('cursor-u1')).toBeNull();
    expect(screen.getByTestId('cursor-u2')).toBeDefined();
  });

  it('renders selection highlight when present', () => {
    const cursor: CursorData = {
      user: { id: 'u1', name: 'Alice', color: '#3b82f6' },
      top: 100,
      left: 50,
      selection: { top: 100, left: 50, width: 200, height: 20 },
    };
    render(<CursorOverlay cursors={[cursor]} />);
    expect(screen.getByTestId('selection-u1')).toBeDefined();
  });

  it('does not render selection when absent', () => {
    render(<CursorOverlay cursors={[makeCursor('u1', 'Alice')]} />);
    expect(screen.queryByTestId('selection-u1')).toBeNull();
  });

  it('applies user color to cursor line', () => {
    const cursor: CursorData = {
      user: { id: 'u1', name: 'Alice', color: '#ff0000' },
      top: 100,
      left: 50,
    };
    render(<CursorOverlay cursors={[cursor]} />);
    const line = screen.getByTestId('cursor-line-u1');
    expect(line.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('applies user color to name label background', () => {
    const cursor: CursorData = {
      user: { id: 'u1', name: 'Alice', color: '#ff0000' },
      top: 100,
      left: 50,
    };
    render(<CursorOverlay cursors={[cursor]} />);
    const label = screen.getByTestId('cursor-label-u1');
    expect(label.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('renders multiple remote cursors', () => {
    const cursors = [
      makeCursor('u1', 'Alice', 100, 50),
      makeCursor('u2', 'Bob', 200, 150),
      makeCursor('u3', 'Carol', 300, 250),
    ];
    render(<CursorOverlay cursors={cursors} />);
    expect(screen.getByTestId('cursor-u1')).toBeDefined();
    expect(screen.getByTestId('cursor-u2')).toBeDefined();
    expect(screen.getByTestId('cursor-u3')).toBeDefined();
  });

  it('overlay has pointer-events none', () => {
    render(<CursorOverlay cursors={[]} />);
    const overlay = screen.getByTestId('cursor-overlay');
    expect(overlay.style.pointerEvents).toBe('none');
  });
});
