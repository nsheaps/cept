/**
 * Git token auths — zero or more credentials, one per git account (REQ-AUTH-019).
 *
 * The host (the web app) supplies a `GitAuths` built from `GitAuthRegistry`
 * and its own stores, because ui never picks a storage mechanism. The provider
 * lists the auths (without tokens), checks them once at startup (`restore`)
 * and offers add, rename, replace-token and remove. It also publishes the
 * first working GitHub auth through `useGitHubAccount`, so code that only
 * needs "the" GitHub account (cloning, creating a repository) keeps working.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { GITHUB_HOST } from '@cept/core';
import type {
  AddGitAuthInput,
  GitAuth,
  GitAuthRecord,
  HttpAuth,
  PatAccount,
  RepoInfo,
  RestoreResult,
} from '@cept/core';
import { GitHubAccountContext } from './github-account.js';
import type { GitHubAccountState, GitHubAccountStatus } from './github-account.js';

/** The part of `GitAuthRegistry` the UI uses. */
export interface GitAuths {
  /** Check the saved auths. Rejects only on a storage failure. */
  restore(): Promise<RestoreResult>;
  list(): Promise<GitAuthRecord[]>;
  add(input: AddGitAuthInput): Promise<GitAuthRecord>;
  remove(id: string): Promise<void>;
  rename(id: string, label: string): Promise<GitAuthRecord>;
  replaceToken(id: string, token: string): Promise<GitAuthRecord>;
  /** Git-over-HTTPS credentials for the auth. Rejects when its token is gone. */
  httpAuth(id: string): Promise<HttpAuth>;
  /** The repositories the auth's GitHub account can see. */
  repos?(id: string): Promise<RepoInfo[]>;
  /** Create a repository owned by the auth's GitHub account, with a first commit. */
  createRepo?(
    id: string,
    options: { name: string; description?: string; private?: boolean },
  ): Promise<RepoInfo>;
}

/** `checking`: the saved auths are being checked; `ready`: the list is current. */
export type GitAuthsStatus = 'checking' | 'ready';

export interface GitAuthsState {
  status: GitAuthsStatus;
  /** Every saved auth, without tokens, oldest first. */
  auths: GitAuthRecord[];
  /** Ids of auths whose host could not be reached at startup, so their token is unchecked. */
  unreachable: string[];
  /** Check `input.token` and save it. Rejects with the reason, saving nothing. */
  add(input: AddGitAuthInput): Promise<GitAuthRecord>;
  remove(id: string): Promise<void>;
  rename(id: string, label: string): Promise<void>;
  /** Give a rejected auth a new token. */
  replaceToken(id: string, token: string): Promise<void>;
  /** Credentials for git over HTTPS with this auth, or undefined when it has no token. */
  gitAuthFor(id: string): Promise<GitAuth | undefined>;
  /** The repositories this GitHub auth can see; absent when the host cannot list them. */
  listReposFor?(id: string): Promise<RepoInfo[]>;
  createRepoFor?(
    id: string,
    options: { name: string; description?: string; private?: boolean },
  ): Promise<RepoInfo>;
}

const GitAuthsContext = createContext<GitAuthsState | null>(null);

/** The first GitHub auth whose token GitHub accepted: the default for GitHub work. */
export function defaultGitHubAuth(auths: readonly GitAuthRecord[]): GitAuthRecord | null {
  return auths.find((a) => a.host === GITHUB_HOST && a.status === 'ok') ?? null;
}

function toGitAuth(credentials: HttpAuth): GitAuth | undefined {
  return credentials.password
    ? { username: credentials.username || 'x-access-token', password: credentials.password }
    : undefined;
}

