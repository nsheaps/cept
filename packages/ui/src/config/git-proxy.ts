/**
 * The CORS proxy that browser git traffic goes through (D-39). Phase 1 uses the
 * public isomorphic-git proxy; a build sets `VITE_CORS_PROXY` to use another
 * one, such as the first-party Worker in Phase 2. This is the only module that
 * may name the public proxy (`cept/no-cors-proxy-literal`).
 */
export const DEFAULT_GIT_CORS_PROXY = 'https://cors.isomorphic-git.org';

/** The configured proxy URL, or the default when the build sets none. */
export function gitCorsProxy(
  configured: string = typeof __GIT_CORS_PROXY__ !== 'undefined' ? __GIT_CORS_PROXY__ : '',
): string {
  return configured.trim() || DEFAULT_GIT_CORS_PROXY;
}
