import { describe, it, expect } from 'vitest';
import { filterSlashCommands, defaultSlashCommands } from './slash-command.js';

describe('Slash Command', () => {
  describe('defaultSlashCommands', () => {
    it('has all expected block types', () => {
      const titles = defaultSlashCommands.map((c) => c.title);
      expect(titles).toContain('Heading 1');
      expect(titles).toContain('Heading 2');
      expect(titles).toContain('Heading 3');
      expect(titles).toContain('Bullet List');
      expect(titles).toContain('Numbered List');
      expect(titles).toContain('To-do / Checkbox');
      expect(titles).toContain('Code Block');
      expect(titles).toContain('Blockquote');
      expect(titles).toContain('Divider');
      expect(titles).toContain('Callout');
      expect(titles).toContain('Toggle');
      expect(titles).toContain('Image');
      expect(titles).toContain('Embed');
      expect(titles).toContain('Bookmark');
      expect(titles).toContain('Table');
    });

    it('has categories for all items', () => {
      for (const cmd of defaultSlashCommands) {
        expect(cmd.category).toBeTruthy();
      }
    });

    it('has icons for all items', () => {
      for (const cmd of defaultSlashCommands) {
        expect(cmd.icon).toBeTruthy();
      }
    });
  });

  describe('filterSlashCommands', () => {
    it('returns all commands for empty query', () => {
      const result = filterSlashCommands(defaultSlashCommands, '');
      expect(result.length).toBe(defaultSlashCommands.length);
    });

    it('filters by title', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'heading');
      expect(result.length).toBe(3);
      expect(result.every((c) => c.title.includes('Heading'))).toBe(true);
    });

    it('filters by description', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'syntax');
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Code Block');
    });

    it('filters by category', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'media');
      expect(result.length).toBe(3);
    });

    it('is case insensitive', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'HEADING');
      expect(result.length).toBe(3);
    });

    it('finds table command', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'table');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((c) => c.title === 'Table')).toBe(true);
    });

    it('returns empty array for no matches', () => {
      const result = filterSlashCommands(defaultSlashCommands, 'xyznonexistent');
      expect(result.length).toBe(0);
    });
  });
});
