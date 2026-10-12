/**
 * The link that opens GitHub's form for a new fine-grained personal access
 * token with what Cept needs already filled in (REQ-AUTH-019).
 *
 * GitHub reads `name`, `description`, `target_name`, `expires_in` and one
 * parameter per permission (`contents=write`) from the query string. It cannot
 * prefill which repositories the token reaches, and classic tokens cannot be
 * prefilled at all, so the form still asks the user to pick the repositories.
 */

export const NEW_FINE_GRAINED_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export interface NewTokenUrlOptions {
  /** Also allow creating repositories (`administration=write`); off by default. */
  createRepos?: boolean;
  /** The token's name (at most 40 characters on GitHub). Defaults to "Cept". */
  name?: string;
}

/** The permissions Cept asks for, by GitHub's permission name. */
export function tokenPermissions(options: NewTokenUrlOptions = {}): Record<string, 'write'> {
  return {
    // Clone, fetch and push over HTTPS. Metadata (read) is always included by GitHub.
    contents: 'write',
    ...(options.createRepos ? { administration: 'write' as const } : {}),
  };
}

export function newTokenUrl(options: NewTokenUrlOptions = {}): string {
  const params = new URLSearchParams({
    name: (options.name ?? 'Cept').slice(0, 40),
    description: options.createRepos
      ? 'Lets Cept clone, sync and create repositories for your spaces. Select the repositories it may reach.'
      : 'Lets Cept clone and sync your spaces. Select the repositories it may reach.',
  });
  for (const [permission, level] of Object.entries(tokenPermissions(options)))
    params.set(permission, level);
  return `${NEW_FINE_GRAINED_TOKEN_URL}?${params.toString()}`;
}
