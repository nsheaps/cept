import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage.js';

describe('NotFoundPage', () => {
  it('shows the path that was not found and goes back on request', () => {
    const onGoHome = vi.fn();
    render(<NotFoundPage path="/s/default/Missing.md" onGoHome={onGoHome} />);

    expect(screen.getByText('Page not found')).toBeDefined();
    expect(screen.getByTestId('not-found-path').textContent).toBe('/s/default/Missing.md');
    fireEvent.click(screen.getByTestId('not-found-home'));
    expect(onGoHome).toHaveBeenCalledOnce();
  });
});
