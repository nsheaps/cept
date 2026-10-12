/**
 * Which git auth a space uses (REQ-AUTH-019, REQ-WS-027).
 *
 * A space bound to an auth keeps using that account. It never falls back to
 * another account when its auth is removed or rejected, because edits would
 * then be pushed as someone the user did not choose. A space with no auth
 * chosen (one made before auths could be picked) uses the first working
 * GitHub auth, as it always did.
 */

import type { GitAuthRecord } from '@cept/core';
import { defaultGitHubAuth } from '../settings/git-auths.js';

export type SpaceAuthResolution =
  | { kind: 'auth'; auth: GitAuthRecord }
  /** No auth is chosen and no GitHub auth works: anonymous access only. */
  | { kind: 'none' }
  /** The auth the space is bound to cannot be used; the user must pick another. */
  | { kind: 'lost'; authId: string; reason: 'removed' | 'rejected' };

export function resolveSpaceAuth(
  space: { authId?: string },
  records: readonly GitAuthRecord[],
): SpaceAuthResolution {
  if (space.authId === undefined) {
    const auth = defaultGitHubAuth(records);
    return auth ? { kind: 'auth', auth } : { kind: 'none' };
  }
  const auth = records.find((a) => a.id === space.authId);
  if (!auth) return { kind: 'lost', authId: space.authId, reason: 'removed' };
  if (auth.status === 'rejected') return { kind: 'lost', authId: space.authId, reason: 'rejected' };
  return { kind: 'auth', auth };
}

/** What to tell the user when a space's auth cannot be used. */
export function lostAuthMessage(reason: 'removed' | 'rejected'): string {
  return reason === 'removed'
    ? 'The token this space was added with has been removed. Choose another under Settings → Auth, or add it again.'
    : 'The host no longer accepts the token this space uses. Replace it under Settings → Auth.';
}
