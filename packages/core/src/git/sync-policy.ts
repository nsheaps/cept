/**
 * Git sync policy (REQ-WS-027): who commits are attributed to, which branch a
 * space tracks, and the per-device sync settings that are never committed.
 */

import { z } from 'zod';
import type { StorageBackend } from '../storage/backend.js';
import type { SpaceConfig } from '../space/config.js';

/** The name and email a commit is attributed to. */
export interface CommitIdentity {
  name: string;
  email: string;
}

/** The fields of GitHub's `GET /user` reply the identity needs. */
export interface GitHubUserIdentity {
  login: string;
  /** The numeric account id; GitHub always sends it. */
  id?: number;
  name?: string | null;
}

/**
 * The commit author (and committer) for a signed-in GitHub account: its display
 * name, or its login when it has none, and its GitHub noreply address
 * (`<id>+<login>@users.noreply.github.com`). The account's real email address
 * is never used. Without an id, the older `<login>@users.noreply.github.com`
 * form is used, which GitHub still attributes to the account.
 */
export function commitIdentityFor(user: GitHubUserIdentity): CommitIdentity {
  const name = user.name?.trim() || user.login;
  const local = user.id === undefined ? user.login : `${user.id}+${user.login}`;
  return { name, email: `${local}@users.noreply.github.com` };
}

/**
 * The branch a space tracks: the `branch:` in its `space.cept.yaml`, otherwise
 * the repository's default branch. Cept never switches branch on its own.
 */
export function trackedBranch(
  config: Pick<SpaceConfig, 'branch'> | null | undefined,
  defaultBranch: string,
): string {
  const declared = config?.branch?.trim();
  return declared ? declared : defaultBranch;
}

/** Where a space keeps its per-device sync settings, relative to the space root. */
export const SYNC_SETTINGS_PATH = '.cept/sync.local.json';

/**
 * The `.git/info/exclude` line that keeps every space's settings file out of
 * commits. Exclude lines follow gitignore rules, where a pattern with a `/` in
 * the middle matches only from the repository root. The leading `**` segment
 * makes it match in spaces kept in sub-folders too.
 */
export const SYNC_SETTINGS_EXCLUDE = '**/.cept/sync.local.json';

/** Sync settings that differ per device and are never committed. */
export interface SyncSettings {
  /** Commit edits automatically. */
  autoCommit: boolean;
  /** Milliseconds without edits before an automatic commit. */
  debounceMs: number;
  /** Milliseconds between pull-then-push cycles. */
  intervalMs: number;
  /** Push after each successful pull. */
  autoPush: boolean;
}

export const DEFAULT_SYNC_SETTINGS: Readonly<SyncSettings> = Object.freeze({
  autoCommit: true,
  debounceMs: 5000,
  intervalMs: 30000,
  autoPush: true,
});

const syncSettingsSchema = z.object({
  autoCommit: z.boolean().optional(),
  debounceMs: z.number().int().min(500).max(600_000).optional(),
  intervalMs: z.number().int().min(5000).max(86_400_000).optional(),
  autoPush: z.boolean().optional(),
});

/**
 * Parse a settings file. Missing, unreadable or out-of-range values fall back to
 * the defaults one by one, so a damaged file never stops sync.
 */
export function parseSyncSettings(text: string | null | undefined): SyncSettings {
  if (!text) return { ...DEFAULT_SYNC_SETTINGS };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ...DEFAULT_SYNC_SETTINGS };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_SYNC_SETTINGS };
  }
  const settings: SyncSettings = { ...DEFAULT_SYNC_SETTINGS };
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SYNC_SETTINGS) as (keyof SyncSettings)[]) {
    const one = syncSettingsSchema.shape[key].safeParse(record[key]);
    if (one.success && one.data !== undefined) {
      (settings as unknown as Record<string, unknown>)[key] = one.data;
    }
  }
  return settings;
}

export function serializeSyncSettings(settings: SyncSettings): string {
  const { autoCommit, debounceMs, intervalMs, autoPush } = settings;
  return `${JSON.stringify({ autoCommit, debounceMs, intervalMs, autoPush }, null, 2)}\n`;
}

function settingsPath(spaceRoot: string): string {
  const root = spaceRoot.replace(/^\/+|\/+$/g, '');
  return root ? `${root}/${SYNC_SETTINGS_PATH}` : SYNC_SETTINGS_PATH;
}

/** Read a space's per-device sync settings, or the defaults. */
export async function loadSyncSettings(
  backend: StorageBackend,
  spaceRoot = '',
): Promise<SyncSettings> {
  const bytes = await backend.readFile(settingsPath(spaceRoot));
  return parseSyncSettings(bytes ? new TextDecoder().decode(bytes) : null);
}

/** Write a space's per-device sync settings. */
export async function saveSyncSettings(
  backend: StorageBackend,
  settings: SyncSettings,
  spaceRoot = '',
): Promise<void> {
  await backend.writeFile(
    settingsPath(spaceRoot),
    new TextEncoder().encode(serializeSyncSettings(settings)),
  );
}

/**
 * The text of an exclude file (`.git/info/exclude`) with `pattern` on a line of
 * its own. Returns the text unchanged when the line is already there.
 */
export function withExcludeLine(text: string, pattern: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  if (lines.includes(pattern)) return text;
  const base = text === '' || text.endsWith('\n') ? text : `${text}\n`;
  return `${base}${pattern}\n`;
}
