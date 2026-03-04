import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRoute, buildPath, restoreRoute, setBasePath } from './router.js';

afterEach(() => {
  setBasePath(null);
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
    expect(buildPath({ space: 'user', spaceId: 'default', pageId: 'page-1' })).toBe('/s/default/page-1');
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
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe('/cept/app/s/work/page-1');
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
    expect(buildPath({ space: 'user', spaceId: 'work', pageId: 'page-1' })).toBe('/cept/pr-42/s/work/page-1');
  });

  it('builds docs path with preview base', () => {
    expect(buildPath({ space: 'docs' })).toBe('/cept/pr-42/docs');
  });
});
