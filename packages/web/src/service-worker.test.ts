import { describe, it, expect } from 'vitest';
import {
  matchesAny,
  PRECACHE_URLS,
  CACHE_NAME,
  STATIC_CACHE,
  DATA_CACHE,
} from './service-worker.js';

describe('Service Worker utilities', () => {
  it('versions cache names by build (unbuilt: "dev")', () => {
    expect(CACHE_NAME).toBe('cept-dev');
    expect(STATIC_CACHE).toBe('cept-static-dev');
    expect(DATA_CACHE).toBe('cept-data-dev');
  });

  it('has no precache list until the build injects one', () => {
    expect(PRECACHE_URLS).toEqual([]);
  });

  it('matchesAny matches static asset patterns', () => {
    const patterns = [/\.(js|css|png)$/, /^\/assets\//];
    expect(matchesAny('/app.js', patterns)).toBe(true);
    expect(matchesAny('/style.css', patterns)).toBe(true);
    expect(matchesAny('/logo.png', patterns)).toBe(true);
    expect(matchesAny('/assets/image.svg', patterns)).toBe(true);
  });

  it('matchesAny rejects non-matching paths', () => {
    const patterns = [/\.(js|css|png)$/, /^\/assets\//];
    expect(matchesAny('/api/data', patterns)).toBe(false);
    expect(matchesAny('/index.html', patterns)).toBe(false);
  });

  it('matchesAny handles empty patterns', () => {
    expect(matchesAny('/anything', [])).toBe(false);
  });
});

describe('SW Registration', () => {
  it('module exports registration functions', async () => {
    const mod = await import('./sw-register.js');
    expect(typeof mod.registerServiceWorker).toBe('function');
    expect(typeof mod.skipWaiting).toBe('function');
  });
});
