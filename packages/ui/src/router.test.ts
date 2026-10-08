import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRoute,
  buildPath,
  restoreRoute,
  peekRoute,
  setBasePath,
  isRemoteSpaceId,
  setUseGitPrefix,
  resolveRoute,
} from './router.js';

afterEach(() => {
  setBasePath(null);
  setUseGitPrefix(true);
});

describe('parseRoute (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('returns default route for root', () => {
    const route = parseRoute('/');
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: undefined });
  });

  it('parses docs root', () => {
    const route = parseRoute('/docs');
    expect(route).toEqual({ space: 'docs', spaceId: 'docs', pageId: undefined });
  });

  it('parses docs with page', () => {
    const route = parseRoute('/docs/getting-started');
    expect(route).toEqual({ space: 'docs', spaceId: 'docs', pageId: 'getting-started' });
  });

  it('parses space root', () => {
    const route = parseRoute('/s/my-space');
    expect(route).toEqual({ space: 'user', spaceId: 'my-space', pageId: undefined });
  });

  it('parses space with page', () => {
    const route = parseRoute('/s/my-space/page-123');
    expect(route).toEqual({ space: 'user', spaceId: 'my-space', pageId: 'page-123' });
  });

  it('puts path page ids in the URL as path segments', () => {
    const path = buildPath({ space: 'user', spaceId: 'my-space', pageId: 'guides/Set up.md' });
    expect(path).toBe('/s/my-space/guides/Set%20up.md');
    expect(parseRoute(path).pageId).toBe('guides/Set up.md');
    expect(parseRoute('/s/my-space/bad%E0%A4%A').pageId).toBe('bad%E0%A4%A');
  });

  it('round-trips names with reserved characters in each segment', () => {
    const pageId = 'Q&A ?/50% #done/a%2Fb.md';
    const path = buildPath({ space: 'user', spaceId: 'my-space', pageId });
    expect(path).toBe('/s/my-space/Q%26A%20%3F/50%25%20%23done/a%252Fb.md');
    expect(parseRoute(path).pageId).toBe(pageId);
  });

  it('reads an older URL with the page id as one encoded segment', () => {
    expect(parseRoute('/s/my-space/guides%2FSet%20up.md').pageId).toBe('guides/Set up.md');
  });

  it('marks paths it does not recognise as not found', () => {
    expect(parseRoute('/nowhere/at/all')).toEqual({
      space: 'user',
      spaceId: 'default',
      pageId: undefined,
      notFound: true,
    });
    expect(parseRoute('/g/github.com/nsheaps/cept').notFound).toBe(true);
    expect(parseRoute('/s').notFound).toBe(true);
  });

  it('treats bare segment as default space page (legacy)', () => {
    const route = parseRoute('/welcome');
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: 'welcome' });
  });

  it('handles trailing slash on root', () => {
    const route = parseRoute('/');
    expect(route.pageId).toBeUndefined();
  });

  it('handles empty string', () => {
    const route = parseRoute('');
    expect(route.space).toBe('user');
    expect(route.spaceId).toBe('default');
  });
});

describe('buildPath (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('builds root for default space no page', () => {
    expect(buildPath({ space: 'user', spaceId: 'default' })).toBe('/');
  });

  it('builds space path for non-default space', () => {
    expect(buildPath({ space: 'user', spaceId: 'work' })).toBe('/s/work');
  });

  it('builds space + page path', () => {
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe('/s/work/page-1');
  });

  it('builds default space + page path', () => {
    expect(buildPath({ space: 'user', spaceId: 'default', pageId: 'page-1' })).toBe(
      '/s/default/page-1',
    );
  });

  it('builds docs root', () => {
    expect(buildPath({ space: 'docs' })).toBe('/docs');
  });

  it('builds docs with page', () => {
    expect(buildPath({ space: 'docs', pageId: 'api-ref' })).toBe('/docs/api-ref');
  });
});

