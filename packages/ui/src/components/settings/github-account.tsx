/**
 * GitHub account — sign-in with a personal access token (REQ-AUTH-005).
 *
 * The host (the web app) supplies the PAT auth, built from `PatAuthProvider`
 * and its own token store, because ui never picks a storage mechanism. The
 * provider checks the saved token once at startup (`restore`), so the account
 * is known before Settings opens. Without a host auth, no GitHub section is
 * shown.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { GitAuth, HttpAuth, PatAccount } from '@cept/core';

/** The part of `PatAuthProvider` the UI uses. */
export interface PatAuth {
  signIn(token: string): Promise<PatAccount>;
  /** The saved token's account; null when none is saved or GitHub rejects it. Rejects when offline. */
  restore(): Promise<PatAccount | null>;
  logout(): Promise<void>;
  /** Git-over-HTTPS credentials for the saved token. Rejects when none is saved. */
  getHttpAuth(): Promise<HttpAuth>;
}

/**
 * `checking`: the saved token is being checked; `signed-out`; `signed-in`;
 * `unverified`: a token is saved but GitHub could not be reached to check it.
 */
export type GitHubAccountStatus = 'checking' | 'signed-out' | 'signed-in' | 'unverified';

export interface GitHubAccountState {
  status: GitHubAccountStatus;
  account: PatAccount | null;
  /** Check `token` with GitHub and save it. Rejects with the reason, saving nothing. */
  signIn(token: string): Promise<void>;
  /** Forget the saved token. */
  signOut(): Promise<void>;
  /**
   * Credentials for cloning and fetching from GitHub with the saved token, or
   * undefined when signed out (an anonymous clone).
   */
  gitAuth(): Promise<GitAuth | undefined>;
}

const GitHubAccountContext = createContext<GitHubAccountState | null>(null);

export function GitHubAccountProvider({
  auth,
  children,
}: {
  auth: PatAuth | null;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<GitHubAccountStatus>(auth ? 'checking' : 'signed-out');
  const [account, setAccount] = useState<PatAccount | null>(null);

  // One restore per auth: StrictMode runs the effect twice, and both runs share this check.
  const restoring = useRef<{ auth: PatAuth; check: Promise<PatAccount | null> } | null>(null);

  useEffect(() => {
    if (!auth) return;
    let current = true;
    if (restoring.current?.auth !== auth) restoring.current = { auth, check: auth.restore() };
    restoring.current.check.then(
      (restored) => {
        if (!current) return;
        setAccount(restored);
        setStatus(restored ? 'signed-in' : 'signed-out');
      },
      () => {
        // Offline (or GitHub unreachable): keep the token, check again next start.
        if (current) setStatus('unverified');
      },
    );
    return () => {
      current = false;
    };
  }, [auth]);

  const signIn = useCallback(
    async (token: string) => {
      if (!auth) return;
      const signedIn = await auth.signIn(token);
      setAccount(signedIn);
      setStatus('signed-in');
    },
    [auth],
  );

  const signOut = useCallback(async () => {
    if (!auth) return;
    await auth.logout();
    setAccount(null);
    setStatus('signed-out');
  }, [auth]);

  // Asks the store, not `status`, so a clone during the startup check still uses the token.
  const gitAuth = useCallback(async (): Promise<GitAuth | undefined> => {
    if (!auth) return undefined;
    const credentials = await auth.getHttpAuth().catch(() => null);
    return credentials?.password
      ? { username: 'x-access-token', password: credentials.password }
      : undefined;
  }, [auth]);

  const value = useMemo(
    () => (auth ? { status, account, signIn, signOut, gitAuth } : null),
    [auth, status, account, signIn, signOut, gitAuth],
  );
  return <GitHubAccountContext.Provider value={value}>{children}</GitHubAccountContext.Provider>;
}

/** The GitHub account, or null when this host offers no GitHub sign-in. */
export function useGitHubAccount(): GitHubAccountState | null {
  return useContext(GitHubAccountContext);
}
