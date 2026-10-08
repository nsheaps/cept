/**
 * Persistent browser storage (REQ-WEB-004). Browser spaces and GitHub clones
 * live in IndexedDB, which the browser may clear under storage pressure unless
 * the origin's storage is persistent. When a space is created the app asks for
 * persistent storage and warns when the browser refuses or when little room is
 * left.
 */

/** The part of `navigator.storage` this module uses. */
export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

/** Warn when less than this is left of the quota. */
export const LOW_QUOTA_BYTES = 50 * 1024 * 1024;
/** Warn when this share of the quota is used. */
export const LOW_QUOTA_RATIO = 0.9;

export type StorageWarning =
  { kind: 'not-persistent' } | { kind: 'low-quota'; usage: number; quota: number };

/** `navigator.storage`, or null where the browser has none. */
export function browserStorageManager(): StorageManagerLike | null {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) return null;
  return (navigator.storage as StorageManagerLike | undefined) ?? null;
}

/**
 * Ask for persistent storage unless it is already granted, and report what
 * the user should hear about. A `persist()` that throws counts as a refusal;
 * any other call that throws, or that the browser lacks, is treated as
 * unknown and warns about nothing.
 */
export async function checkStoragePersistence(
  storage: StorageManagerLike | null = browserStorageManager(),
): Promise<StorageWarning[]> {
  if (!storage) return [];
  const warnings: StorageWarning[] = [];

  let persistent: boolean | undefined;
  try {
    persistent = storage.persisted ? await storage.persisted() : undefined;
  } catch {
    // Unknown; still ask below.
  }
  if (persistent !== true && storage.persist) {
    try {
      persistent = await storage.persist();
    } catch {
      // A request that throws is as good as a refusal.
      persistent = false;
    }
  }
  if (persistent === false) warnings.push({ kind: 'not-persistent' });

  try {
    const estimate = storage.estimate ? await storage.estimate() : undefined;
    const usage = estimate?.usage;
    const quota = estimate?.quota;
    if (usage !== undefined && quota !== undefined && quota > 0) {
      if (quota - usage < LOW_QUOTA_BYTES || usage / quota >= LOW_QUOTA_RATIO) {
        warnings.push({ kind: 'low-quota', usage, quota });
      }
    }
  } catch {
    // Unknown: say nothing.
  }

  return warnings;
}

/** The message shown for a warning. */
export function storageWarningText(warning: StorageWarning): string {
  if (warning.kind === 'not-persistent') {
    return 'This browser may clear your spaces when it runs low on storage. Link spaces to GitHub, or install Cept as an app, to keep them safe.';
  }
  return `Browser storage is almost full: ${formatBytes(warning.usage)} of ${formatBytes(warning.quota)} used. Free some room or link spaces to GitHub so nothing is lost.`;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
