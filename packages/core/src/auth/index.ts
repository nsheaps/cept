export type {
  AuthProvider,
  AuthProviderType,
  AuthToken,
  SSHKey,
  RepoInfo,
  HttpAuth,
} from './provider.js';

export {
  GitHubAuthProvider,
  MemoryTokenStore,
  AuthPendingError,
  AuthSlowDownError,
} from './github.js';
export type { GitHubOAuthConfig, TokenStore, DeviceFlowVerification, FetchFn } from './github.js';
export { PatAuthProvider, PatAuthError, PAT_STORE_KEY, redactTokens } from './pat.js';
export type { PatAccount, PatAuthConfig, PatAuthFailure, PatGrants } from './pat.js';
export {
  GitAuthRegistry,
  GitAuthError,
  MemoryAuthIndexStore,
  GITHUB_HOST,
  normalizeHost,
} from './registry.js';
export type {
  AddGitAuthInput,
  AuthIndexStore,
  GitAuthAccount,
  GitAuthFailure,
  GitAuthRecord,
  GitAuthRegistryConfig,
  GitAuthStatus,
  RestoreResult,
} from './registry.js';
export { newTokenUrl, tokenPermissions, NEW_FINE_GRAINED_TOKEN_URL } from './token-url.js';
export type { NewTokenUrlOptions } from './token-url.js';
