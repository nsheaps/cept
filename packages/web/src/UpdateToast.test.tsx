import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { UpdateToast } from './UpdateToast.js';

describe('UpdateToast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    const { container } = render(
      <UpdateToast version="1.2.3" visible={false} onDismiss={() => {}} />,
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the version when visible', () => {
    render(
      <UpdateToast version="1.2.3" visible={true} onDismiss={() => {}} />,
    );
    expect(screen.getByText('App updated to v1.2.3')).toBeTruthy();
  });

  it('has an accessible role and aria-live', () => {
    render(
      <UpdateToast version="1.0.0" visible={true} onDismiss={() => {}} />,
    );
    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();

    render(
      <UpdateToast version="1.0.0" visible={true} onDismiss={onDismiss} />,
    );

    const button = screen.getByLabelText('Dismiss notification');
    fireEvent.click(button);

    // Wait for exit animation timeout (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after timeout', () => {
    const onDismiss = vi.fn();

    render(
      <UpdateToast version="1.0.0" visible={true} onDismiss={onDismiss} />,
    );

    // Advance past the auto-dismiss timeout (6000ms) + exit animation (300ms)
    act(() => {
      vi.advanceTimersByTime(6300);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
