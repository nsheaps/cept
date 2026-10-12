/**
 * GitAuthRegistry — zero or more git token auths (REQ-AUTH-019, D-50).
 *
 * An auth is one credential for one git host: a host, the username git sends,
 * a label and a token. The registry keeps the tokens in the host's
 * `TokenStore` (encrypted on the web, REQ-AUTH-012) and a secret-free list of
 * the auths in an `AuthIndexStore`, so the list can be shown, and spaces can
 * name an auth by id, without touching a token.
 *
 * github.com tokens are checked with `GET /user` when added and again at
 * startup (`PatAuthProvider` does that); a token GitHub rejects is deleted and
 * its auth stays listed as `rejected`, so a space that used it can say so.
 * Tokens for other hosts are saved unchecked. No error or record holds a token.
 */

import type { FetchFn, TokenStore } from './github.js';
import { PAT_STORE_KEY, PatAuthError, PatAuthProvider } from './pat.js';
import type { PatAccount, PatGrants } from './pat.js';
import type { HttpAuth, RepoInfo } from './provider.js';

export const GITHUB_HOST = 'github.com';

/** The username GitHub expects with a token over HTTPS. */
const GITHUB_USERNAME = 'x-access-token';

/**
 * `ok`: GitHub accepted the token at the last check. `unchecked`: the host is
 * not GitHub, so the token cannot be checked. `rejected`: the host refused the
 * token and it was deleted; the auth stays so its spaces can ask for another.
 */
export type GitAuthStatus = 'ok' | 'unchecked' | 'rejected';

/** The GitHub account an auth signs in as. */
export interface GitAuthAccount {
  login: string;
  id?: number;
  name: string | null;
  avatarUrl: string;
}

/** An auth without its token. */
export interface GitAuthRecord {
  id: string;
  /** Lower-case host name, `github.com` for GitHub. */
  host: string;
  /** The username git sends; `x-access-token` for GitHub. */
  username: string;
  label: string;
  status: GitAuthStatus;
  /** ISO time the auth was added. */
  createdAt: string;
  /** GitHub only: who the token signs in as. */
  account?: GitAuthAccount;
  /** GitHub only: what the token grants. */
  grants?: PatGrants;
}

/** Where the secret-free list of auths is kept (the web app uses localStorage). */
export interface AuthIndexStore {
  load(): Promise<GitAuthRecord[]>;
  save(records: readonly GitAuthRecord[]): Promise<void>;
}

export class MemoryAuthIndexStore implements AuthIndexStore {
  private records: GitAuthRecord[] = [];

  async load(): Promise<GitAuthRecord[]> {
    return structuredClone(this.records);
  }

  async save(records: readonly GitAuthRecord[]): Promise<void> {
    this.records = structuredClone([...records]);
  }
}

/** Why a registry call failed (other reasons come as `PatAuthError`). */
export type GitAuthFailure = 'invalid' | 'duplicate' | 'unknown-auth' | 'unsupported';

export class GitAuthError extends Error {
  constructor(
    readonly reason: GitAuthFailure,
    message: string,
  ) {
    super(message);
    this.name = 'GitAuthError';
  }
}

export interface GitAuthRegistryConfig {
  tokenStore: TokenStore;
  indexStore: AuthIndexStore;
  fetch?: FetchFn;
  /** GitHub REST API root, for a proxy or a test server. */
  apiBase?: string;
  /** Makes auth ids (default: `crypto.randomUUID`). */
  newId?: () => string;
  now?: () => Date;
}

export interface AddGitAuthInput {
  token: string;
  /** Default `github.com`. A scheme, path and port-less host name are accepted. */
  host?: string;
  /** Required for hosts other than github.com. */
  username?: string;
  /** Default `@login` for GitHub, else the host. */
  label?: string;
}

export interface RestoreResult {
  records: GitAuthRecord[];
  /** Auths whose host could not be reached, so their tokens were not checked. */
  unreachable: string[];
}

const tokenKey = (id: string) => `cept:auth:token:${id}`;

/** Lower-case host name from `host`, `https://host/path` or `host/path`; null when it is not one. */
export function normalizeHost(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#]/)[0]!;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/.test(host)
    ? host
    : null;
}

/** A `TokenStore` that keeps one token, whatever key it is asked for. */
function singleTokenStore(store: TokenStore, key: string): TokenStore {
  return {
    get: () => store.get(key),
    set: (_key, token) => store.set(key, token),
    delete: () => store.delete(key),
  };
}

