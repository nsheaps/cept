/**
 * CeptDatabaseEngine — Database engine for Cept workspaces.
 *
 * Manages databases stored as YAML files in .cept/databases/.
 * Supports CRUD operations, filtering, sorting, grouping.
 */

import yaml from 'js-yaml';
import type { StorageBackend } from '../storage/backend.js';
import type {
  DatabaseSchema,
  DatabaseRow,
  FilterConfig,
  SortConfig,
  ViewConfig,
} from '../models/index.js';
import type { DatabaseQuery, GroupedRows } from './index.js';
import { evaluateFormula as formulaEvaluate } from './formula.js';

/** Raw YAML database file structure */
interface DatabaseFile {
  id: string;
  title: string;
  icon?: string;
  properties: Record<string, unknown>;
  views: ViewConfig[];
  rows: DatabaseRow[];
}

export class CeptDatabaseEngine {
  constructor(private backend: StorageBackend) {}

  async getSchema(databaseId: string): Promise<DatabaseSchema | null> {
    const db = await this.readDatabase(databaseId);
    if (!db) return null;
    return {
      id: db.id,
      title: db.title,
      icon: db.icon,
      properties: db.properties as DatabaseSchema['properties'],
      views: db.views,
    };
  }

  async createDatabase(schema: DatabaseSchema): Promise<void> {
    const db: DatabaseFile = {
      id: schema.id,
      title: schema.title,
      icon: schema.icon,
      properties: schema.properties,
      views: schema.views,
      rows: [],
    };
    await this.writeDatabase(schema.id, db);
  }

  async updateSchema(
    databaseId: string,
    update: Partial<DatabaseSchema>,
  ): Promise<void> {
    const db = await this.readDatabase(databaseId);
    if (!db) throw new Error(`Database not found: ${databaseId}`);

    if (update.title !== undefined) db.title = update.title;
    if (update.icon !== undefined) db.icon = update.icon;
    if (update.properties !== undefined) db.properties = update.properties;
    if (update.views !== undefined) db.views = update.views;

    await this.writeDatabase(databaseId, db);
  }

  async deleteDatabase(databaseId: string): Promise<void> {
    const path = this.databasePath(databaseId);
    await this.backend.deleteFile(path);
  }

  async getRows(databaseId: string, query?: DatabaseQuery): Promise<DatabaseRow[]> {
    const db = await this.readDatabase(databaseId);
    if (!db) return [];

    let rows = [...db.rows];

    if (query?.filter) {
      rows = this.applyFilter(rows, query.filter);
    }
    if (query?.sort && query.sort.length > 0) {
      rows = this.applySort(rows, query.sort);
    }
    if (query?.offset) {
      rows = rows.slice(query.offset);
    }
    if (query?.limit) {
      rows = rows.slice(0, query.limit);
    }

    return rows;
  }

  async getGroupedRows(
    databaseId: string,
    query: DatabaseQuery,
  ): Promise<GroupedRows[]> {
    const rows = await this.getRows(databaseId, {
      filter: query.filter,
      sort: query.sort,
    });

    if (!query.groupBy) {
      return [{ groupKey: query.groupBy ?? '', groupValue: 'all', rows }];
    }

    const groups = new Map<string, DatabaseRow[]>();
    for (const row of rows) {
      const value = row.properties[query.groupBy];
      const key = String(value ?? '(empty)');
      const group = groups.get(key);
      if (group) {
        group.push(row);
      } else {
        groups.set(key, [row]);
      }
    }

    return Array.from(groups.entries()).map(([key, groupRows]) => ({
      groupKey: query.groupBy!,
      groupValue: key,
      rows: groupRows,
    }));
  }

  async addRow(databaseId: string, row: DatabaseRow): Promise<void> {
    const db = await this.readDatabase(databaseId);
    if (!db) throw new Error(`Database not found: ${databaseId}`);

    db.rows.push(row);
    await this.writeDatabase(databaseId, db);
  }

