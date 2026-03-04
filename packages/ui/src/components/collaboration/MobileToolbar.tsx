/**
 * MobileToolbar — Condensed editing toolbar for mobile viewports.
 *
 * Renders a fixed-bottom toolbar with formatting actions
 * sized for touch interaction. Only visible at mobile breakpoint.
 */

import React, { useCallback } from 'react';

export interface MobileToolbarAction {
  /** Unique action identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon character or short text */
  icon: string;
  /** Whether the action is currently active */
  active?: boolean;
  /** Whether the action is disabled */
  disabled?: boolean;
}

export interface MobileToolbarProps {
  /** Available actions */
  actions: MobileToolbarAction[];
  /** Callback when action is tapped */
  onAction: (actionId: string) => void;
  /** Whether the toolbar is visible */
  visible?: boolean;
}

export function MobileToolbar({
  actions,
  onAction,
  visible = true,
}: MobileToolbarProps): React.ReactElement | null {
  const handleAction = useCallback(
    (id: string) => {
      onAction(id);
    },
    [onAction],
  );

  if (!visible) return null;

  return (
    <div
      className="cept-mobile-toolbar"
      role="toolbar"
      aria-label="Formatting"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        padding: '8px 4px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        background: 'var(--cept-toolbar-bg, #fff)',
        borderTop: '1px solid var(--cept-border, #e0e0e0)',
        zIndex: 100,
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          className="cept-mobile-toolbar-btn"
          type="button"
          role="button"
          aria-label={action.label}
          aria-pressed={action.active ?? false}
          disabled={action.disabled}
          onClick={() => handleAction(action.id)}
          style={{
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: '6px',
            background: action.active ? 'var(--cept-active-bg, #e8e8e8)' : 'transparent',
            fontSize: '18px',
            cursor: action.disabled ? 'default' : 'pointer',
            opacity: action.disabled ? 0.4 : 1,
            padding: '4px 8px',
          }}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
