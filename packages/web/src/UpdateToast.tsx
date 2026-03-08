import { useState, useEffect, useCallback } from 'react';

interface UpdateToastProps {
  version: string;
  visible: boolean;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

/**
 * Toast notification shown after the app reloads due to a service worker update.
 * Displays the current version and auto-dismisses after a few seconds.
 */
export function UpdateToast({ version, visible, onDismiss }: UpdateToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      // Small delay so the enter animation plays
      const frame = requestAnimationFrame(() => setShow(true));
      const timer = setTimeout(() => {
        setShow(false);
        // Wait for exit animation before fully dismissing
        setTimeout(onDismiss, 300);
      }, AUTO_DISMISS_MS);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }
    setShow(false);
  }, [visible, onDismiss]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: `translateX(-50%) translateY(${show ? '0' : '1rem'})`,
        opacity: show ? 1 : 0,
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        borderRadius: '0.5rem',
        backgroundColor: '#1a1a2e',
        color: '#e0e0e0',
        fontSize: '0.875rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}
    >
      <span>App updated to v{version}</span>
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
        ×
      </button>
    </div>
  );
}
