import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { AuthToken } from '@cept/core';
import { EncryptedTokenStore, KEY_ID, KEY_STORE } from './token-store.js';

const TOKEN: AuthToken = {
  accessToken: 'ghp_storeSecret0123456789abcdefABCDEF',
  scopes: ['repo'],
  expiresAt: 1_900_000_000_000,
};

let dbCount = 0;
const freshName = () => `cept-test-auth-${++dbCount}`;

/** Every value stored in the database, as raw records. */
async function rawRecords(name: string): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const out: unknown[] = [];
  for (const storeName of Array.from(db.objectStoreNames)) {
    const all = await new Promise<unknown[]>((resolve, reject) => {
      const req = db.transaction(storeName).objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
      req.onerror = () => reject(req.error);
    });
    out.push(...all);
  }
  db.close();
  return out;
}

/** Swaps the store's encryption key for a fresh one. */
async function replaceKey(name: string): Promise<void> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Flattens a stored record into text, decoding any bytes it holds. */
function asText(value: unknown): string {
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(value);
  if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(asText)
      .join('|');
  }
  return String(value);
}

describe('EncryptedTokenStore', () => {
  it('round-trips a token, also through a new store on the same database', async () => {
    const name = freshName();
    await new EncryptedTokenStore(name).set('github', TOKEN);
    expect(await new EncryptedTokenStore(name).get('github')).toEqual(TOKEN);
  });

  it('returns null for a key it never stored', async () => {
    expect(await new EncryptedTokenStore(freshName()).get('github')).toBeNull();
  });

  it('keeps tokens apart by key and overwrites on set', async () => {
    const store = new EncryptedTokenStore(freshName());
    await store.set('a', TOKEN);
    await store.set('b', { accessToken: 'other', scopes: [] });
    await store.set('a', { ...TOKEN, scopes: ['repo', 'read:org'] });
    expect((await store.get('a'))?.scopes).toEqual(['repo', 'read:org']);
    expect((await store.get('b'))?.accessToken).toBe('other');
  });

  it('deletes a token', async () => {
    const store = new EncryptedTokenStore(freshName());
    await store.set('github', TOKEN);
    await store.delete('github');
    expect(await store.get('github')).toBeNull();
    await store.delete('never-set');
  });

  it('stores only ciphertext, under a key that cannot be exported', async () => {
    const name = freshName();
    await new EncryptedTokenStore(name).set('github', TOKEN);

    const records = await rawRecords(name);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(asText(record)).not.toContain('storeSecret');
    }
    const key = records.find((r) => r instanceof CryptoKey) as CryptoKey | undefined;
    expect(key?.extractable).toBe(false);
    expect(key?.algorithm.name).toBe('AES-GCM');
  });

  it('drops a token it can no longer decrypt instead of failing', async () => {
    const name = freshName();
    await new EncryptedTokenStore(name).set('github', TOKEN);
    // A different key (as after the browser lost the old one) cannot read the old ciphertext.
    await replaceKey(name);

    const store = new EncryptedTokenStore(name);
    expect(await store.get('github')).toBeNull();
    expect((await rawRecords(name)).filter((r) => !(r instanceof CryptoKey))).toEqual([]);
  });
});
