/**
 * Deployment namespace utilities.
 *
 * When multiple deployments share the same origin (e.g. GitHub Pages preview
 * deployments at /cept/pr-N/), each needs isolated browser storage to prevent
 * data from leaking between PRs and the production deployment.
 *
 * The namespace is derived from the deployment's base path (Vite BASE_URL).
 */

/**
 * Derive a deployment ID slug from the base path.
 *
 * Returns an empty string for production and local dev (no isolation needed),
 * and a slug like "cept-pr-123" for preview deployments.
 *
 * Examples:
 *   "/"            → ""           (local dev)
 *   "/cept/app/"   → ""           (production)
 *   "/cept/pr-42/" → "cept-pr-42" (preview)
 */
export function getDeploymentId(basePath: string): string {
  const slug = basePath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  // Production and local dev use default namespace (backwards compatible)
  if (!slug || slug === 'cept-app') return '';
  return slug;
}

/** Get the IndexedDB database name for this deployment. */
export function getDbName(basePath: string): string {
  const id = getDeploymentId(basePath);
  return id ? `cept-workspace--${id}` : 'cept-workspace';
}

/**
 * Prefix a storage key (localStorage/sessionStorage) with the deployment namespace.
 * Returns the key unchanged for production/local dev.
 */
export function namespacedKey(basePath: string, key: string): string {
  const id = getDeploymentId(basePath);
  return id ? `${id}::${key}` : key;
}

/**
 * Prefix a cache name with the deployment namespace.
 * Returns the name unchanged for production/local dev.
 */
export function namespacedCache(basePath: string, cacheName: string): string {
  const id = getDeploymentId(basePath);
  return id ? `${id}::${cacheName}` : cacheName;
}

/**
 * Whether a Cache Storage key belongs to the deployment with this id (`""` is
 * production and local dev, whose cache names have no prefix). The service
 * worker keeps its own copy in sw-precache.ts, because it is a classic script
 * and cannot import a chunk shared with the app; a test keeps the two equal.
 */
export function isOwnCache(key: string, deploymentId: string): boolean {
  if (deploymentId) return key.startsWith(`${deploymentId}::`);
  return key.startsWith('cept-') && !key.includes('::');
}

/**
 * The kill switch: opening the app with `?no-sw` bypasses the service worker
 * for that navigation and makes the page remove it. Mirrored in sw-precache.ts.
 */
export function isKillSwitch(url: URL): boolean {
  return url.searchParams.has('no-sw');
}
