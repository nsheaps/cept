/**
 * CursorOverlay — Renders remote user cursors and selections in the editor.
 *
 * Displays colored cursor lines and selection highlights for each
 * collaborator with an active cursor position. Shows a small name
 * label above each cursor.
 */

import React, { useMemo } from 'react';
import type { AwarenessUser } from '@cept/core';

export interface CursorData {
  user: AwarenessUser;
  /** Cursor line position (top offset in pixels) */
  top: number;
  /** Cursor horizontal position (left offset in pixels) */
  left: number;
  /** Selection highlight if anchor !== head */
  selection?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface CursorOverlayProps {
  /** Remote cursors to render */
  cursors: CursorData[];
  /** Current user id (excluded from display) */
  currentUserId?: string;
}

export function CursorOverlay({
  cursors,
  currentUserId,
}: CursorOverlayProps): React.ReactElement {
  const remoteCursors = useMemo(
    () => cursors.filter((c) => c.user.id !== currentUserId),
    [cursors, currentUserId],
  );

  return (
    <div
      className="cept-cursor-overlay"
      data-testid="cursor-overlay"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
    >
      {remoteCursors.map((cursor) => (
        <div
          key={cursor.user.id}
          className="cept-remote-cursor"
          data-testid={`cursor-${cursor.user.id}`}
        >
          {/* Selection highlight */}
          {cursor.selection && (
            <div
              className="cept-cursor-selection"
              data-testid={`selection-${cursor.user.id}`}
              style={{
                position: 'absolute',
                top: cursor.selection.top,
                left: cursor.selection.left,
                width: cursor.selection.width,
                height: cursor.selection.height,
                backgroundColor: cursor.user.color,
                opacity: 0.2,
                borderRadius: 2,
              }}
            />
          )}
          {/* Cursor line */}
          <div
            className="cept-cursor-line"
            data-testid={`cursor-line-${cursor.user.id}`}
            style={{
              position: 'absolute',
              top: cursor.top,
              left: cursor.left,
              width: 2,
              height: 20,
              backgroundColor: cursor.user.color,
            }}
          />
          {/* Name label */}
          <div
            className="cept-cursor-label"
            data-testid={`cursor-label-${cursor.user.id}`}
            style={{
              position: 'absolute',
              top: cursor.top - 18,
              left: cursor.left,
              backgroundColor: cursor.user.color,
              color: '#ffffff',
              fontSize: 11,
              padding: '1px 4px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              lineHeight: '14px',
            }}
          >
            {cursor.user.name}
          </div>
        </div>
      ))}
    </div>
  );
}
