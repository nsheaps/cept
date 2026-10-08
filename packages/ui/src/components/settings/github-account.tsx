/**
 * GitHub account — sign-in with a personal access token (REQ-AUTH-005).
 *
 * The host (the web app) supplies the PAT auth, built from `PatAuthProvider`
 * and its own token store, because ui never picks a storage mechanism. The
 * provider checks the saved token once at startup (`restore`), so the account
 * is known before Settings opens. Without a host auth, no GitHub section is
 * shown.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PatAccount } from '@cept/core';

/** The part of `PatAuthProvider` the UI uses. */
export interface PatAuth {
  signIn(token: string): Promise<PatAccount>;
  /** The saved token's account; null when none is saved or GitHub rejects it. Rejects when offline. */
  restore(): Promise<PatAccount | null>;
  logout(): Promise<void>;
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

  useEffect(() => {
    if (!auth) return;
    let current = true;
    auth.restore().then(
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

  const value = useMemo(
    () => (auth ? { status, account, signIn, signOut } : null),
    [auth, status, account, signIn, signOut],
  );
  return <GitHubAccountContext.Provider value={value}>{children}</GitHubAccountContext.Provider>;
}

/** The GitHub account, or null when this host offers no GitHub sign-in. */
export function useGitHubAccount(): GitHubAccountState | null {
  return useContext(GitHubAccountContext);
}
