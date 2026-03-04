import { describe, it, expect } from 'vitest';
import {
  getDocPages,
  getDocPagesByCategory,
  getDocPage,
  getDocNavigation,
} from './index.js';

describe('getDocPages', () => {
  it('returns all documentation pages', () => {
    const pages = getDocPages();
    expect(pages.length).toBeGreaterThan(0);
  });

  it('each page has required fields', () => {
    for (const page of getDocPages()) {
      expect(page.slug).toBeDefined();
      expect(page.title).toBeDefined();
      expect(page.description).toBeDefined();
      expect(page.category).toBeDefined();
      expect(page.order).toBeGreaterThan(0);
    }
  });

  it('all slugs are unique', () => {
    const pages = getDocPages();
    const slugs = pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('getDocPagesByCategory', () => {
  it('returns getting-started pages in order', () => {
    const pages = getDocPagesByCategory('getting-started');
    expect(pages.length).toBeGreaterThan(0);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].order).toBeGreaterThanOrEqual(pages[i - 1].order);
    }
  });

  it('returns guide pages', () => {
    const pages = getDocPagesByCategory('guides');
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((p) => p.category === 'guides')).toBe(true);
  });

  it('returns reference pages', () => {
    const pages = getDocPagesByCategory('reference');
    expect(pages.length).toBeGreaterThan(0);
  });

  it('returns migration pages', () => {
    const pages = getDocPagesByCategory('migration');
    expect(pages.length).toBeGreaterThan(0);
  });
});

describe('getDocPage', () => {
  it('finds a page by slug', () => {
    const page = getDocPage('introduction');
    expect(page).toBeDefined();
    expect(page!.title).toBe('Introduction');
  });

  it('returns null for unknown slug', () => {
    expect(getDocPage('nonexistent')).toBeNull();
  });
});

describe('getDocNavigation', () => {
  it('returns navigation structure with all categories', () => {
    const nav = getDocNavigation();
    expect(nav.length).toBe(4);
    expect(nav[0].category).toBe('getting-started');
    expect(nav[1].category).toBe('guides');
    expect(nav[2].category).toBe('reference');
    expect(nav[3].category).toBe('migration');
  });

  it('each section has a label and pages', () => {
    for (const section of getDocNavigation()) {
      expect(section.label).toBeDefined();
      expect(section.pages.length).toBeGreaterThan(0);
    }
  });
});
