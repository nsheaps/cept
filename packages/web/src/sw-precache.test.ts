import { describe, it, expect } from 'vitest';
import * as app from './deploy-namespace.js';
import {
  deploymentIdFor,
  isKillSwitch,
  isOwnCache,
  relativeToBase,
  selectPrecache,
} from './sw-precache.js';

describe('selectPrecache', () => {
  const built = [
    'index.html',
    'manifest.json',
    '404.html',
    'service-worker.js',
    'service-worker.js.map',
    'assets/main-abc123.js',
    'assets/main-abc123.js.map',
    'assets/style-def456.css',
    'icons/icon-192.png',
    'screenshots/features/slash-menu.png',
  ];

  it('lists the app shell first, then the built files the app needs, sorted', () => {
    expect(selectPrecache(built)).toEqual([
      './',
      'assets/main-abc123.js',
      'assets/style-def456.css',
      'icons/icon-192.png',
      'index.html',
      'manifest.json',
    ]);
  });

  it('leaves out the worker, source maps, the Pages 404 page and documentation images', () => {
    const list = selectPrecache(built);
    expect(list).not.toContain('service-worker.js');
    expect(list.some((file) => file.endsWith('.map'))).toBe(false);
    expect(list).not.toContain('404.html');
    expect(list.some((file) => file.startsWith('screenshots/'))).toBe(false);
  });

  it('keeps every entry relative to the base, so it resolves under any deploy path', () => {
    for (const entry of selectPrecache(['./index.html', '/assets/a.js'])) {
      expect(entry.startsWith('/')).toBe(false);
    }
    for (const base of [
      'https://x.test/',
      'https://x.test/cept/app/',
      'https://x.test/cept/pr-4/',
    ]) {
      expect(new URL('assets/main-abc123.js', base).href).toBe(`${base}assets/main-abc123.js`);
    }
  });

  it('drops duplicates', () => {
    expect(selectPrecache(['a.js', './a.js', 'a.js'])).toEqual(['./', 'a.js']);
  });
});

describe('relativeToBase', () => {
  it('returns the path below the base', () => {
    expect(relativeToBase('/cept/app/', '/cept/app/assets/x.js')).toBe('assets/x.js');
    expect(relativeToBase('/cept/app/', '/cept/app/')).toBe('');
    expect(relativeToBase('/', '/assets/x.js')).toBe('assets/x.js');
  });

  it('returns null outside the base, including a sibling that shares a prefix', () => {
    expect(relativeToBase('/cept/app/', '/other/x.js')).toBeNull();
    expect(relativeToBase('/cept/app/', '/cept/app-two/x.js')).toBeNull();
    expect(relativeToBase('/cept/app/', '/cept/pr-4/assets/x.js')).toBeNull();
  });
});

describe('isOwnCache (per-deployment isolation, REQ-WEB-020)', () => {
  it('production only owns unprefixed cept caches', () => {
    expect(isOwnCache('cept-static-abc', '')).toBe(true);
    expect(isOwnCache('cept-pr-4::cept-static-abc', '')).toBe(false);
    expect(isOwnCache('something-else', '')).toBe(false);
  });

  it('a preview only owns its own prefix', () => {
    expect(isOwnCache('cept-pr-4::cept-static-abc', 'cept-pr-4')).toBe(true);
    expect(isOwnCache('cept-pr-5::cept-static-abc', 'cept-pr-4')).toBe(false);
    expect(isOwnCache('cept-static-abc', 'cept-pr-4')).toBe(false);
  });
});

describe('deploymentIdFor', () => {
  it('matches the id the app derives for storage, so caches and databases share a namespace', () => {
    for (const base of ['/', '/cept/app/', '/cept/pr-42/', '/cept/pr-7', '/a/b/c/']) {
      expect(deploymentIdFor(base)).toBe(app.getDeploymentId(base));
    }
  });
});

describe('isKillSwitch', () => {
  it('is on only with the no-sw query parameter', () => {
    expect(isKillSwitch(new URL('https://x.test/cept/app/?no-sw'))).toBe(true);
    expect(isKillSwitch(new URL('https://x.test/cept/app/?a=1&no-sw=1'))).toBe(true);
    expect(isKillSwitch(new URL('https://x.test/cept/app/'))).toBe(false);
    expect(isKillSwitch(new URL('https://x.test/cept/app/?nosw'))).toBe(false);
  });
});

describe('copies kept equal with deploy-namespace.ts', () => {
  it('isOwnCache agrees for production and preview ids', () => {
    for (const id of ['', 'cept-pr-4']) {
      for (const key of ['cept-static-a', 'cept-pr-4::cept-static-a', 'cept-pr-5::x', 'other']) {
        expect(isOwnCache(key, id)).toBe(app.isOwnCache(key, id));
      }
    }
  });

  it('isKillSwitch agrees', () => {
    for (const href of ['https://x.test/?no-sw', 'https://x.test/', 'https://x.test/?a=1']) {
      expect(isKillSwitch(new URL(href))).toBe(app.isKillSwitch(new URL(href)));
    }
  });
});
