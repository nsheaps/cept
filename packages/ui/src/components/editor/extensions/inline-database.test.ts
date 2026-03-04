import { describe, it, expect } from 'vitest';
import { InlineDatabase, SUPPORTED_VIEW_TYPES } from './inline-database.js';
import type { InlineDatabaseAttrs } from './inline-database.js';

describe('InlineDatabase extension', () => {
  it('has correct name', () => {
    expect(InlineDatabase.name).toBe('inlineDatabase');
  });

  it('is in the block group', () => {
    expect(InlineDatabase.config.group).toBe('block');
  });

  it('is atomic', () => {
    expect(InlineDatabase.config.atom).toBe(true);
  });

  it('supports all standard view types', () => {
    expect(SUPPORTED_VIEW_TYPES).toContain('table');
    expect(SUPPORTED_VIEW_TYPES).toContain('board');
    expect(SUPPORTED_VIEW_TYPES).toContain('calendar');
    expect(SUPPORTED_VIEW_TYPES).toContain('gallery');
    expect(SUPPORTED_VIEW_TYPES).toContain('list');
    expect(SUPPORTED_VIEW_TYPES).toContain('map');
  });

  it('has 6 supported view types', () => {
    expect(SUPPORTED_VIEW_TYPES).toHaveLength(6);
  });

  it('parses from inline-database div', () => {
    const parseRules = InlineDatabase.config.parseHTML?.call(InlineDatabase);
    expect(parseRules).toEqual([{ tag: 'div[data-type="inline-database"]' }]);
  });

  it('defines addAttributes', () => {
    expect(InlineDatabase.config.addAttributes).toBeDefined();
  });

  it('defines renderHTML', () => {
    expect(InlineDatabase.config.renderHTML).toBeDefined();
  });

  it('defines addCommands', () => {
    expect(InlineDatabase.config.addCommands).toBeDefined();
  });

  it('exports InlineDatabaseAttrs type correctly', () => {
    const attrs: InlineDatabaseAttrs = {
      databaseId: 'db-123',
      viewType: 'board',
      title: 'My Projects',
    };
    expect(attrs.databaseId).toBe('db-123');
    expect(attrs.viewType).toBe('board');
    expect(attrs.title).toBe('My Projects');
  });

  it('InlineDatabaseAttrs has optional fields', () => {
    const attrs: InlineDatabaseAttrs = {
      databaseId: 'db-minimal',
    };
    expect(attrs.databaseId).toBe('db-minimal');
    expect(attrs.viewType).toBeUndefined();
    expect(attrs.viewId).toBeUndefined();
    expect(attrs.title).toBeUndefined();
  });
});
