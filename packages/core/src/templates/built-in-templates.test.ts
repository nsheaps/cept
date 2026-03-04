import { describe, it, expect } from 'vitest';
import {
  getBuiltInTemplates,
  getTemplatesByCategory,
  getBuiltInTemplate,
  getTemplateCategories,
  applyTemplateVariables,
  searchTemplates,
} from './built-in-templates.js';

describe('getBuiltInTemplates', () => {
  it('returns all built-in templates', () => {
    const templates = getBuiltInTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('includes both page and database templates', () => {
    const templates = getBuiltInTemplates();
    const types = new Set(templates.map((t) => t.type));
    expect(types.has('page')).toBe(true);
    expect(types.has('database')).toBe(true);
  });

  it('each template has required fields', () => {
    const templates = getBuiltInTemplates();
    for (const t of templates) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.description).toBeDefined();
      expect(t.type).toBeDefined();
      expect(t.content).toBeDefined();
      expect(t.content.length).toBeGreaterThan(0);
    }
  });

  it('all template IDs are unique', () => {
    const templates = getBuiltInTemplates();
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns a copy, not the original array', () => {
    const a = getBuiltInTemplates();
    const b = getBuiltInTemplates();
    expect(a).not.toBe(b);
  });
});

describe('getTemplatesByCategory', () => {
  it('returns templates for a specific category', () => {
    const personal = getTemplatesByCategory('personal');
    expect(personal.length).toBeGreaterThan(0);
    expect(personal.every((t) => t.category === 'personal')).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    const result = getTemplatesByCategory('nonexistent' as 'personal');
    expect(result).toEqual([]);
  });

  it('returns blank templates', () => {
    const blank = getTemplatesByCategory('blank');
    expect(blank.length).toBeGreaterThanOrEqual(2);
  });

  it('returns work templates', () => {
    const work = getTemplatesByCategory('work');
    expect(work.length).toBeGreaterThan(0);
  });

  it('returns engineering templates', () => {
    const eng = getTemplatesByCategory('engineering');
    expect(eng.length).toBeGreaterThan(0);
  });
});

describe('getBuiltInTemplate', () => {
  it('returns a template by ID', () => {
    const template = getBuiltInTemplate('blank-page');
    expect(template).toBeDefined();
    expect(template!.id).toBe('blank-page');
    expect(template!.name).toBe('Blank Page');
  });

  it('returns null for unknown ID', () => {
    expect(getBuiltInTemplate('nonexistent')).toBeNull();
  });

  it('returns journal template', () => {
    const t = getBuiltInTemplate('journal');
    expect(t).toBeDefined();
    expect(t!.content).toContain('Morning');
    expect(t!.content).toContain('{{date}}');
  });

  it('returns meeting notes template', () => {
    const t = getBuiltInTemplate('meeting-notes');
    expect(t).toBeDefined();
    expect(t!.content).toContain('Action Items');
  });

  it('returns task board template', () => {
    const t = getBuiltInTemplate('task-board');
    expect(t).toBeDefined();
    expect(t!.type).toBe('database');
    expect(t!.content).toContain('Status');
  });
});

describe('getTemplateCategories', () => {
  it('returns all unique categories', () => {
    const categories = getTemplateCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain('personal');
    expect(categories).toContain('work');
    expect(categories).toContain('blank');
  });

  it('returns no duplicates', () => {
    const categories = getTemplateCategories();
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe('applyTemplateVariables', () => {
  it('replaces {{title}} variable', () => {
    const result = applyTemplateVariables('# {{title}}', { title: 'My Page' });
    expect(result).toBe('# My Page');
  });

  it('replaces {{date}} with provided value', () => {
    const result = applyTemplateVariables('Date: {{date}}', { date: '2026-01-15' });
    expect(result).toBe('Date: 2026-01-15');
  });

  it('uses default values when variables not provided', () => {
    const result = applyTemplateVariables('# {{title}}');
    expect(result).toBe('# Untitled');
  });

  it('replaces multiple occurrences', () => {
    const result = applyTemplateVariables('{{title}} — {{title}}', { title: 'Test' });
    expect(result).toBe('Test — Test');
  });

  it('replaces all standard variables', () => {
    const content = '{{title}} {{date}} {{datetime}} {{id}}';
    const result = applyTemplateVariables(content, { title: 'X' });
    expect(result).not.toContain('{{title}}');
    expect(result).not.toContain('{{date}}');
    expect(result).not.toContain('{{datetime}}');
    expect(result).not.toContain('{{id}}');
  });

  it('preserves non-variable content', () => {
    const result = applyTemplateVariables('Hello world', { title: 'X' });
    expect(result).toBe('Hello world');
  });
});

describe('searchTemplates', () => {
  it('finds templates by name', () => {
    const results = searchTemplates('journal');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'journal')).toBe(true);
  });

  it('finds templates by description', () => {
    const results = searchTemplates('kanban');
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds templates by category', () => {
    const results = searchTemplates('personal');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const results = searchTemplates('JOURNAL');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty array for no matches', () => {
    expect(searchTemplates('zzzzzzzzzzz')).toEqual([]);
  });
});