describe('restoreRoute', () => {
  beforeEach(() => {
    setBasePath('/');
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/',
        search: '',
        hash: '',
      },
    });
    window.history.replaceState = vi.fn();
  });

  it('restores from ?route= param (404 redirect)', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/',
        search: '?route=%2Fs%2Fwork%2Fpage-1',
        hash: '',
      },
    });
    const route = restoreRoute();
    expect(route).toEqual({ space: 'user', spaceId: 'work', pageId: 'page-1' });
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('restores from legacy hash URL', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/',
        search: '',
        hash: '#welcome',
      },
    });
    const route = restoreRoute();
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: 'welcome' });
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('parses current path when no redirect or hash', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/s/my-space/page-5',
        search: '',
        hash: '',
      },
    });
    const route = restoreRoute();
    expect(route).toEqual({ space: 'user', spaceId: 'my-space', pageId: 'page-5' });
  });

  it('restores docs route from 404 redirect', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/',
        search: '?route=%2Fdocs%2Fgetting-started',
        hash: '',
      },
    });
    const route = restoreRoute();
    expect(route).toEqual({ space: 'docs', spaceId: 'docs', pageId: 'getting-started' });
  });

  it('restores git space route from 404 redirect', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/',
        search: '?route=%2Fg%2Fgithub.com%2Fnsheaps%2Fcept%2Fblob%2Fmain%2Fdocs',
        hash: '',
      },
    });
    const route = restoreRoute();
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: undefined,
    });
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('puts a redirected path that is no route back in the address bar as it was', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { pathname: '/', search: '?route=%2Fnowhere%2Fat%2Fall', hash: '' },
    });
    const route = restoreRoute();
    expect(route.notFound).toBe(true);
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/nowhere/at/all');
  });
});

describe('peekRoute', () => {
  beforeEach(() => {
    setBasePath('/');
    window.history.replaceState = vi.fn();
  });

  it('reads the redirected, hash or current route without changing the URL', () => {
    for (const [location, spaceId] of [
      [{ pathname: '/', search: '?route=%2Fs%2Fdemo%2Fnotes', hash: '' }, 'demo'],
      [{ pathname: '/', search: '', hash: '#welcome' }, 'default'],
      [{ pathname: '/s/work/todo.md', search: '', hash: '' }, 'work'],
    ] as const) {
      Object.defineProperty(window, 'location', { writable: true, value: location });
      expect(peekRoute().spaceId).toBe(spaceId);
    }
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});

describe('parseRoute with /cept/app/ base', () => {
  beforeEach(() => setBasePath('/cept/app/'));

  it('strips base to parse space route', () => {
    const route = parseRoute('/cept/app/s/work/page-1');
    expect(route).toEqual({ space: 'user', spaceId: 'work', pageId: 'page-1' });
  });

  it('strips base to parse docs route', () => {
    const route = parseRoute('/cept/app/docs/getting-started');
    expect(route).toEqual({ space: 'docs', spaceId: 'docs', pageId: 'getting-started' });
  });

  it('returns default for base root', () => {
    const route = parseRoute('/cept/app/');
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: undefined });
  });

  it('returns default for base without trailing slash', () => {
    const route = parseRoute('/cept/app');
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: undefined });
  });
});

describe('buildPath with /cept/app/ base', () => {
  beforeEach(() => setBasePath('/cept/app/'));

  it('builds space + page path with base', () => {
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe(
      '/cept/app/s/work/page-1',
    );
  });

  it('builds docs path with base', () => {
    expect(buildPath({ space: 'docs', pageId: 'api-ref' })).toBe('/cept/app/docs/api-ref');
  });

  it('builds root with base for default space', () => {
    expect(buildPath({ space: 'user', spaceId: 'default' })).toBe('/cept/app/');
  });
});

describe('parseRoute with /cept/pr-42/ base (preview)', () => {
  beforeEach(() => setBasePath('/cept/pr-42/'));

  it('strips preview base to parse space route', () => {
    const route = parseRoute('/cept/pr-42/s/work/page-1');
    expect(route).toEqual({ space: 'user', spaceId: 'work', pageId: 'page-1' });
  });

  it('strips preview base to parse docs route', () => {
    const route = parseRoute('/cept/pr-42/docs');
    expect(route).toEqual({ space: 'docs', spaceId: 'docs', pageId: undefined });
  });

  it('returns default for preview base root', () => {
    const route = parseRoute('/cept/pr-42/');
    expect(route).toEqual({ space: 'user', spaceId: 'default', pageId: undefined });
  });
});

