/**
 * Lightweight path-based router for Cept.
 *
 * URL scheme:
 *   /{base}/                                                      — landing / onboarding
 *   /{base}/s/{spaceId}                                           — local space root
 *   /{base}/s/{spaceId}/{pageId}                                  — page in a local space
 *   /{base}/g/{host}/{owner}/{repo}/blob/{branch}[/{subpath}]     — git space root
 *   /{base}/g/{host}/{owner}/{repo}/blob/{branch}[/{subpath}]/{pageId} — page in a git space
 *   /{base}/docs                                                  — docs space index
 *   /{base}/docs/{pageId}                                         — specific docs page
 *
 * Git space IDs use the format: host/owner/repo@branch[/subpath]
 * The `blob` segment in the URL separates the repo path from the branch,
 * mirroring GitHub's URL format. The `/g/` prefix distinguishes git spaces
 * from local `/s/` spaces.
 *
 * When `redirectToGitUrl` is enabled, local `/s/` URLs that resolve to a
 * git-backed space will redirect to the canonical `/g/` URL. This means
 * shared links always point to the git-backed version so recipients
 * auto-create the space on visit.
 *
 * Works with the GitHub Pages 404.html hack: when the server can't find
 * a path, 404.html redirects to `/?route=<encoded-path>`. On load, the
 * app calls `restoreRoute()` to read that query param and replaceState
 * to the correct URL.
 */

export interface AppRoute {
  space: 'user' | 'docs';
  spaceId: string;
  pageId: string | undefined;
}

const DEFAULT_ROUTE: AppRoute = { space: 'user', spaceId: 'default', pageId: undefined };

/** Cached base path so detection only runs once. */
let cachedBasePath: string | null = null;

/** Override for testing. When set, getBasePath() returns this value. */
let basePathOverride: string | null = null;

/**
 * When true (default), buildPath uses /g/ for git-backed spaces.
 * When false, uses /s/ (local-style URL, not shareable).
 */
let useGitPrefix = true;

export function setUseGitPrefix(enabled: boolean): void {
  useGitPrefix = enabled;
}

/**
 * Set a custom base path (for testing). Pass null to reset.
 */
export function setBasePath(base: string | null): void {
  basePathOverride = base;
  cachedBasePath = null; // force re-detection
}

/**
 * Detect the base path. Tries in order:
 * 1. Test override (setBasePath)
 * 2. Vite's import.meta.env.BASE_URL (build-time replacement)
 * 3. Runtime detection from <script> src attributes
 * 4. Falls back to '/'
 */
function getBasePath(): string {
  if (basePathOverride !== null) {
    const b = basePathOverride;
    return b.endsWith('/') ? b : b + '/';
  }
  if (cachedBasePath !== null) return cachedBasePath;

  let base = '/';

  // Try Vite build-time value
  try {
    const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
    if (meta.env?.BASE_URL && meta.env.BASE_URL !== '/') {
      base = meta.env.BASE_URL;
    }
  } catch {
    // not available
  }

  // If Vite didn't give us a real base, detect from the DOM at runtime.
  // Vite-built scripts have src like "/cept/app/assets/index-abc123.js".
  // We extract everything before "/assets/".
  if (base === '/' && typeof document !== 'undefined') {
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      const src = s.getAttribute('src') ?? '';
      const assetsIdx = src.indexOf('/assets/');
      if (assetsIdx > 0) {
        base = src.substring(0, assetsIdx + 1);
        break;
      }
    }
  }

  cachedBasePath = base.endsWith('/') ? base : base + '/';
  return cachedBasePath;
}

/**
 * Strip the base path prefix from a full pathname to get the
 * app-relative path segments.
 */
