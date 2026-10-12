/**
 * The GitHub account — the first working GitHub auth (REQ-AUTH-005).
 *
 * `GitAuthsProvider` (git-auths.tsx) fills this context from the saved git
 * auths, so code that only needs "the" GitHub account (cloning, listing and
 * creating repositories) does not have to pick an auth. Without a host that
 * offers git sign-in, the context is null and no GitHub features show.
 */

import { createContext, useContext } from 'react';
import type { GitAuth, PatAccount, RepoInfo } from '@cept/core';

/**
 * `checking`: the saved token is being checked; `signed-out`; `signed-in`;
 * `unverified`: a token is saved but GitHub could not be reached to check it.
 */
export type GitHubAccountStatus = 'checking' | 'signed-out' | 'signed-in' | 'unverified';

export interface GitHubAccountState {
  status: GitHubAccountStatus;
  account: PatAccount | null;
  /** Check `token` with GitHub and save it as a new auth. Rejects with the reason, saving nothing. */
  signIn(token: string): Promise<void>;
  /** Forget the account's auth. */
  signOut(): Promise<void>;
  /**
   * Credentials for cloning and fetching from GitHub with the saved token, or
   * undefined when signed out (an anonymous clone).
   */
  gitAuth(): Promise<GitAuth | undefined>;
  /** The account's repositories; absent when the host auth cannot list them. */
  listRepos?(): Promise<RepoInfo[]>;
  /** Create a repository; absent when the host auth cannot create one. */
  createRepo?(options: {
    name: string;
    description?: string;
    private?: boolean;
  }): Promise<RepoInfo>;
}

export const GitHubAccountContext = createContext<GitHubAccountState | null>(null);

/** The GitHub account, or null when this host offers no GitHub sign-in. */
export function useGitHubAccount(): GitHubAccountState | null {
  return useContext(GitHubAccountContext);
}
