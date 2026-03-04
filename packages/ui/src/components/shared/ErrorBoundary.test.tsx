import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary.js';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>Content</div>;
}

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeEach(() => { console.error = vi.fn(); });
afterEach(() => { console.error = originalError; });

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Hello');
  });

  it('renders default fallback on error', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('Test error');
  });

  it('renders custom fallback on error', () => {
    const { container } = render(
      <ErrorBoundary fallback={<div>Custom error</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Custom error');
  });

  it('calls onError callback', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('has alert role for accessibility', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeDefined();
  });

  it('includes try again button', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    const button = container.querySelector('button');
    expect(button).toBeDefined();
    expect(button!.textContent).toBe('Try again');
  });
});
