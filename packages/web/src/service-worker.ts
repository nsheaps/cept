/**
 * Service Worker for Cept PWA
 *
 * Implements a cache-first strategy for static assets and a network-first
 * strategy for API/data requests. Handles offline functionality and
 * background sync for pending operations.
 */

import { deploymentIdFor, isKillSwitch, isOwnCache, relativeToBase } from './sw-precache.js';

// Service worker type declarations (this file runs in SW context, not DOM)
interface SWExtendableEvent extends Event {
  waitUntil(p: Promise<unknown>): void;
}
interface SWFetchEvent extends SWExtendableEvent {
  readonly request: Request;
  respondWith(r: Response | Promise<Response>): void;
}
interface SWMessageEvent extends SWExtendableEvent {
  readonly data: { type?: string } & Record<string, unknown>;
}
interface SWGlobalScope {
  readonly location: Location;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(
    type: 'install' | 'activate',
    listener: (event: SWExtendableEvent) => void,
  ): void;
  addEventListener(type: 'fetch', listener: (event: SWFetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SWMessageEvent) => void): void;
}

declare const self: SWGlobalScope;

/** Replaced by the build (see `injectServiceWorkerManifest` in vite.config.ts). */
const INJECTED_PRECACHE = '__PRECACHE_MANIFEST__';
const INJECTED_BUILD_ID = '__BUILD_ID__';

/** Base-relative files to precache; empty when the worker runs unbuilt (tests, dev). */
function readPrecache(raw: string): string[] {
  return raw.startsWith('__') ? [] : raw.split(',');
}

/** The worker is served from the deployment base, so its directory is the base. */
const BASE_PATH = new URL('./', self.location.href).pathname;

/** Isolates preview deployments sharing the origin (REQ-WEB-020). */
const DEPLOY_ID = deploymentIdFor(BASE_PATH);
const CACHE_PREFIX = DEPLOY_ID ? `${DEPLOY_ID}::` : '';
const BUILD_ID = INJECTED_BUILD_ID.startsWith('__') ? 'dev' : INJECTED_BUILD_ID;

/** Versioned by build, so a new build never reads the previous build's assets. */
const CACHE_NAME = `${CACHE_PREFIX}cept-${BUILD_ID}`;
const STATIC_CACHE = `${CACHE_PREFIX}cept-static-${BUILD_ID}`;
const DATA_CACHE = `${CACHE_PREFIX}cept-data-${BUILD_ID}`;

/** Static assets to precache on install, as base-relative paths. */
const PRECACHE_URLS = readPrecache(INJECTED_PRECACHE);

/** Base-relative path patterns that use the cache-first strategy. */
const STATIC_PATTERNS = [/\.(js|css|woff2?|png|jpg|svg|ico)$/, /^assets\//, /^icons\//];

/** Base-relative path patterns that use the network-first strategy. */
const NETWORK_FIRST_PATTERNS = [/^api\//];

/** Check if a path matches any of the given patterns */
function matchesAny(path: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(path));
}

/** Install event — precache the build (do NOT auto-skipWaiting; let the client decide) */
self.addEventListener('install', (event: SWExtendableEvent) => {
  event.waitUntil(precache());
});

/**
 * Fetch every precache URL into the static cache. A failure is logged with the
 * URLs that failed and rethrown, so a half-filled cache never activates and the
 * previous worker keeps serving until the next attempt.
 */
async function precache(): Promise<void> {
  const cache = await caches.open(STATIC_CACHE);
  const failed: string[] = [];
  await Promise.all(
    PRECACHE_URLS.map(async (path) => {
      const url = new URL(path, self.location.href);
      try {
        const response = await fetch(url.href, { cache: 'reload' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(url.href, response);
      } catch {
        failed.push(path);
      }
    }),
  );
  if (failed.length > 0) {
    console.error(`[cept-sw] precache failed for ${failed.length} file(s): ${failed.join(', ')}`);
    throw new Error('Service worker precache failed');
  }
}

/** Activate event — delete this deployment's caches from earlier builds */
self.addEventListener('activate', (event: SWExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                isOwnCache(key, DEPLOY_ID) &&
                key !== STATIC_CACHE &&
                key !== DATA_CACHE &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Fetch event — route requests to appropriate strategy */
self.addEventListener('fetch', (event: SWFetchEvent) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Kill switch: let the network answer, so a broken cached shell cannot trap the page
  if (isKillSwitch(url)) return;

  // Only requests under this deployment's base are ours
  const path = relativeToBase(BASE_PATH, url.pathname);
  if (path === null) return;

  if (matchesAny(path, STATIC_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
  } else if (matchesAny(path, NETWORK_FIRST_PATTERNS)) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
  } else {
    // Default: network first for HTML, cache first for everything else
    if (event.request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(networkFirst(event.request, STATIC_CACHE));
    } else {
      event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    }
  }
});

/** Cache-first strategy: return from cache, falling back to network */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first strategy: try network, fall back to cache */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline navigation to a path the app handles itself: serve the cached shell
    if (request.headers.get('accept')?.includes('text/html')) {
      const shell = await caches.match(new URL('./', self.location.href).href);
      if (shell) return shell;
      return new Response(
        '<!DOCTYPE html><html><body><h1>Offline</h1><p>You are currently offline. Your changes will sync when reconnected.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

/** Message handler for cache management */
self.addEventListener('message', (event: SWMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((k) => isOwnCache(k, DEPLOY_ID)).map((k) => caches.delete(k))),
        ),
    );
  }
});

export { CACHE_NAME, STATIC_CACHE, DATA_CACHE, PRECACHE_URLS, matchesAny };
