import { describe, it, expect, beforeEach } from 'vitest';
import { CeptSearchIndex } from './engine.ts';

describe('CeptSearchIndex', () => {
  let index: CeptSearchIndex;

  beforeEach(() => {
    index = new CeptSearchIndex();
  });

  describe('indexPage', () => {
    it('indexes a page and makes it searchable', async () => {
      await index.indexPage('p1', 'Getting Started', 'Welcome to Cept, a Notion clone.', '/getting-started');
      const results = await index.search('cept');
      expect(results).toHaveLength(1);
      expect(results[0].pageId).toBe('p1');
      expect(results[0].title).toBe('Getting Started');
      expect(results[0].path).toBe('/getting-started');
    });

    it('re-indexes a page without duplicates', async () => {
      await index.indexPage('p1', 'Old Title', 'old content', '/page');
      await index.indexPage('p1', 'New Title', 'new content', '/page');
      expect(index.size).toBe(1);
      const results = await index.search('new');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('New Title');
    });
  });

  describe('indexDatabase', () => {
    it('indexes database values and makes them searchable', async () => {
      await index.indexDatabase('db1', {
        title: 'Projects',
        description: 'All active projects and their status',
      });
      const results = await index.search('projects');
      expect(results).toHaveLength(1);
      expect(results[0].matchType).toBe('database');
    });
  });

  describe('removePage', () => {
    it('removes a page from the index', async () => {
      await index.indexPage('p1', 'Test Page', 'Some content here', '/test');
      await index.removePage('p1');
      const results = await index.search('test');
      expect(results).toHaveLength(0);
      expect(index.size).toBe(0);
    });

    it('does nothing for non-existent pages', async () => {
      await index.removePage('nonexistent');
      expect(index.size).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await index.indexPage('p1', 'Getting Started Guide', 'Welcome to Cept. This guide helps you get started.', '/getting-started');
      await index.indexPage('p2', 'Advanced Features', 'Learn about databases, graphs, and collaboration.', '/advanced');
      await index.indexPage('p3', 'Database Tutorial', 'Create your first database with tables and views.', '/database-tutorial');
      await index.indexDatabase('db1', { title: 'Tasks', description: 'Task tracking database' });
    });

    it('returns results sorted by relevance', async () => {
      const results = await index.search('database');
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Database Tutorial should rank higher (title match + content match)
      expect(results[0].pageId).toBe('p3');
    });

    it('matches title terms with higher score', async () => {
      const results = await index.search('guide');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].pageId).toBe('p1');
      expect(results[0].matchType).toBe('title');
    });

    it('returns empty for no matches', async () => {
      const results = await index.search('xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('returns empty for empty query', async () => {
      const results = await index.search('');
      expect(results).toHaveLength(0);
    });

    it('respects limit option', async () => {
      const results = await index.search('database', { limit: 1 });
      expect(results).toHaveLength(1);
    });

    it('respects offset option', async () => {
      const all = await index.search('database');
      const offset = await index.search('database', { offset: 1 });
      expect(offset).toHaveLength(all.length - 1);
      if (all.length > 1) {
        expect(offset[0].pageId).toBe(all[1].pageId);
      }
    });

    it('filters out databases when includeDatabases is false', async () => {
      const results = await index.search('database', { includeDatabases: false });
      for (const r of results) {
        expect(r.matchType).not.toBe('database');
      }
    });

    it('handles multi-word queries', async () => {
      const results = await index.search('getting started');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].pageId).toBe('p1');
    });

    it('is case-insensitive', async () => {
      const results = await index.search('CEPT');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('generates snippets with context', async () => {
      const results = await index.search('collaboration');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].snippet).toContain('collaboration');
    });
  });

  describe('rebuild', () => {
    it('clears the entire index', async () => {
      await index.indexPage('p1', 'Test', 'content', '/test');
      await index.rebuild();
      expect(index.size).toBe(0);
      const results = await index.search('test');
      expect(results).toHaveLength(0);
    });
  });
});
