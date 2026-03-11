import { useState, useCallback } from 'react';

interface PreviewToastProps {
  prNumber: string;
  repoUrl: string;
  productionUrl: string;
}

/**
 * Persistent toast notification shown on preview deployments.
 * Links to the source PR and the production deployment.
 */
export function PreviewToast({
  prNumber,
  repoUrl,
  productionUrl,
}: PreviewToastProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (!prNumber || dismissed) return null;

  const prUrl = `${repoUrl}/pull/${prNumber}`;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="preview-toast"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.5rem',
        backgroundColor: '#1a2e1a',
        color: '#e0e0e0',
        fontSize: '0.875rem',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}
    >
      <span>
        Preview for{' '}
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#90caf9', textDecoration: 'underline' }}
        >
          PR #{prNumber}
        </a>
        {productionUrl && (
          <>
            {' '}
            &middot;{' '}
            <a
              href={productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#90caf9', textDecoration: 'underline' }}
            >
              View production
            </a>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0 0.25rem',
        }}
      >
        &times;
      </button>
    </div>
  );
}
