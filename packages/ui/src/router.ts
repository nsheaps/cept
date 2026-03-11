/**
 * Lightweight path-based router for Cept.
 *
 * URL scheme:
 *   /{base}/                     — landing / onboarding
 *   /{base}/s/{spaceId}          — space root (no page selected)
 *   /{base}/s/{spaceId}/{pageId} — specific page in a user space
 *   /{base}/docs                 — docs space index
 *   /{base}/docs/{pageId}        — specific docs page
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

  // /s/{spaceId} or /s/{spaceId}/{pageId}
  if (segments[0] === 's' && segments.length >= 2) {
    return {
      space: 'user',
      spaceId: segments[1],
      pageId: segments[2] ?? undefined,
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