describe('buildPath with /cept/pr-42/ base (preview)', () => {
  beforeEach(() => setBasePath('/cept/pr-42/'));

  it('builds space + page path with preview base', () => {
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe(
      '/cept/pr-42/s/work/page-1',
    );
  });

  it('builds docs path with preview base', () => {
    expect(buildPath({ space: 'docs' })).toBe('/cept/pr-42/docs');
  });
});

describe('isRemoteSpaceId', () => {
  it('returns true for git space IDs with @', () => {
    expect(isRemoteSpaceId('github.com/nsheaps/cept@main')).toBe(true);
    expect(isRemoteSpaceId('github.com/nsheaps/cept@main/docs')).toBe(true);
  });

  it('returns false for local space IDs', () => {
    expect(isRemoteSpaceId('default')).toBe(false);
    expect(isRemoteSpaceId('space-1234567890')).toBe(false);
  });
});

describe('git space URL parsing with /g/ prefix (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('parses git space root (no subpath)', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main',
      pageId: undefined,
    });
  });

  it('parses git space root with subpath', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/docs');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: undefined,
    });
  });

  it('parses git space with page (no subpath)', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/getting-started.md');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main',
      pageId: 'getting-started.md',
    });
  });

  it('parses git space with subpath and page', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/docs/getting-started.md');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'getting-started.md',
    });
  });
});

describe('legacy /s/ git space URL parsing (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('still parses legacy /s/ git space root', () => {
    const route = parseRoute('/s/github.com/nsheaps/cept/blob/main');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main',
      pageId: undefined,
    });
  });

  it('still parses legacy /s/ git space with subpath and page', () => {
    const route = parseRoute('/s/github.com/nsheaps/cept/blob/main/docs/getting-started.md');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'getting-started.md',
    });
  });
});

describe('git space URL building with /g/ prefix (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('builds git space root URL', () => {
    expect(buildPath({ space: 'user', spaceId: 'github.com/nsheaps/cept@main' })).toBe(
      '/g/github.com/nsheaps/cept/blob/main',
    );
  });

  it('builds git space root URL with subpath', () => {
    expect(buildPath({ space: 'user', spaceId: 'github.com/nsheaps/cept@main/docs' })).toBe(
      '/g/github.com/nsheaps/cept/blob/main/docs',
    );
  });

  it('builds git space page URL', () => {
    expect(
      buildPath({ space: 'user', spaceId: 'github.com/nsheaps/cept@main', pageId: 'README.md' }),
    ).toBe('/g/github.com/nsheaps/cept/blob/main/README.md');
  });

  it('builds git space page URL with subpath', () => {
    expect(
      buildPath({
        space: 'user',
        spaceId: 'github.com/nsheaps/cept@main/docs',
        pageId: 'getting-started.md',
      }),
    ).toBe('/g/github.com/nsheaps/cept/blob/main/docs/getting-started.md');
  });
});

describe('git space URL roundtrip (base=/)', () => {
  beforeEach(() => setBasePath('/'));

  it('roundtrips git space with page', () => {
    const spaceId = 'github.com/nsheaps/cept@main/docs';
    const pageId = 'getting-started.md';
    const path = buildPath({ space: 'user', spaceId, pageId });
    const route = parseRoute(path);
    expect(route.spaceId).toBe(spaceId);
    expect(route.pageId).toBe(pageId);
  });

  it('roundtrips git space root', () => {
    const spaceId = 'github.com/nsheaps/cept@main/docs';
    const path = buildPath({ space: 'user', spaceId });
    const route = parseRoute(path);
    expect(route.spaceId).toBe(spaceId);
    expect(route.pageId).toBeUndefined();
  });
});