function accountOf(account: PatAccount): GitAuthAccount {
  return {
    login: account.login,
    ...(account.id !== undefined ? { id: account.id } : {}),
    name: account.name,
    avatarUrl: account.avatarUrl,
  };
}

export class GitAuthRegistry {
  private readonly tokens: TokenStore;
  private readonly index: AuthIndexStore;
  private readonly fetchFn: FetchFn | undefined;
  private readonly apiBase: string | undefined;
  private readonly newId: () => string;
  private readonly now: () => Date;
  /** Calls run one at a time, so two tabs' worth of quick clicks cannot lose a record. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(config: GitAuthRegistryConfig) {
    this.tokens = config.tokenStore;
    this.index = config.indexStore;
    this.fetchFn = config.fetch;
    this.apiBase = config.apiBase;
    this.newId = config.newId ?? (() => globalThis.crypto.randomUUID());
    this.now = config.now ?? (() => new Date());
  }

  /** Every auth, oldest first, without tokens. */
  list(): Promise<GitAuthRecord[]> {
    return this.exclusive(() => this.index.load());
  }

  /** One auth by id, or null. */
  async get(id: string): Promise<GitAuthRecord | null> {
    return (await this.list()).find((record) => record.id === id) ?? null;
  }

  /**
   * Add an auth. A github.com token is checked with GitHub first and nothing is
   * saved if it is rejected. Adding a token that is already saved is refused;
   * the same account can have several different tokens.
   */
  add(input: AddGitAuthInput): Promise<GitAuthRecord> {
    return this.exclusive(() => this.addUnlocked(input));
  }

  /** Delete an auth and its token. Unknown ids are ignored. */
  remove(id: string): Promise<void> {
    return this.exclusive(async () => {
      await this.tokens.delete(tokenKey(id));
      const records = await this.index.load();
      await this.index.save(records.filter((record) => record.id !== id));
    });
  }

  /** Change an auth's label. */
  rename(id: string, label: string): Promise<GitAuthRecord> {
    return this.exclusive(async () => {
      const name = label.trim();
      if (!name) throw new GitAuthError('invalid', 'Give the auth a name.');
      return this.update(id, (record) => ({ ...record, label: name }));
    });
  }

  /**
   * Give an auth a new token, keeping its id (so spaces keep using it): for a
   * token that expired or was rejected. A github.com token is checked first.
   */
  replaceToken(id: string, token: string): Promise<GitAuthRecord> {
    return this.exclusive(async () => {
      const record = (await this.index.load()).find((r) => r.id === id);
      if (!record) throw new GitAuthError('unknown-auth', 'That auth no longer exists.');
      const secret = token.trim();
      if (!secret) throw new GitAuthError('invalid', 'Paste a token.');
      await this.assertNotSaved(secret, record.id);
      if (record.host === GITHUB_HOST) {
        const account = await this.pat(id).signIn(secret);
        return this.update(id, (r) => ({
          ...r,
          status: 'ok',
          account: accountOf(account),
          grants: account.grants,
        }));
      }
      await this.tokens.set(tokenKey(id), { accessToken: secret, scopes: [] });
      return this.update(id, (r) => ({ ...r, status: 'unchecked' }));
    });
  }

  /**
   * Git-over-HTTPS credentials for an auth. Rejects when the auth is unknown,
   * rejected or has no token.
   */
  async httpAuth(id: string): Promise<HttpAuth> {
    const record = await this.get(id);
    if (!record) throw new GitAuthError('unknown-auth', 'That auth no longer exists.');
    const stored = await this.tokens.get(tokenKey(id));
    if (!stored || record.status === 'rejected')
      throw new PatAuthError('invalid', `The token for ${record.label} was rejected.`);
    return { username: record.username, password: stored.accessToken, token: stored.accessToken };
  }

  /** The repositories an auth can list (github.com only). */
  repos(id: string): Promise<RepoInfo[]> {
    return this.githubProvider(id).then((pat) => pat.getRepos());
  }

  /** Create a repository owned by the auth's account (github.com only). */
  createRepo(
    id: string,
    options: { name: string; description?: string; private?: boolean },
  ): Promise<RepoInfo> {
    return this.githubProvider(id).then((pat) => pat.createRepo(options));
  }