  async updateRow(
    databaseId: string,
    rowId: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    const db = await this.readDatabase(databaseId);
    if (!db) throw new Error(`Database not found: ${databaseId}`);

    const row = db.rows.find((r) => r.id === rowId);
    if (!row) throw new Error(`Row not found: ${rowId}`);

    Object.assign(row.properties, properties);
    await this.writeDatabase(databaseId, db);
  }

  async deleteRow(databaseId: string, rowId: string): Promise<void> {
    const db = await this.readDatabase(databaseId);
    if (!db) throw new Error(`Database not found: ${databaseId}`);

    db.rows = db.rows.filter((r) => r.id !== rowId);
    await this.writeDatabase(databaseId, db);
  }

  async getView(databaseId: string, viewId: string): Promise<ViewConfig | null> {
    const db = await this.readDatabase(databaseId);
    if (!db) return null;
    return db.views.find((v) => v.id === viewId) ?? null;
  }

  evaluateFormula(
    expression: string,
    row: DatabaseRow,
    schema: DatabaseSchema,
  ): unknown {
    return formulaEvaluate(expression, row, schema);
  }

  // -- Filtering --

  private applyFilter(rows: DatabaseRow[], filter: FilterConfig): DatabaseRow[] {
    return rows.filter((row) => {
      const value = row.properties[filter.property];
      return matchesFilter(value, filter);
    });
  }

  // -- Sorting --

  private applySort(rows: DatabaseRow[], sorts: SortConfig[]): DatabaseRow[] {
    return [...rows].sort((a, b) => {
      for (const sort of sorts) {
        const valA = a.properties[sort.property];
        const valB = b.properties[sort.property];
        const cmp = compareValues(valA, valB);
        if (cmp !== 0) {
          return sort.direction === 'asc' ? cmp : -cmp;
        }
      }
      return 0;
    });
  }

  // -- File I/O --

  private databasePath(databaseId: string): string {
    return `.cept/databases/${databaseId}.yaml`;
  }

  private async readDatabase(databaseId: string): Promise<DatabaseFile | null> {
    const data = await this.backend.readFile(this.databasePath(databaseId));
    if (!data) return null;

    const text = new TextDecoder().decode(data);
    const parsed = yaml.load(text) as DatabaseFile;
    if (!parsed || typeof parsed !== 'object') return null;

    // Ensure rows array exists
    if (!parsed.rows) parsed.rows = [];
    if (!parsed.views) parsed.views = [];

    return parsed;
  }

  private async writeDatabase(databaseId: string, db: DatabaseFile): Promise<void> {
    const text = yaml.dump(db, { lineWidth: -1 });
    await this.backend.writeFile(
      this.databasePath(databaseId),
      new TextEncoder().encode(text),
    );
  }
}

// -- Filter matching --

function matchesFilter(value: unknown, filter: FilterConfig): boolean {
  const filterValue = filter.value;

  switch (filter.operator) {
    case 'equals':
      return value === filterValue;
    case 'not_equals':
      return value !== filterValue;
    case 'contains':
      return String(value ?? '').includes(String(filterValue ?? ''));
    case 'not_contains':
      return !String(value ?? '').includes(String(filterValue ?? ''));
    case 'starts_with':
      return String(value ?? '').startsWith(String(filterValue ?? ''));
    case 'ends_with':
      return String(value ?? '').endsWith(String(filterValue ?? ''));
    case 'is_empty':
      return value === null || value === undefined || value === '';
    case 'is_not_empty':
      return value !== null && value !== undefined && value !== '';
    case 'greater_than':
      return Number(value) > Number(filterValue);
    case 'less_than':
      return Number(value) < Number(filterValue);
    case 'greater_or_equal':
      return Number(value) >= Number(filterValue);
    case 'less_or_equal':
      return Number(value) <= Number(filterValue);
    default:
      return true;
  }
}

// -- Value comparison --

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b ? 0 : a ? 1 : -1;
  }

  return String(a).localeCompare(String(b));
}

