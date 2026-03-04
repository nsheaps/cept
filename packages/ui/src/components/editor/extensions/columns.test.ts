import { describe, it, expect } from 'vitest';
import { Columns, Column } from './columns.js';

describe('Columns extension', () => {
  it('has the correct name', () => {
    expect(Columns.name).toBe('columns');
  });

  it('has default count attribute of 2', () => {
    const attrs = Columns.config.addAttributes?.call(Columns);
    expect(attrs).toBeDefined();
    if (attrs) {
      expect((attrs as Record<string, { default: number }>).count.default).toBe(2);
    }
  });

  it('parses div[data-type="columns"]', () => {
    const parseRules = Columns.config.parseHTML?.call(Columns);
    expect(parseRules).toBeDefined();
    expect(parseRules).toEqual([{ tag: 'div[data-type="columns"]' }]);
  });

  it('has isolating set to true', () => {
    expect(Columns.config.isolating).toBe(true);
  });

  it('defines content as column{2,}', () => {
    expect(Columns.config.content).toBe('column{2,}');
  });
});

describe('Column extension', () => {
  it('has the correct name', () => {
    expect(Column.name).toBe('column');
  });

  it('parses div[data-type="column"]', () => {
    const parseRules = Column.config.parseHTML?.call(Column);
    expect(parseRules).toBeDefined();
    expect(parseRules).toEqual([{ tag: 'div[data-type="column"]' }]);
  });

  it('has isolating set to true', () => {
    expect(Column.config.isolating).toBe(true);
  });

  it('has content as block+', () => {
    expect(Column.config.content).toBe('block+');
  });

  it('belongs to block group', () => {
    expect(Column.config.group).toBe('block');
  });
});
