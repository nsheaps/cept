import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacklinksPanel } from './BacklinksPanel.js';

describe('BacklinksPanel', () => {
  it('lists the pages that link here with their link text', () => {
    render(
      <BacklinksPanel
        backlinks={[
          { source: 'b.md', title: 'Page B', snippets: ['see A', 'A again'] },
          { source: 'c.md', title: 'Page C', snippets: [] },
        ]}
        onNavigate={() => undefined}
      />,
    );
    expect(screen.getByTestId('backlinks-count').textContent).toContain('2 backlinks');
    expect(screen.getByTestId('backlink-b.md').textContent).toContain('Page B');
    expect(screen.getByTestId('backlink-b.md').textContent).toContain('see A');
    expect(screen.getByTestId('backlink-b.md').textContent).toContain('A again');
    expect(screen.getByTestId('backlink-c.md').textContent).toContain('Page C');
  });

  it('opens a linking page when it is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <BacklinksPanel
        backlinks={[{ source: 'b.md', title: 'Page B', snippets: ['x'] }]}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByTestId('backlinks-count').textContent).toContain('1 backlink');
    fireEvent.click(screen.getByTestId('backlink-b.md'));
    expect(onNavigate).toHaveBeenCalledWith('b.md');
  });

  it('renders nothing when no page links here', () => {
    const { container } = render(<BacklinksPanel backlinks={[]} onNavigate={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
