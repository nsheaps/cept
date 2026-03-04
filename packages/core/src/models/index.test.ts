import { describe, it, expect } from 'vitest';
import type { PageMeta, DatabaseSchema, Block } from './index.js';

describe('Core Models', () => {
  it('should define PageMeta type correctly', () => {
    const page: PageMeta = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Test Page',
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
      tags: ['test'],
      properties: {},
    };

    expect(page.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(page.title).toBe('Test Page');
    expect(page.tags).toEqual(['test']);
  });

  it('should define DatabaseSchema type correctly', () => {
    const schema: DatabaseSchema = {
      id: 'db-001',
      title: 'Test Database',
      properties: {
        title: { type: 'title' },
        status: {
          type: 'select',
          options: [
            { value: 'Done', color: 'green' },
            { value: 'In Progress', color: 'blue' },
          ],
        },
      },
      views: [
        {
          id: 'view-1',
          name: 'All Items',
          type: 'table',
          visibleProperties: ['title', 'status'],
        },
      ],
    };

    expect(schema.id).toBe('db-001');
    expect(Object.keys(schema.properties)).toHaveLength(2);
    expect(schema.views[0].type).toBe('table');
  });

  it('should define Block type correctly', () => {
    const block: Block = {
      id: 'block-001',
      type: 'paragraph',
      content: 'Hello, world!',
      attrs: {},
      children: [],
    };

    expect(block.type).toBe('paragraph');
    expect(block.content).toBe('Hello, world!');
    expect(block.children).toHaveLength(0);
  });
});
