import { useState, useEffect, useCallback, useRef } from 'react';

interface PreviewToastProps {
  prNumber: string;
  repoUrl: string;
  productionUrl: string;
  /** Auto-dismiss delay in ms. Defaults to 15000 (15s). */
  dismissMs?: number;
}

const DEFAULT_DISMISS_MS = 15_000;
const CIRCLE_RADIUS = 10;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

/**
 * Toast notification shown on preview deployments.
 * Links to the source PR and the production deployment.
 * Auto-dismisses with a circular countdown indicator around the close button.
 */
export function PreviewToast({
  prNumber,
  repoUrl,
  productionUrl,
  dismissMs = DEFAULT_DISMISS_MS,
}: PreviewToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (!prNumber || dismissed) return;

    // Kick off the CSS animation after a frame so the transition starts
    const frame = requestAnimationFrame(() => setAnimating(true));

    timerRef.current = setTimeout(handleDismiss, dismissMs);

    return () => {
      cancelAnimationFrame(frame);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [prNumber, dismissed, dismissMs, handleDismiss]);

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
        data-testid="preview-toast-dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: 0,
          position: 'relative',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Countdown ring */}
        <svg
          data-testid="countdown-ring"
          width="24"
          height="24"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'rotate(-90deg)',
          }}
        >
          <circle
            cx="12"
            cy="12"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="#888"
            strokeWidth="2"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={animating ? CIRCLE_CIRCUMFERENCE : 0}
            style={{
              transition: animating
                ? `stroke-dashoffset ${dismissMs}ms linear`
                : 'none',
            }}
          />
        </svg>
        {/* X label */}
        <span aria-hidden="true" style={{ position: 'relative', zIndex: 1 }}>
          &times;
        </span>
      </button>
    </div>
  );
}