function stripBase(pathname: string): string {
  const base = getBasePath();
  if (pathname.startsWith(base)) {
    return pathname.slice(base.length);
  }
  // Also handle without trailing slash
  const baseNoSlash = base.replace(/\/$/, '');
  if (pathname.startsWith(baseNoSlash)) {
    return pathname.slice(baseNoSlash.length).replace(/^\//, '');
  }
  return pathname.replace(/^\//, '');
}

/**
 * Check if a space ID is a git-based remote space (contains `@` for branch).
 */
export function isRemoteSpaceId(spaceId: string): boolean {
  return spaceId.includes('@');
}

/**
 * Convert a git space ID to a URL path (without base or /g/ prefix).
 * e.g., "github.com/nsheaps/cept@main/docs" → "github.com/nsheaps/cept/blob/main/docs"
 */
function spaceIdToUrlPath(spaceId: string): string {
  const atIdx = spaceId.indexOf('@');
  if (atIdx < 0) return spaceId;
  const repo = spaceId.substring(0, atIdx);
  const rest = spaceId.substring(atIdx + 1);
  return `${repo}/blob/${rest}`;
}

/**
 * Parse a git-style URL path (segments after /g/) back into a space ID and page ID.
 * The URL contains `blob` as a delimiter between the repo path and the branch.
 *
 * e.g., ["github.com","nsheaps","cept","blob","main","docs","git-page-id"]
 * → { spaceId: "github.com/nsheaps/cept@main/docs", pageId: "git-page-id" }
 */
function parseGitSpaceUrl(segments: string[]): { spaceId: string; pageId: string | undefined } {
  const blobIdx = segments.indexOf('blob');
  if (blobIdx < 0 || blobIdx + 1 >= segments.length) {
    // No blob found — treat as simple space ID
    return { spaceId: segments[0], pageId: segments[1] };
  }

  const repo = segments.slice(0, blobIdx).join('/');
  const branch = segments[blobIdx + 1];
  const rest = segments.slice(blobIdx + 2);

  if (rest.length === 0) {
    // Space root, no page: /g/github.com/nsheaps/cept/blob/main
    return { spaceId: `${repo}@${branch}`, pageId: undefined };
  }

  // Determine if the last segment is a page ID.
  // Git page IDs start with "git-" by convention (from git-space.ts).
  const last = rest[rest.length - 1];
  if (last.startsWith('git-')) {
    // Last segment is a page ID
    const subPath = rest.slice(0, -1).join('/');
    const spaceId = subPath ? `${repo}@${branch}/${subPath}` : `${repo}@${branch}`;
    return { spaceId, pageId: last };
  }

  // All segments are sub-path (space root view)
  const subPath = rest.join('/');
  return { spaceId: `${repo}@${branch}/${subPath}`, pageId: undefined };
}

/**
 * Parse the current URL into an AppRoute.
 */
export function parseRoute(pathname?: string): AppRoute {
  const raw = pathname ?? window.location.pathname;
  const relative = stripBase(raw);
  const segments = relative.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { ...DEFAULT_ROUTE };
  }

  // /docs or /docs/{pageId}
  if (segments[0] === 'docs') {
    return {
      space: 'docs',
      spaceId: 'docs',
      pageId: segments[1] ?? undefined,
    };
  }

  // /g/... — git space routes (new canonical prefix)
  if (segments[0] === 'g' && segments.length >= 2) {
    const spaceSegments = segments.slice(1);
    const { spaceId, pageId } = parseGitSpaceUrl(spaceSegments);
    return { space: 'user', spaceId, pageId };
  }

  // /s/... — space routes (local spaces, and legacy git space URLs)
  if (segments[0] === 's' && segments.length >= 2) {
    const spaceSegments = segments.slice(1);

    // Check for git-style URL (contains 'blob' segment) — legacy /s/ git URLs
    if (spaceSegments.includes('blob')) {
      const { spaceId, pageId } = parseGitSpaceUrl(spaceSegments);
      return { space: 'user', spaceId, pageId };
    }

    // Simple space ID (local spaces): /s/{spaceId}[/{pageId}]
    return {
      space: 'user',
      spaceId: spaceSegments[0],
      pageId: spaceSegments[1] ?? undefined,
    };
  }

  // Legacy: bare /{pageId} treated as default space page
  // (for backward compat with hash-based links)
  if (segments.length === 1) {
    return {
      space: 'user',
      spaceId: 'default',
      pageId: segments[0],
    };
  }

  return { ...DEFAULT_ROUTE };
}

/**
 * Build a URL path for a given route.
 */
export function buildPath(route: Partial<AppRoute>): string {
  const base = getBasePath();

  if (route.space === 'docs') {
    if (route.pageId) {
      return `${base}docs/${route.pageId}`;
    }
    return `${base}docs`;
  }

  const spaceId = route.spaceId ?? 'default';

  if (isRemoteSpaceId(spaceId)) {
    // Git space — use /g/ prefix (shareable) or /s/ (local-only) based on config
    const prefix = useGitPrefix ? 'g' : 's';
    const urlPath = spaceIdToUrlPath(spaceId);
    if (route.pageId) {
      return `${base}${prefix}/${urlPath}/${route.pageId}`;
    }
    return `${base}${prefix}/${urlPath}`;
  }

  // Local space
  if (route.pageId) {
    return `${base}s/${spaceId}/${route.pageId}`;
  }
  if (spaceId !== 'default') {
    return `${base}s/${spaceId}`;
  }
  return base;
}

/**
 * Push a new route to the browser history.
 */
export function pushRoute(route: Partial<AppRoute>): void {
  const path = buildPath(route);
  window.history.pushState(null, '', path);
}

/**
 * Replace the current URL without adding a history entry.
 */
export function replaceRoute(route: Partial<AppRoute>): void {
  const path = buildPath(route);
  window.history.replaceState(null, '', path);
}

/**
 * Called on app startup. If the URL has a `?route=` param
 * (from the 404.html redirect), restore the original path
 * via replaceState and return the parsed route.
 *
 * Also handles legacy hash-based URLs (#pageId) by converting
 * them to path-based routes.
 */
export function restoreRoute(): AppRoute {
  const params = new URLSearchParams(window.location.search);
  const encodedRoute = params.get('route');

  if (encodedRoute) {
    // Restore the original path from 404.html redirect
    const decoded = decodeURIComponent(encodedRoute);
    const route = parseRoute(decoded);
    replaceRoute(route);
    return route;
  }

  // Handle legacy hash-based URLs: /#pageId or /#docs/pageId
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const route = parseRoute('/' + hash);
    replaceRoute(route);
    return route;
  }

  return parseRoute();
}
