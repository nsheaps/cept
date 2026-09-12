import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage.js';

describe('NotFoundPage', () => {
  const defaultProps = {
    onGoHome: vi.fn(),
    onGoToDocs: vi.fn(),
  };

  it('renders 404 heading', () => {
    render(<NotFoundPage {...defaultProps} />);
    expect(screen.getByText('404')).toBeDefined();
    expect(screen.getByText('Page not found')).toBeDefined();
  });

  it('shows path when provided', () => {
    render(<NotFoundPage {...defaultProps} path="/g/example.com/repo/blob/main/missing.md" />);
    expect(screen.getByTestId('not-found-path')).toBeDefined();
    expect(screen.getByTestId('not-found-path').textContent).toContain('missing.md');
  });

  it('shows message when provided', () => {
    render(<NotFoundPage {...defaultProps} message="Repository not found" />);
    expect(screen.getByTestId('not-found-message').textContent).toBe('Repository not found');
  });

  it('hides path and message when not provided', () => {
    render(<NotFoundPage {...defaultProps} />);
    expect(screen.queryByTestId('not-found-path')).toBeNull();
    expect(screen.queryByTestId('not-found-message')).toBeNull();
  });

  it('calls onGoHome when home button clicked', () => {
    const onGoHome = vi.fn();
    render(<NotFoundPage {...defaultProps} onGoHome={onGoHome} />);
    screen.getByTestId('not-found-go-home').click();
    expect(onGoHome).toHaveBeenCalled();
  });

  it('calls onGoToDocs when docs button clicked', () => {
    const onGoToDocs = vi.fn();
    render(<NotFoundPage {...defaultProps} onGoToDocs={onGoToDocs} />);
    screen.getByTestId('not-found-go-docs').click();
    expect(onGoToDocs).toHaveBeenCalled();
  });

  it('shows back button when onGoBack provided', () => {
    const onGoBack = vi.fn();
    render(<NotFoundPage {...defaultProps} onGoBack={onGoBack} />);
    expect(screen.getByTestId('not-found-go-back')).toBeDefined();
    screen.getByTestId('not-found-go-back').click();
    expect(onGoBack).toHaveBeenCalled();
  });

  it('hides back button when onGoBack not provided', () => {
    render(<NotFoundPage {...defaultProps} />);
    expect(screen.queryByTestId('not-found-go-back')).toBeNull();
  });
});
