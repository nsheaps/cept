/**
 * Lightweight path-based router for Cept.
 *
 * URL scheme:
 *   /{base}/                                                      — landing / onboarding
 *   /{base}/s/{spaceId}                                           — local space root
 *   /{base}/s/{spaceId}/{pagePath}                                — page in a local space
 *   /{base}/g/{host}/{owner}/{repo}/blob/{branch}[/{subpath}]     — git space root
 *   /{base}/g/{host}/{owner}/{repo}/blob/{branch}[/{subpath}]/{pagePath} — page in a git space
 *   /{base}/docs                                                  — docs space index
 *   /{base}/docs/{pageId}                                         — specific docs page
 *
 * Page ids are paths in the space (`Guides/Setup.md`, or `Guides` for a
 * folder page), and appear in the URL as path segments, each one encoded.
 * An older URL with the whole id as one encoded segment reads the same.
 *
 * Git space IDs use the format: host/owner/repo@branch[/subpath]
 * The `blob` segment in the URL separates the repo path from the branch,
 * mirroring GitHub's URL format. The `/g/` prefix distinguishes git spaces
 * from local `/s/` spaces. The path after the branch is the space's subpath
 * followed by the page path; `resolveRoute` splits it using the spaces that
 * exist, and without one the last segment is a page when it is a Markdown file.
 *
 * A path the router does not recognise parses to `notFound: true`.
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
  /** The path matches no route. */
  notFound?: boolean;
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

/** Whether a path segment names a Markdown page file. */
function isPageFile(segment: string): boolean {
  return /\.(md|markdown)$/i.test(segment);
}

/**
 * Parse a git-style URL path (segments after /g/) back into a space ID and page ID.
 * The URL contains `blob` as a delimiter between the repo path and the branch;
 * everything after the branch is the repo path. Without knowing the spaces,
 * a Markdown file at the end is the page and the rest is the subpath.
 *
 * e.g., ["github.com","nsheaps","cept","blob","main","docs","intro.md"]
 * → { spaceId: "github.com/nsheaps/cept@main/docs", pageId: "intro.md" }
 */
function parseGitSpaceUrl(segments: string[]): AppRoute {
  const blobIdx = segments.indexOf('blob');
  if (blobIdx < 1 || blobIdx + 1 >= segments.length) {
    return { ...DEFAULT_ROUTE, notFound: true };
  }

  const repo = segments.slice(0, blobIdx).join('/');
  const branch = segments[blobIdx + 1];
  const rest = segments.slice(blobIdx + 2).map(decodeSegment);
  const last = rest[rest.length - 1];
  const pageId = last !== undefined && isPageFile(last) ? last : undefined;
  const subPath = (pageId ? rest.slice(0, -1) : rest).join('/');
  const spaceId = subPath ? `${repo}@${branch}/${subPath}` : `${repo}@${branch}`;
  return { space: 'user', spaceId, pageId };
}

/** Split a git space id into its `repo@branch` and subpath. */
function splitGitSpaceId(spaceId: string): { root: string; subPath: string } {
  const at = spaceId.indexOf('@');
  const slash = spaceId.indexOf('/', at);
  if (slash < 0) return { root: spaceId, subPath: '' };
  return { root: spaceId.slice(0, slash), subPath: spaceId.slice(slash + 1) };
}

/**
 * Match a git route against the spaces that exist. The repo path in the URL
 * belongs to the existing space of the same repo and branch whose subpath is
 * the longest prefix of it; the rest is the page. Other routes, and git routes
 * no space matches, are returned unchanged.
 */
export function resolveRoute(route: AppRoute, spaceIds: readonly string[]): AppRoute {
  if (route.space !== 'user' || route.notFound || !isRemoteSpaceId(route.spaceId)) return route;
  const { root, subPath } = splitGitSpaceId(route.spaceId);
  const full = [subPath, route.pageId].filter(Boolean).join('/');
  let best: { id: string; sub: string } | undefined;
  for (const id of spaceIds) {
    const candidate = splitGitSpaceId(id);
    if (candidate.root !== root) continue;
    const sub = candidate.subPath;
    if (sub && full !== sub && !full.startsWith(`${sub}/`)) continue;
    if (!best || sub.length > best.sub.length) best = { id, sub };
  }
  if (!best) return route;
  const page = best.sub ? full.slice(best.sub.length + 1) : full;
  return { space: 'user', spaceId: best.id, pageId: page || undefined };
}

/** Encode a page id for the URL: each path segment on its own. */
function encodePagePath(pageId: string): string {
  return pageId.split('/').map(encodeURIComponent).join('/');
}

/** Decode one URL segment; a malformed escape is kept as it is. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
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
    return parseGitSpaceUrl(segments.slice(1));
  }

  // /s/... — space routes (local spaces, and legacy git space URLs)
  if (segments[0] === 's' && segments.length >= 2) {
    const spaceSegments = segments.slice(1);

    // Check for git-style URL (contains 'blob' segment) — legacy /s/ git URLs
    if (spaceSegments.includes('blob')) {
      return parseGitSpaceUrl(spaceSegments);
    }

    // Local spaces: /s/{spaceId}[/{pagePath}]
    const pagePath = spaceSegments.slice(1).map(decodeSegment).join('/');
    return {
      space: 'user',
      spaceId: decodeSegment(spaceSegments[0]),
      pageId: pagePath || undefined,
    };
  }

  // Legacy: bare /{pageId} treated as default space page
  // (for backward compat with hash-based links)
  if (segments.length === 1 && segments[0] !== 's' && segments[0] !== 'g') {
    return {
      space: 'user',
      spaceId: 'default',
      pageId: decodeSegment(segments[0]),
    };
  }

  return { ...DEFAULT_ROUTE, notFound: true };
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
      return `${base}${prefix}/${urlPath}/${encodePagePath(route.pageId)}`;
    }
    return `${base}${prefix}/${urlPath}`;
  }

  // Local space: the page id's path segments follow the space id.
  if (route.pageId) {
    return `${base}s/${encodeURIComponent(spaceId)}/${encodePagePath(route.pageId)}`;
  }
  if (spaceId !== 'default') {
    return `${base}s/${encodeURIComponent(spaceId)}`;
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

/** The path a link asked for: the `?route=` param from the 404.html redirect, else the hash or the path. */
function requestedUrlPath(): { path: string; from: 'redirect' | 'hash' | 'path' } {
  const params = new URLSearchParams(window.location.search);
  const encodedRoute = params.get('route');
  if (encodedRoute) return { path: decodeURIComponent(encodedRoute), from: 'redirect' };
  const hash = window.location.hash.replace('#', '');
  if (hash) return { path: '/' + hash, from: 'hash' };
  return { path: window.location.pathname, from: 'path' };
}

/** The route the current URL asks for, without changing the URL. */
export function peekRoute(): AppRoute {
  return parseRoute(requestedUrlPath().path);
}

/**
 * Called on app startup. If the URL has a `?route=` param
 * (from the 404.html redirect), restore the original path
 * via replaceState and return the parsed route.
 *
 * Also handles legacy hash-based URLs (#pageId) by converting
 * them to path-based routes.
 *
 * A path that is no route is put back in the address bar as it was, so the
 * not-found page shows the link that was followed.
 */
export function restoreRoute(): AppRoute {
  const { path, from } = requestedUrlPath();
  const route = parseRoute(path);
  if (from === 'path') return route;
  if (route.notFound) window.history.replaceState(null, '', path);
  else replaceRoute(route);
  return route;
}
