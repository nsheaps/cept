/**
 * AuthProvider — Abstracts OAuth flow for Git remotes.
 *
 * Only needed when using GitBackend with a remote.
 * MVP: GitHub OAuth App. Interface supports adding GitLab, Bitbucket, etc. later.
 */

/** Supported auth provider types */
export type AuthProviderType = 'github' | 'gitlab' | 'bitbucket' | 'forgejo' | 'ssh' | 'https';

/** OAuth token */
export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
}

/** SSH key pair */
export interface SSHKey {
  publicKey: string;
  privateKey: string;
  passphrase?: string;
}

/** Repository info from provider */
export interface RepoInfo {
  name: string;
  fullName: string;
  url: string;
  httpsUrl: string;
  sshUrl: string;
  private: boolean;
  description?: string;
  defaultBranch: string;
}

/** HTTP auth credentials for isomorphic-git */
export interface HttpAuth {
  username: string;
  password?: string;
  token?: string;
}

/**
 * Auth provider interface.
 * Each Git hosting provider implements this.
 */
export interface AuthProvider {
  readonly type: AuthProviderType;

  /** Initiate authentication (OAuth flow, SSH key, etc.) */
  authenticate(): Promise<AuthToken | SSHKey>;

  /** List user's repositories (provider-specific API) */
  getRepos(): Promise<RepoInfo[]>;

  /** Get HTTP auth credentials for isomorphic-git onAuth callback */
  getHttpAuth(): Promise<HttpAuth>;

  /** Check if currently authenticated */
  isAuthenticated(): Promise<boolean>;

  /** Clear stored credentials */
  logout(): Promise<void>;
}
