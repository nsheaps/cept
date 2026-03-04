import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalFsBackend } from '../storage/local-fs.js';
import { CeptDatabaseEngine } from './engine.js';
import type { DatabaseSchema, DatabaseRow } from '../models/index.js';

describe('CeptDatabaseEngine', () => {
  let testDir: string;
  let backend: LocalFsBackend;
  let engine: CeptDatabaseEngine;

  const testSchema: DatabaseSchema = {
    id: 'test-db',
    title: 'Test Database',
    icon: '📋',
    properties: {
      title: { type: 'title' },
      status: {
        type: 'select',
        options: [
          { value: 'Todo', color: 'gray' },
          { value: 'In Progress', color: 'blue' },
          { value: 'Done', color: 'green' },
        ],
      },
      priority: { type: 'number' },
      checked: { type: 'checkbox' },
    },
    views: [
      {
        id: 'view-1',
        name: 'All Tasks',
        type: 'table',
        visibleProperties: ['title', 'status', 'priority'],
      },
      {
        id: 'view-kanban',
        name: 'Board',
        type: 'board',
        groupBy: 'status',
      },
    ],
  };

  const testRows: DatabaseRow[] = [
    {
      id: 'row-1',
      properties: { title: 'Task A', status: 'Todo', priority: 1, checked: false },
    },
    {
      id: 'row-2',
      properties: { title: 'Task B', status: 'In Progress', priority: 3, checked: false },
    },
    {
      id: 'row-3',
      properties: { title: 'Task C', status: 'Done', priority: 2, checked: true },
    },
    {
      id: 'row-4',
      properties: { title: 'Task D', status: 'Todo', priority: 5, checked: false },
    },
  ];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cept-db-test-'));
    backend = new LocalFsBackend(testDir);
    await backend.initialize({ name: 'Test' });
    engine = new CeptDatabaseEngine(backend);
  });

  afterEach(async () => {
    await backend.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createDatabase / getSchema', () => {
    it('should create and retrieve a database schema', async () => {
      await engine.createDatabase(testSchema);
      const schema = await engine.getSchema('test-db');

      expect(schema).not.toBeNull();
      expect(schema!.id).toBe('test-db');
      expect(schema!.title).toBe('Test Database');
      expect(schema!.properties.title.type).toBe('title');
      expect(schema!.views.length).toBe(2);
    });

    it('should return null for non-existent database', async () => {
      const schema = await engine.getSchema('nonexistent');
      expect(schema).toBeNull();
    });

    it('should persist to YAML file', async () => {
      await engine.createDatabase(testSchema);
      const data = await backend.readFile('.cept/databases/test-db.yaml');
      expect(data).not.toBeNull();
      const text = new TextDecoder().decode(data!);
      expect(text).toContain('title: Test Database');
    });
  });

  describe('updateSchema', () => {
    it('should update database title', async () => {
      await engine.createDatabase(testSchema);
      await engine.updateSchema('test-db', { title: 'Updated Title' });

      const schema = await engine.getSchema('test-db');
      expect(schema!.title).toBe('Updated Title');
    });

    it('should throw for non-existent database', async () => {
      await expect(
        engine.updateSchema('nonexistent', { title: 'x' }),
      ).rejects.toThrow();
    });
  });

  describe('deleteDatabase', () => {
    it('should delete a database', async () => {
      await engine.createDatabase(testSchema);
      await engine.deleteDatabase('test-db');

      const schema = await engine.getSchema('test-db');
      expect(schema).toBeNull();
    });
  });

  describe('CRUD rows', () => {
    beforeEach(async () => {
      await engine.createDatabase(testSchema);
    });

    it('should add and retrieve rows', async () => {
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }

      const rows = await engine.getRows('test-db');
      expect(rows.length).toBe(4);
      expect(rows[0].id).toBe('row-1');
    });

    it('should update a row', async () => {
      await engine.addRow('test-db', testRows[0]);
      await engine.updateRow('test-db', 'row-1', { status: 'Done' });

      const rows = await engine.getRows('test-db');
      expect(rows[0].properties.status).toBe('Done');
    });

    it('should delete a row', async () => {
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }
      await engine.deleteRow('test-db', 'row-2');

      const rows = await engine.getRows('test-db');
      expect(rows.length).toBe(3);
      expect(rows.find((r) => r.id === 'row-2')).toBeUndefined();
    });

    it('should throw when updating non-existent row', async () => {
      await expect(
        engine.updateRow('test-db', 'nonexistent', { status: 'x' }),
      ).rejects.toThrow();
    });
  });

  describe('filtering', () => {
    beforeEach(async () => {
      await engine.createDatabase(testSchema);
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }
    });

    it('should filter by equals', async () => {
      const rows = await engine.getRows('test-db', {
        filter: { property: 'status', operator: 'equals', value: 'Todo' },
      });
      expect(rows.length).toBe(2);
      expect(rows.every((r) => r.properties.status === 'Todo')).toBe(true);
    });

    it('should filter by not_equals', async () => {
      const rows = await engine.getRows('test-db', {
        filter: { property: 'status', operator: 'not_equals', value: 'Done' },
      });
      expect(rows.length).toBe(3);
    });

    it('should filter by contains', async () => {
      const rows = await engine.getRows('test-db', {
        filter: { property: 'title', operator: 'contains', value: 'Task' },
      });
      expect(rows.length).toBe(4);
    });

    it('should filter by greater_than', async () => {
      const rows = await engine.getRows('test-db', {
        filter: { property: 'priority', operator: 'greater_than', value: 2 },
      });
      expect(rows.length).toBe(2); // priority 3 and 5
    });

    it('should filter by is_empty', async () => {
      await engine.addRow('test-db', {
        id: 'row-empty',
        properties: { title: '', status: null as unknown },
      });
      const rows = await engine.getRows('test-db', {
        filter: { property: 'status', operator: 'is_empty', value: null },
      });
      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe('row-empty');
    });
  });

  describe('sorting', () => {
    beforeEach(async () => {
      await engine.createDatabase(testSchema);
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }
    });

    it('should sort ascending', async () => {
      const rows = await engine.getRows('test-db', {
        sort: [{ property: 'priority', direction: 'asc' }],
      });
      expect(rows[0].properties.priority).toBe(1);
      expect(rows[3].properties.priority).toBe(5);
    });

    it('should sort descending', async () => {
      const rows = await engine.getRows('test-db', {
        sort: [{ property: 'priority', direction: 'desc' }],
      });
      expect(rows[0].properties.priority).toBe(5);
      expect(rows[3].properties.priority).toBe(1);
    });

    it('should sort strings alphabetically', async () => {
      const rows = await engine.getRows('test-db', {
        sort: [{ property: 'title', direction: 'asc' }],
      });
      expect(rows[0].properties.title).toBe('Task A');
      expect(rows[3].properties.title).toBe('Task D');
    });
  });

  describe('grouping', () => {
    beforeEach(async () => {
      await engine.createDatabase(testSchema);
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }
    });

    it('should group by property', async () => {
      const groups = await engine.getGroupedRows('test-db', {
        groupBy: 'status',
      });

      expect(groups.length).toBe(3); // Todo, In Progress, Done
      const todoGroup = groups.find((g) => g.groupValue === 'Todo');
      expect(todoGroup?.rows.length).toBe(2);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      await engine.createDatabase(testSchema);
      for (const row of testRows) {
        await engine.addRow('test-db', row);
      }
    });

    it('should limit results', async () => {
      const rows = await engine.getRows('test-db', { limit: 2 });
      expect(rows.length).toBe(2);
    });

    it('should offset results', async () => {
      const rows = await engine.getRows('test-db', { offset: 2 });
      expect(rows.length).toBe(2);
      expect(rows[0].id).toBe('row-3');
    });

    it('should combine offset and limit', async () => {
      const rows = await engine.getRows('test-db', { offset: 1, limit: 2 });
      expect(rows.length).toBe(2);
      expect(rows[0].id).toBe('row-2');
    });
  });

  describe('views', () => {
    it('should retrieve a specific view', async () => {
      await engine.createDatabase(testSchema);
      const view = await engine.getView('test-db', 'view-kanban');

      expect(view).not.toBeNull();
      expect(view!.name).toBe('Board');
      expect(view!.type).toBe('board');
      expect(view!.groupBy).toBe('status');
    });

    it('should return null for non-existent view', async () => {
      await engine.createDatabase(testSchema);
      const view = await engine.getView('test-db', 'nonexistent');
      expect(view).toBeNull();
    });
  });

  describe('formula evaluation', () => {
    it('should evaluate simple arithmetic', () => {
      const schema = testSchema;
      const row: DatabaseRow = {
        id: 'r1',
        properties: { priority: 5 },
      };
      const result = engine.evaluateFormula('2 + 3', row, schema);
      expect(result).toBe(5);
    });

    it('should evaluate property references', () => {
      const schema = testSchema;
      const row: DatabaseRow = {
        id: 'r1',
        properties: { priority: 10 },
      };
      const result = engine.evaluateFormula('prop("priority")', row, schema);
      expect(result).toBe(10);
    });
  });
});
