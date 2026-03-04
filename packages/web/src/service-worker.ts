/**
 * Service Worker for Cept PWA
 *
 * Implements a cache-first strategy for static assets and a network-first
 * strategy for API/data requests. Handles offline functionality and
 * background sync for pending operations.
 */

// Service worker type declarations (this file runs in SW context, not DOM)
interface SWExtendableEvent extends Event { waitUntil(p: Promise<unknown>): void; }
interface SWFetchEvent extends SWExtendableEvent { readonly request: Request; respondWith(r: Response | Promise<Response>): void; }
interface SWMessageEvent extends SWExtendableEvent { readonly data: { type?: string } & Record<string, unknown>; }
interface SWGlobalScope {
  readonly location: Location;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: SWExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: SWFetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: SWMessageEvent) => void): void;
}

declare const self: SWGlobalScope;

const CACHE_NAME = 'cept-v1';
const STATIC_CACHE = 'cept-static-v1';
const DATA_CACHE = 'cept-data-v1';

/** Static assets to precache on install */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

/** URL patterns that should use cache-first strategy */
const STATIC_PATTERNS = [
  /\.(js|css|woff2?|png|jpg|svg|ico)$/,
  /^\/assets\//,
  /^\/icons\//,
];

/** URL patterns that should use network-first strategy */
const NETWORK_FIRST_PATTERNS = [
  /^\/api\//,
];

/** Check if a URL matches any of the given patterns */
function matchesAny(url: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(url));
}

/** Install event — precache static assets */
self.addEventListener('install', (event: SWExtendableEvent) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

/** Activate event — clean up old caches */
self.addEventListener('activate', (event: SWExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE && key !== CACHE_NAME)
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

  if (matchesAny(url.pathname, STATIC_PATTERNS)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
  } else if (matchesAny(url.pathname, NETWORK_FIRST_PATTERNS)) {
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

    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
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
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});

export { CACHE_NAME, STATIC_CACHE, DATA_CACHE, PRECACHE_URLS, matchesAny };
