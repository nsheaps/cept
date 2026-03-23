import { useState, useCallback, useRef, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function Toast({ messages, onDismiss }: ToastProps) {
  if (messages.length === 0) return null;

  return (
    <div className="cept-toast-container" data-testid="toast-container">
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(message.id), 5000);
    return () => clearTimeout(timerRef.current);
  }, [message.id, onDismiss]);

  return (
    <div
      className={`cept-toast cept-toast--${message.type}`}
      data-testid={`toast-${message.id}`}
      role="status"
    >
      <span className="cept-toast-text">{message.text}</span>
      <button
        className="cept-toast-close"
        onClick={() => onDismiss(message.id)}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Hook providing toast notification state management.
 */
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setMessages((prev) => [...prev, { id, text, type }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { messages, addToast, dismissToast };
}