export function GitAuthsProvider({
  auths,
  children,
}: {
  auths: GitAuths | null;
  children: ReactNode;
}) {
  const [records, setRecords] = useState<GitAuthRecord[]>([]);
  const [unreachable, setUnreachable] = useState<string[]>([]);
  const [status, setStatus] = useState<GitAuthsStatus>(auths ? 'checking' : 'ready');

  // One restore per host object: StrictMode runs the effect twice, and both runs share this check.
  const restoring = useRef<{ auths: GitAuths; check: Promise<RestoreResult> } | null>(null);

  useEffect(() => {
    if (!auths) return;
    let current = true;
    if (restoring.current?.auths !== auths) restoring.current = { auths, check: auths.restore() };
    restoring.current.check.then(
      (result) => {
        if (!current) return;
        setRecords(result.records);
        setUnreachable(result.unreachable);
        setStatus('ready');
      },
      () => {
        // The index could not be read: show what is there and let the user retry later.
        if (!current) return;
        void auths.list().then(
          (list) => current && setRecords(list),
          () => undefined,
        );
        setStatus('ready');
      },
    );
    return () => {
      current = false;
    };
  }, [auths]);

  const refresh = useCallback(async () => {
    if (auths) setRecords(await auths.list());
  }, [auths]);

  const add = useCallback(
    async (input: AddGitAuthInput) => {
      if (!auths) throw new Error('This host does not support git sign-in.');
      const record = await auths.add(input);
      await refresh();
      return record;
    },
    [auths, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!auths) return;
      await auths.remove(id);
      await refresh();
    },
    [auths, refresh],
  );

  const rename = useCallback(
    async (id: string, label: string) => {
      if (!auths) return;
      await auths.rename(id, label);
      await refresh();
    },
    [auths, refresh],
  );

  const replaceToken = useCallback(
    async (id: string, token: string) => {
      if (!auths) return;
      await auths.replaceToken(id, token);
      setUnreachable((ids) => ids.filter((x) => x !== id));
      await refresh();
    },
    [auths, refresh],
  );

  // Asks the store, not `status`, so a clone during the startup check still uses the token.
  const gitAuthFor = useCallback(
    async (id: string): Promise<GitAuth | undefined> => {
      if (!auths) return undefined;
      const credentials = await auths.httpAuth(id).catch(() => null);
      return credentials ? toGitAuth(credentials) : undefined;
    },
    [auths],
  );

  const state = useMemo((): GitAuthsState | null => {
    if (!auths) return null;
    const value: GitAuthsState = {
      status,
      auths: records,
      unreachable,
      add,
      remove,
      rename,
      replaceToken,
      gitAuthFor,
    };
    const list = auths.repos?.bind(auths);
    if (list) value.listReposFor = (id) => list(id);
    const create = auths.createRepo?.bind(auths);
    if (create) value.createRepoFor = (id, options) => create(id, options);
    return value;
  }, [auths, status, records, unreachable, add, remove, rename, replaceToken, gitAuthFor]);

  // The first GitHub auth, in the shape the rest of the app already knows.
  const github = useMemo((): GitHubAccountState | null => {
    if (!state) return null;
    const chosen = defaultGitHubAuth(records);
    const account: PatAccount | null =
      chosen?.account && chosen.grants ? { ...chosen.account, grants: chosen.grants } : null;
    const hasUnverified = records.some((a) => a.host === GITHUB_HOST && unreachable.includes(a.id));
    const githubStatus: GitHubAccountStatus =
      status === 'checking'
        ? 'checking'
        : account
          ? 'signed-in'
          : hasUnverified
            ? 'unverified'
            : 'signed-out';
    // An unreachable GitHub auth still has a token to clone with.
    const gitHubRecord =
      chosen ?? records.find((a) => a.host === GITHUB_HOST && unreachable.includes(a.id)) ?? null;
    const value: GitHubAccountState = {
      status: githubStatus,
      account,
      async signIn(token) {
        await add({ token });
      },
      async signOut() {
        if (gitHubRecord) await remove(gitHubRecord.id);
      },
      gitAuth: () => (gitHubRecord ? gitAuthFor(gitHubRecord.id) : Promise.resolve(undefined)),
    };
    if (gitHubRecord && state.listReposFor) {
      const list = state.listReposFor;
      value.listRepos = () => list(gitHubRecord.id);
    }
    if (gitHubRecord && state.createRepoFor) {
      const create = state.createRepoFor;
      value.createRepo = (options) => create(gitHubRecord.id, options);
    }
    return value;
  }, [state, records, unreachable, status, add, remove, gitAuthFor]);

  return (
    <GitAuthsContext.Provider value={state}>
      <GitHubAccountContext.Provider value={github}>{children}</GitHubAccountContext.Provider>
    </GitAuthsContext.Provider>
  );
}

/** The saved git auths, or null when this host offers no git sign-in. */
export function useGitAuths(): GitAuthsState | null {
  return useContext(GitAuthsContext);
}
