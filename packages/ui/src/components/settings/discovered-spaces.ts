/**
 * Discovered spaces: the spaces in every repository the saved GitHub tokens
 * can read (REQ-WS-023, REQ-AUTH-014, REQ-AUTH-020, D-30). Each account is
 * searched once, however many tokens it has; a space reachable through several
 * tokens is listed once with all of them.
 *
 * Discovery (`autodiscoverSpaces` in `@cept/core`) only reads markers; nothing
 * is cloned until the user opens or pins a space. The last result is kept per
 * account in `localStorage`, so the list shows at once on the next start while
 * a fresh discovery runs, and spaces found earlier can be flagged when access
 * to them is lost. Signing out forgets every kept list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autodiscoverSpaces, GITHUB_HOST, MemoryEtagCache } from '@cept/core';
import type {
  AutodiscoveryOptions,
  AutodiscoveryResult,
  AutodiscoveryWarning,
  GitAuthRecord,
  LostSpace,
  RemoteSpace,
} from '@cept/core';
import { generateRemoteSpaceId } from '../storage/SpaceManager.js';
import { normalizeRepoUrl } from '../storage/git-space.js';
import { useGitHubAccount } from './github-account.js';
import { useGitAuths } from './git-auths.js';

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
  /** The latest result (every account merged), or the kept one while a discovery runs; null before the first. */
  snapshot: DiscoverySnapshot | null;
  /** Ids of the auths that can read each space, by `discoveredSpaceId`; the first found it first. */
  reachedBy: Readonly<Record<string, readonly string[]>>;
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

/** One GitHub account to search, and the saved auths that sign in as it. */
interface Target {
  login: string;
  authIds: string[];
}

/** The accounts of the working GitHub auths, in the order the auths were saved. */
function targetsOf(auths: readonly GitAuthRecord[]): Target[] {
  const byLogin = new Map<string, Target>();
  for (const auth of auths) {
    if (auth.host !== GITHUB_HOST || auth.status !== 'ok' || !auth.account) continue;
    const key = auth.account.login.toLowerCase();
    const target = byLogin.get(key);
    if (target) target.authIds.push(auth.id);
    else byLogin.set(key, { login: auth.account.login, authIds: [auth.id] });
  }
  return [...byLogin.values()];
}

interface AccountResult {
  status: DiscoveryStatus;
  snapshot: DiscoverySnapshot | null;
  error: string | null;
}

/** Every account's snapshot as one list; a space one account lost but another reads is not lost. */
function mergeSnapshots(targets: readonly Target[], results: Record<string, AccountResult>) {
  const spaces = new Map<string, RemoteSpace>();
  const reachedBy: Record<string, string[]> = {};
  const lost = new Map<string, LostSpace>();
  const warnings: AutodiscoveryWarning[] = [];
  const warningSeen = new Set<string>();
  let complete = true;
  let checkedAt = '';
  let any = false;
  for (const target of targets) {
    const snapshot = results[target.login.toLowerCase()]?.snapshot;
    if (!snapshot) continue;
    any = true;
    for (const space of snapshot.spaces) {
      const id = discoveredSpaceId(space);
      if (!spaces.has(id)) spaces.set(id, space);
      reachedBy[id] = [...(reachedBy[id] ?? []), ...target.authIds];
    }
    for (const l of snapshot.lost) {
      const id = discoveredSpaceId(l.space);
      if (!lost.has(id)) lost.set(id, l);
    }
    for (const w of snapshot.warnings) {
      const key = JSON.stringify([w.kind, 'repo' in w ? w.repo : '', w.message]);
      if (warningSeen.has(key)) continue;
      warningSeen.add(key);
      warnings.push(w);
    }
    complete = complete && snapshot.complete;
    if (snapshot.checkedAt > checkedAt) checkedAt = snapshot.checkedAt;
  }
  for (const id of spaces.keys()) lost.delete(id);
  const merged: DiscoverySnapshot | null = any
    ? {
        login: targets[0]?.login ?? '',
        spaces: [...spaces.values()],
        lost: [...lost.values()],
        warnings,
        complete,
        checkedAt,
      }
    : null;
  return { merged, reachedBy };
}

