/**
 * Pure helpers shared by the service worker and the Vite build.
 *
 * The build lists the files it emitted, `selectPrecache` picks the ones the app
 * needs to start offline, and the result is written into `service-worker.js`.
 * Paths are relative to the deployment base (`assets/x.js`, `./`), so the same
 * bundle works under `/cept/app/`, a PR preview and `/`.
 */

/** Files in the build that the app does not need to start. */
const EXCLUDED = [
  /\.map$/, // source maps
  /^service-worker\.js$/, // the worker itself is never cached by itself
  /^404\.html$/, // GitHub Pages deep-link redirect page
  /^screenshots\//, // documentation images
];

/**
 * The base-relative files to precache: every built file except the excluded
 * ones, plus `./` (the app shell, served for navigations to the base).
 */
export function selectPrecache(files: readonly string[]): string[] {
  const kept = files
    .map((file) => file.replace(/^\.?\/+/, ''))
    .filter((file) => file && !EXCLUDED.some((pattern) => pattern.test(file)));
  return ['./', ...Array.from(new Set(kept)).sort()];
}

/** The path of `pathname` below `basePath`, or null when it is outside it. */
export function relativeToBase(basePath: string, pathname: string): string | null {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  if (pathname === base.slice(0, -1)) return '';
  return pathname.startsWith(base) ? pathname.slice(base.length) : null;
}

/** Whether a Cache Storage key belongs to the deployment with this id. */
export function isOwnCache(key: string, deploymentId: string): boolean {
  if (deploymentId) return key.startsWith(`${deploymentId}::`);
  // The production and local-dev deployment has no prefix; every other
  // deployment's caches are prefixed, so they contain "::".
  return key.startsWith('cept-') && !key.includes('::');
}

/**
 * The deployment id for a base path (`""` for production and local dev,
 * `cept-pr-42` for `/cept/pr-42/`). The worker is served as a classic script,
 * so it cannot import a chunk shared with the app; this mirrors
 * `getDeploymentId` in deploy-namespace.ts, and a test keeps the two equal.
 */
export function deploymentIdFor(basePath: string): string {
  const slug = basePath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
  return !slug || slug === 'cept-app' ? '' : slug;
}

/**
 * The kill switch: opening the app with `?no-sw` bypasses the worker for that
 * navigation, and the page then unregisters it and clears its caches. It is the
 * way out if a worker ever serves a broken shell.
 */
export function isKillSwitch(url: URL): boolean {
  return url.searchParams.has('no-sw');
}
