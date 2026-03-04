/**
 * ErrorBoundary — Catches rendering errors and shows a fallback UI.
 *
 * Wraps components to prevent the entire app from crashing
 * when a rendering error occurs in a subtree.
 */

import React from 'react';

export interface ErrorBoundaryProps {
  /** Fallback UI to show when an error occurs */
  fallback?: React.ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Child components */
  children: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="cept-error-boundary"
          role="alert"
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--cept-error-color, #dc3545)',
          }}
        >
          <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--cept-text-secondary, #666)', marginBottom: '1rem' }}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid currentColor',
              borderRadius: '4px',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