/**
 * Discovered spaces for every saved GitHub auth, or null when none works.
 * Discovery runs when an auth is added or restored at start and on `refresh()`.
 */
export function useDiscoveredSpaces(
  options: { discover?: Discover } = {},
): DiscoveredSpacesState | null {
  const github = useGitHubAccount();
  const gitAuths = useGitAuths();
  const discover = options.discover ?? autodiscoverSpaces;
  const status = github?.status;
  const gitAuthFor = gitAuths?.gitAuthFor;

  const targets = useMemo(
    () => (status === 'signed-in' && gitAuths ? targetsOf(gitAuths.auths) : []),
    [status, gitAuths],
  );
  // The effect restarts when the set of accounts changes, not on every auth-list refresh.
  const targetsKey = targets.map((t) => t.login.toLowerCase()).join('\n');
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [results, setResults] = useState<Record<string, AccountResult>>({});
  const [runs, setRuns] = useState(0);
  const discoverRef = useRef(discover);
  discoverRef.current = discover;

  // Signing out forgets the kept lists (they name the account's repositories)
  // and the ETags.
  useEffect(() => {
    if (status !== 'signed-out') return;
    clearDiscoveries();
    etagCaches.clear();
  }, [status]);

  useEffect(() => {
    if (!gitAuthFor || targetsRef.current.length === 0) return;
    const controller = new AbortController();

    for (const target of targetsRef.current) {
      const key = target.login.toLowerCase();
      const kept = loadDiscovery(target.login);
      setResults((r) => ({ ...r, [key]: { status: 'running', snapshot: kept, error: null } }));
      void (async () => {
        try {
          let token: string | undefined;
          for (const authId of target.authIds) {
            token = (await gitAuthFor(authId))?.password;
            if (token) break;
          }
          if (!token) throw new Error('No saved token to look for spaces with.');
          const result = await discoverRef.current({
            token,
            cache: etagCacheFor(target.login),
            previous: previousSpaces(kept),
            signal: controller.signal,
          });
          const snapshot: DiscoverySnapshot = {
            login: target.login,
            spaces: result.spaces,
            lost: result.lost,
            warnings: result.warnings,
            complete: result.complete,
            checkedAt: new Date().toISOString(),
          };
          if (controller.signal.aborted) return;
          saveDiscovery(snapshot);
          setResults((r) => ({ ...r, [key]: { status: 'done', snapshot, error: null } }));
        } catch (err) {
          if (controller.signal.aborted) return;
          const error = err instanceof Error ? err.message : 'Could not look for spaces.';
          setResults((r) => ({ ...r, [key]: { status: 'error', snapshot: kept, error } }));
        }
      })();
    }

    return () => controller.abort();
  }, [targetsKey, gitAuthFor, runs]);

  const refresh = useCallback(() => setRuns((n) => n + 1), []);

  // Accounts that have not started yet show their kept list and count as running.
  const { current, view } = useMemo(() => {
    const list = targets.map(
      (t): AccountResult =>
        results[t.login.toLowerCase()] ?? {
          status: 'running',
          snapshot: loadDiscovery(t.login),
          error: null,
        },
    );
    const byLogin: Record<string, AccountResult> = {};
    targets.forEach((t, i) => {
      byLogin[t.login.toLowerCase()] = list[i]!;
    });
    return { current: list, view: mergeSnapshots(targets, byLogin) };
  }, [targets, results]);

  if (targets.length === 0) return null;
  const errors = current.flatMap((r, i) =>
    r.error ? [targets.length > 1 ? `@${targets[i]!.login}: ${r.error}` : r.error] : [],
  );
  const aggregate: DiscoveryStatus = current.some((r) => r.status === 'running')
    ? 'running'
    : errors.length === targets.length
      ? 'error'
      : 'done';
  return {
    status: aggregate,
    snapshot: view.merged,
    reachedBy: view.reachedBy,
    error: errors.length > 0 ? errors.join(' · ') : null,
    refresh,
  };
}
