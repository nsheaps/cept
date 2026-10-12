/**
 * The "Signed in with" row of a git space's details (REQ-AUTH-020): which saved
 * auth the space uses, a menu to switch to another auth for the same host, and
 * the way out when the space's auth was removed or rejected.
 */

import type { GitAuthRecord } from '@cept/core';
import { lostAuthMessage, resolveSpaceAuth } from '../storage/space-auth.js';
import { authsForHost, hostOfRepoUrl } from './GitAuthPicker.js';

export interface SpaceAuthRowProps {
  /** The auth the space is bound to; absent for a space made before auths could be chosen. */
  authId?: string;
  remoteUrl: string;
  auths: readonly GitAuthRecord[];
  onChange: (authId: string) => void;
}

export function SpaceAuthRow({ authId, remoteUrl, auths, onChange }: SpaceAuthRowProps) {
  const host = hostOfRepoUrl(remoteUrl);
  const choices = authsForHost(auths, host);
  const resolved = resolveSpaceAuth(authId === undefined ? {} : { authId }, auths);
  const current = resolved.kind === 'auth' ? resolved.auth : undefined;
  const lost = resolved.kind === 'lost' ? resolved : undefined;
  // A single working auth that is already in use leaves nothing to choose.
  const canChoose = choices.length > 1 || (lost !== undefined && choices.length > 0);

  return (
    <div className="cept-settings-detail-row" data-testid="space-auth">
      <span className="cept-settings-detail-label">Signed in with</span>
      <span className="cept-settings-detail-value">
        {canChoose ? (
          <select
            className="cept-wizard-input"
            value={current?.id ?? ''}
            aria-label="Signed in with"
            onChange={(e) => e.target.value && onChange(e.target.value)}
            data-testid="space-auth-select"
          >
            {current ? null : (
              <option value="" disabled>
                Choose a token…
              </option>
            )}
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        ) : current ? (
          <span data-testid="space-auth-current">{current.label}</span>
        ) : (
          <span data-testid="space-auth-none">
            {lost ? null : 'No token (public access only). '}
            Add a token for {host} under Settings → Auth.
          </span>
        )}
        {lost && (
          <span
            className="cept-settings-github-error"
            role="alert"
            data-testid="space-auth-lost"
            style={{ display: 'block' }}
          >
            {lostAuthMessage(lost.reason)}
          </span>
        )}
      </span>
    </div>
  );
}
