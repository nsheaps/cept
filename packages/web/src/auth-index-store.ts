/**
 * The secret-free list of git auths, kept in localStorage (REQ-AUTH-019).
 *
 * It holds ids, hosts, labels and statuses, never a token (those are in the
 * encrypted token store), so localStorage is fine. A missing or damaged entry
 * reads as "no auths".
 */

import type { AuthIndexStore, GitAuthRecord } from '@cept/core';

const STATUSES: readonly unknown[] = ['ok', 'unchecked', 'rejected'];

/** A saved entry with the fields the registry relies on; anything else is dropped. */
function isRecord(value: unknown): value is GitAuthRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['host'] === 'string' &&
    typeof r['label'] === 'string' &&
    STATUSES.includes(r['status'])
  );
}

export class LocalStorageAuthIndexStore implements AuthIndexStore {
  constructor(
    private readonly key: string,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  ) {}

  async load(): Promise<GitAuthRecord[]> {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
    } catch {
      return [];
    }
  }

  async save(records: readonly GitAuthRecord[]): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(records));
  }
}
