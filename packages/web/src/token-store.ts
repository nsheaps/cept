/**
 * EncryptedTokenStore — the web `TokenStore` (REQ-AUTH-012).
 *
 * Tokens are kept in IndexedDB, encrypted with AES-GCM under a key that is
 * generated in the browser as non-extractable: script can use it to encrypt
 * and decrypt, but cannot read its bytes, so the database alone (a copied
 * profile, a backup) does not reveal the token.
 */

import type { AuthToken, TokenStore } from '@cept/core';

/** Object store holding the one encryption key, and that key's id. */
export const KEY_STORE = 'keys';
export const KEY_ID = 'token-key';
/** Object store holding encrypted tokens by `TokenStore` key. */
const TOKEN_STORE = 'tokens';

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

export class EncryptedTokenStore implements TokenStore {
  private db: Promise<IDBDatabase> | null = null;
  private key: Promise<CryptoKey> | null = null;

  constructor(private readonly dbName = 'cept-auth') {}

  async get(key: string): Promise<AuthToken | null> {
    const sealed = await this.request<Sealed | undefined>(TOKEN_STORE, 'readonly', (s) =>
      s.get(key),
    );
    if (!sealed) return null;
    try {
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: sealed.iv },
        await this.cryptoKey(),
        sealed.data,
      );
      return JSON.parse(new TextDecoder().decode(plain)) as AuthToken;
    } catch {
      // Sealed under a key this browser no longer has: unreadable, so drop it and sign out.
      await this.delete(key);
      return null;
    }
  }

  async set(key: string, token: AuthToken): Promise<void> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await this.cryptoKey(),
      new TextEncoder().encode(JSON.stringify(token)),
    );
    const sealed: Sealed = { iv, data };
    await this.request(TOKEN_STORE, 'readwrite', (s) => s.put(sealed, key));
  }

  async delete(key: string): Promise<void> {
    await this.request(TOKEN_STORE, 'readwrite', (s) => s.delete(key));
  }

  /** The stored key, or a new non-extractable one saved for next time. */
  private cryptoKey(): Promise<CryptoKey> {
    this.key ??= (async () => {
      const existing = await this.request<CryptoKey | undefined>(KEY_STORE, 'readonly', (s) =>
        s.get(KEY_ID),
      );
      if (existing) return existing;
      const created = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]);
      // `add` fails if another tab saved a key first; that key then wins.
      try {
        await this.request(KEY_STORE, 'readwrite', (s) => s.add(created, KEY_ID));
        return created;
      } catch {
        const winner = await this.request<CryptoKey | undefined>(KEY_STORE, 'readonly', (s) =>
          s.get(KEY_ID),
        );
        if (!winner) throw new Error('EncryptedTokenStore: could not save an encryption key');
        return winner;
      }
    })();
    this.key.catch(() => {
      this.key = null;
    });
    return this.key;
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(KEY_STORE);
        req.result.createObjectStore(TOKEN_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('EncryptedTokenStore: open failed'));
    });
    this.db.catch(() => {
      this.db = null;
    });
    return this.db;
  }

  private async request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const req = run(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(req.result as T);
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error('EncryptedTokenStore: failed'));
      tx.onabort = () => reject(tx.error ?? new Error('EncryptedTokenStore: aborted'));
    });
  }
}
