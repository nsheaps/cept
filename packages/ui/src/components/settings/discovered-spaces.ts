/**
 * Discovered spaces: the spaces in every repository the signed-in personal
 * access token can read (REQ-WS-023, REQ-AUTH-014, D-30).
 *
 * Discovery (`autodiscoverSpaces` in `@cept/core`) only reads markers; nothing
 * is cloned until the user opens or pins a space. The last result is kept per
 * account in `localStorage`, so the list shows at once on the next start while
 * a fresh discovery runs, and spaces found earlier can be flagged when access
 * to them is lost. Signing out forgets every kept list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { autodiscoverSpaces, MemoryEtagCache } from '@cept/core';
import type {
  AutodiscoveryOptions,
  AutodiscoveryResult,
  AutodiscoveryWarning,
  LostSpace,
  RemoteSpace,
} from '@cept/core';
import { generateRemoteSpaceId } from '../storage/SpaceManager.js';
import { normalizeRepoUrl } from '../storage/git-space.js';
import { useGitHubAccount } from './github-account.js';

/** One account's last discovery, as kept between starts. */
export interface DiscoverySnapshot {
  login: string;
  spaces: RemoteSpace[];
  lost: LostSpace[];
  warnings: AutodiscoveryWarning[];
  complete: boolean;
  /** When the discovery finished (ISO 8601). */
  checkedAt: string;
}

const KEY_PREFIX = 'cept-discovered-spaces:';

function storageKey(login: string): string {
  return `${KEY_PREFIX}${login.toLowerCase()}`;
}

/** The kept discovery for `login`, or null when there is none or it cannot be read. */
export function loadDiscovery(login: string): DiscoverySnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(login));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DiscoverySnapshot>;
    if (!Array.isArray(parsed.spaces) || !Array.isArray(parsed.lost)) return null;
    return {
      login,
      spaces: parsed.spaces,
      lost: parsed.lost,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      complete: parsed.complete !== false,
      checkedAt: typeof parsed.checkedAt === 'string' ? parsed.checkedAt : '',
    };
  } catch {
    return null;
  }
}

export function saveDiscovery(snapshot: DiscoverySnapshot): void {
  try {
    localStorage.setItem(storageKey(snapshot.login), JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked: the list is found again next time.
  }
}

/** Forget every account's kept discovery. */
export function clearDiscoveries(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Nothing kept, or storage blocked.
  }
}

/** The id the space gets in the space list once opened or pinned. */
export function discoveredSpaceId(space: RemoteSpace): string {
  return generateRemoteSpaceId(normalizeRepoUrl(space.url), space.branch, space.path || undefined);
}

/**
 * The spaces to compare a new discovery against: those found last time, and
 * those already lost, so a space stays flagged until access comes back.
 */
export function previousSpaces(snapshot: DiscoverySnapshot | null): RemoteSpace[] {
  if (!snapshot) return [];
  const byId = new Map<string, RemoteSpace>();
  for (const space of [...snapshot.spaces, ...snapshot.lost.map((l) => l.space)])
    byId.set(discoveredSpaceId(space), space);
  return [...byId.values()];
}

export type DiscoveryStatus = 'idle' | 'running' | 'done' | 'error';

export interface DiscoveredSpacesState {
  status: DiscoveryStatus;
  /** The latest result, or the kept one while a discovery runs; null before the first. */
  snapshot: DiscoverySnapshot | null;
  error: string | null;
  /** Discover again. */
  refresh(): void;
}

export type Discover = (options: AutodiscoveryOptions) => Promise<AutodiscoveryResult>;

// ETags per account for this session, so an unchanged repository costs a 304.
const etagCaches = new Map<string, MemoryEtagCache>();

function etagCacheFor(login: string): MemoryEtagCache {
  const key = login.toLowerCase();
  let cache = etagCaches.get(key);
  if (!cache) {
    cache = new MemoryEtagCache();
    etagCaches.set(key, cache);
  }
  return cache;
}

/**
 * Discovered spaces for the signed-in account, or null when no account is
 * signed in. Discovery runs when the account signs in (including when a saved
 * token is restored at start) and on `refresh()`.
 */
export function useDiscoveredSpaces(
  options: { discover?: Discover } = {},
): DiscoveredSpacesState | null {
  const github = useGitHubAccount();
  const discover = options.discover ?? autodiscoverSpaces;
  const status = github?.status;
  const login = status === 'signed-in' ? (github?.account?.login ?? null) : null;
  const gitAuth = github?.gitAuth;

  const [state, setState] = useState<{
    login: string | null;
    status: DiscoveryStatus;
    snapshot: DiscoverySnapshot | null;
    error: string | null;
  }>({ login: null, status: 'idle', snapshot: null, error: null });
  const [runs, setRuns] = useState(0);
  const discoverRef = useRef(discover);
  discoverRef.current = discover;

  // Signing out forgets the kept lists: they name the account's repositories.
  useEffect(() => {
    if (status === 'signed-out') clearDiscoveries();
  }, [status]);

  useEffect(() => {
    if (!login || !gitAuth) return;
    const kept = loadDiscovery(login);
    setState({ login, status: 'running', snapshot: kept, error: null });
    const controller = new AbortController();

    void (async () => {
      try {
        const token = (await gitAuth())?.password;
        if (!token) throw new Error('No saved token to look for spaces with.');
        const result = await discoverRef.current({
          token,
          cache: etagCacheFor(login),
          previous: previousSpaces(kept),
          signal: controller.signal,
        });
        const snapshot: DiscoverySnapshot = {
          login,
          spaces: result.spaces,
          lost: result.lost,
          warnings: result.warnings,
          complete: result.complete,
          checkedAt: new Date().toISOString(),
        };
        if (controller.signal.aborted) return;
        saveDiscovery(snapshot);
        setState({ login, status: 'done', snapshot, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        const error = err instanceof Error ? err.message : 'Could not look for spaces.';
        setState({ login, status: 'error', snapshot: kept, error });
      }
    })();

    return () => controller.abort();
  }, [login, gitAuth, runs]);

  const refresh = useCallback(() => setRuns((n) => n + 1), []);

  if (!login) return null;
  // Until the effect for a new account runs, show nothing from another account.
  if (state.login !== login)
    return { status: 'running', snapshot: loadDiscovery(login), error: null, refresh };
  return { status: state.status, snapshot: state.snapshot, error: state.error, refresh };
}