describe('git space URLs with /cept/pr-42/ base', () => {
  beforeEach(() => setBasePath('/cept/pr-42/'));

  it('builds git space URL with preview base', () => {
    expect(
      buildPath({
        space: 'user',
        spaceId: 'github.com/nsheaps/cept@main/docs',
        pageId: 'README.md',
      }),
    ).toBe('/cept/pr-42/g/github.com/nsheaps/cept/blob/main/docs/README.md');
  });

  it('parses git space URL with preview base', () => {
    const route = parseRoute('/cept/pr-42/g/github.com/nsheaps/cept/blob/main/docs/README.md');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'README.md',
    });
  });

  it('still parses legacy /s/ git space URL with preview base', () => {
    const route = parseRoute('/cept/pr-42/s/github.com/nsheaps/cept/blob/main/docs/README.md');
    expect(route).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'README.md',
    });
  });
});

describe('setUseGitPrefix(false) builds /s/ URLs for git spaces', () => {
  beforeEach(() => {
    setBasePath('/');
    setUseGitPrefix(false);
  });

  it('builds git space URL with /s/ when git prefix disabled', () => {
    expect(buildPath({ space: 'user', spaceId: 'github.com/nsheaps/cept@main' })).toBe(
      '/s/github.com/nsheaps/cept/blob/main',
    );
  });

  it('builds git space page URL with /s/ when git prefix disabled', () => {
    expect(
      buildPath({
        space: 'user',
        spaceId: 'github.com/nsheaps/cept@main/docs',
        pageId: 'README.md',
      }),
    ).toBe('/s/github.com/nsheaps/cept/blob/main/docs/README.md');
  });

  it('local space URLs are unaffected', () => {
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe('/s/work/page-1');
  });
});

describe('git page paths and resolveRoute (base=/)', () => {
  beforeEach(() => {
    setBasePath('/');
    setUseGitPrefix(true);
  });

  const SPACES = [
    'default',
    'github.com/nsheaps/cept@main',
    'github.com/nsheaps/cept@main/docs',
    'github.com/nsheaps/cept@dev/docs',
  ];

  it('treats a path without a Markdown file as the space subpath', () => {
    expect(parseRoute('/g/github.com/nsheaps/cept/blob/main/docs/guides')).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs/guides',
      pageId: undefined,
    });
  });

  it('gives a page path to the existing space with the longest matching subpath', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/docs/guides/setup.md');
    expect(resolveRoute(route, SPACES)).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'guides/setup.md',
    });
  });

  it('opens a folder page of an existing space', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/docs/guides');
    expect(resolveRoute(route, SPACES)).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main/docs',
      pageId: 'guides',
    });
  });

  it('falls back to the repo root space and never matches a partial segment', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/main/docsx/a.md');
    expect(resolveRoute(route, SPACES)).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@main',
      pageId: 'docsx/a.md',
    });
  });

  it('opens the space root when the path is its subpath', () => {
    const route = parseRoute('/g/github.com/nsheaps/cept/blob/dev/docs');
    expect(resolveRoute(route, SPACES)).toEqual({
      space: 'user',
      spaceId: 'github.com/nsheaps/cept@dev/docs',
      pageId: undefined,
    });
  });

  it('leaves routes no space matches, local routes and not-found routes alone', () => {
    const other = parseRoute('/g/github.com/someone/else/blob/main/a.md');
    expect(resolveRoute(other, SPACES)).toBe(other);
    const local = parseRoute('/s/work/page-1');
    expect(resolveRoute(local, SPACES)).toBe(local);
    const missing = parseRoute('/x/y');
    expect(resolveRoute(missing, SPACES)).toBe(missing);
  });

  it('round-trips a nested git page through resolveRoute', () => {
    const spaceId = 'github.com/nsheaps/cept@main/docs';
    const pageId = 'guides/Set up/index.md';
    const path = buildPath({ space: 'user', spaceId, pageId });
    expect(path).toBe('/g/github.com/nsheaps/cept/blob/main/docs/guides/Set%20up/index.md');
    expect(resolveRoute(parseRoute(path), SPACES)).toEqual({ space: 'user', spaceId, pageId });
  });
});
