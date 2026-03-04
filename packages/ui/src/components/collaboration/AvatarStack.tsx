/**
 * AvatarStack — Displays a horizontal stack of user avatars for
 * collaborators currently viewing a document.
 *
 * Shows up to `maxVisible` avatars with a "+N" overflow indicator.
 * Each avatar is a colored circle with the user's initial and an
 * optional tooltip showing their name.
 */

import React, { useMemo } from 'react';
import type { AwarenessUser } from '@cept/core';

export interface AvatarStackProps {
  /** Connected users to display */
  users: AwarenessUser[];
  /** Current user id (shown with a ring indicator) */
  currentUserId?: string;
  /** Maximum visible avatars before "+N". Default: 5 */
  maxVisible?: number;
  /** Avatar size in pixels. Default: 32 */
  size?: number;
  /** Called when an avatar is clicked */
  onUserClick?: (user: AwarenessUser) => void;
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function AvatarStack({
  users,
  currentUserId,
  maxVisible = 5,
  size = 32,
  onUserClick,
}: AvatarStackProps): React.ReactElement {
  const visible = useMemo(() => users.slice(0, maxVisible), [users, maxVisible]);
  const overflow = users.length - maxVisible;

  return (
    <div
      className="cept-avatar-stack"
      style={{ display: 'flex', alignItems: 'center' }}
      data-testid="avatar-stack"
    >
      {visible.map((user) => {
        const isCurrent = user.id === currentUserId;
        return (
          <button
            key={user.id}
            className="cept-avatar"
            data-testid={`avatar-${user.id}`}
            title={user.name}
            onClick={() => onUserClick?.(user)}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: user.color,
              color: getContrastColor(user.color),
              border: isCurrent ? '2px solid currentColor' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: size * 0.4,
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: visible.indexOf(user) > 0 ? -size * 0.25 : 0,
              position: 'relative',
              padding: 0,
            }}
          >
            {getInitial(user.name)}
            {user.cursor !== undefined && (
              <span
                className="cept-avatar-cursor-indicator"
                data-testid={`cursor-indicator-${user.id}`}
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  border: '1px solid white',
                }}
              />
            )}
          </button>
        );
      })}
      {overflow > 0 && (
        <span
          className="cept-avatar-overflow"
          data-testid="avatar-overflow"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#6b7280',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.35,
            fontWeight: 600,
            marginLeft: -size * 0.25,
          }}
        >
          +{overflow}
        </span>
      )}
      {users.length === 0 && (
        <span className="cept-avatar-empty" data-testid="avatar-empty">
          No collaborators
        </span>
      )}
    </div>
  );
}