  /**
   * Startup: move a token saved by an earlier version into the list, then
   * check every github.com token again. A token GitHub rejects is deleted and
   * its auth marked `rejected`. A host that cannot be reached leaves its auth as
   * it was (an offline start does not sign anyone out).
   */
  restore(): Promise<RestoreResult> {
    return this.exclusive(async () => {
      await this.migrateLegacy();
      const records = await this.index.load();
      const unreachable: string[] = [];
      const checked = await Promise.all(
        records.map(async (record): Promise<GitAuthRecord> => {
          if (record.host !== GITHUB_HOST) return record;
          if (record.status === 'rejected') return record;
          try {
            const account = await this.pat(record.id).restore();
            if (!account) return { ...record, status: 'rejected' };
            return { ...record, status: 'ok', account: accountOf(account), grants: account.grants };
          } catch {
            unreachable.push(record.id);
            return record;
          }
        }),
      );
      if (JSON.stringify(checked) !== JSON.stringify(records)) await this.index.save(checked);
      return { records: checked, unreachable };
    });
  }

  // -------------------------------------------------------------------------

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private pat(id: string): PatAuthProvider {
    return new PatAuthProvider({
      tokenStore: singleTokenStore(this.tokens, tokenKey(id)),
      ...(this.fetchFn ? { fetch: this.fetchFn } : {}),
      ...(this.apiBase ? { apiBase: this.apiBase } : {}),
    });
  }

  private async githubProvider(id: string): Promise<PatAuthProvider> {
    const record = await this.get(id);
    if (!record) throw new GitAuthError('unknown-auth', 'That auth no longer exists.');
    if (record.host !== GITHUB_HOST)
      throw new GitAuthError('unsupported', `${record.host} has no repository list.`);
    return this.pat(id);
  }

  private async update(
    id: string,
    change: (record: GitAuthRecord) => GitAuthRecord,
  ): Promise<GitAuthRecord> {
    const records = await this.index.load();
    const at = records.findIndex((record) => record.id === id);
    if (at === -1) throw new GitAuthError('unknown-auth', 'That auth no longer exists.');
    const updated = change(records[at]!);
    records[at] = updated;
    await this.index.save(records);
    return updated;
  }

  /** Refuse a token another auth already holds (`except` is the auth being changed). */
  private async assertNotSaved(secret: string, except?: string): Promise<void> {
    for (const record of await this.index.load()) {
      if (record.id === except) continue;
      if ((await this.tokens.get(tokenKey(record.id)))?.accessToken === secret)
        throw new GitAuthError('duplicate', `That token is already added as ${record.label}.`);
    }
  }

  private async addUnlocked(input: AddGitAuthInput): Promise<GitAuthRecord> {
    const secret = input.token.trim();
    if (!secret) throw new GitAuthError('invalid', 'Paste a token.');
    const host = normalizeHost(input.host ?? GITHUB_HOST);
    if (!host) throw new GitAuthError('invalid', 'That is not a host name.');
    const github = host === GITHUB_HOST;
    const username = github ? GITHUB_USERNAME : input.username?.trim();
    if (!username) throw new GitAuthError('invalid', `Enter the username for ${host}.`);
    await this.assertNotSaved(secret);

    const id = this.newId();
    let account: PatAccount | undefined;
    if (github) account = await this.pat(id).signIn(secret);
    else await this.tokens.set(tokenKey(id), { accessToken: secret, scopes: [] });

    const record: GitAuthRecord = {
      id,
      host,
      username,
      label: input.label?.trim() || (account ? `@${account.login}` : host),
      status: github ? 'ok' : 'unchecked',
      createdAt: this.now().toISOString(),
      ...(account ? { account: accountOf(account), grants: account.grants } : {}),
    };
    try {
      await this.index.save([...(await this.index.load()), record]);
    } catch (err) {
      await this.tokens.delete(tokenKey(id));
      throw err;
    }
    return record;
  }

  /**
   * The single token an earlier version kept under `PAT_STORE_KEY` becomes the
   * first auth. If GitHub cannot be reached it stays where it is for the next
   * start; if GitHub rejects it, it is dropped.
   */
  private async migrateLegacy(): Promise<void> {
    const legacy = await this.tokens.get(PAT_STORE_KEY);
    if (!legacy) return;
    try {
      await this.addUnlocked({ token: legacy.accessToken });
    } catch (err) {
      // Only an answer settles it; a network or server failure is tried again next start.
      const settled =
        err instanceof GitAuthError || (err instanceof PatAuthError && err.reason === 'invalid');
      if (!settled) return;
    }
    await this.tokens.delete(PAT_STORE_KEY);
  }
}
