/**
 * LoadingSpinner — Shows a loading indicator.
 *
 * Provides both a spinner and a skeleton loader for
 * different loading contexts.
 */

import React from 'react';

export interface LoadingSpinnerProps {
  /** Size in pixels. Default: 24 */
  size?: number;
  /** Label for accessibility */
  label?: string;
}

export function LoadingSpinner({
  size = 24,
  label = 'Loading',
}: LoadingSpinnerProps): React.ReactElement {
  return (
    <div
      className="cept-loading-spinner"
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{ animation: 'cept-spin 1s linear infinite' }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.25"
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="cept-sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {label}
      </span>
    </div>
  );
}

export interface EmptyStateProps {
  /** Icon or illustration */
  icon?: string;
  /** Primary message */
  title: string;
  /** Secondary description */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps): React.ReactElement {
  return (
    <div
      className="cept-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        textAlign: 'center',
        color: 'var(--cept-text-secondary, #888)',
      }}
    >
      {icon && (
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      )}
      <h3 style={{ margin: '0 0 0.5rem', color: 'var(--cept-text-primary, #333)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0 0 1rem', maxWidth: '300px' }}>{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          className="cept-empty-state-action"
          onClick={onAction}
          style={{
            padding: '0.5rem 1.5rem',
            border: '1px solid var(--cept-border, #ddd)',
            borderRadius: '6px',
            background: 'var(--cept-bg-primary, #fff)',
            color: 'var(--cept-text-primary, #333)',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
