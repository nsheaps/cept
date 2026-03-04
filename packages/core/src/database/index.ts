/**
 * Database engine interface.
 *
 * Provides CRUD, filter, sort, group, and formula evaluation
 * for Cept databases stored as YAML files.
 */

import type {
  DatabaseSchema,
  DatabaseRow,
  FilterConfig,
  SortConfig,
  ViewConfig,
} from '../models/index.js';

/** Query options for database operations */
export interface DatabaseQuery {
  filter?: FilterConfig;
  sort?: SortConfig[];
  groupBy?: string;
  limit?: number;
  offset?: number;
}

/** Grouped result */
export interface GroupedRows {
  groupKey: string;
  groupValue: unknown;
  rows: DatabaseRow[];
}

/** Database engine interface */
export interface DatabaseEngine {
  /** Get database schema by ID */
  getSchema(databaseId: string): Promise<DatabaseSchema | null>;

  /** Create a new database */
  createDatabase(schema: DatabaseSchema): Promise<void>;

  /** Update database schema */
  updateSchema(databaseId: string, schema: Partial<DatabaseSchema>): Promise<void>;

  /** Delete a database */
  deleteDatabase(databaseId: string): Promise<void>;

  /** Get all rows in a database */
  getRows(databaseId: string, query?: DatabaseQuery): Promise<DatabaseRow[]>;

  /** Get grouped rows */
  getGroupedRows(databaseId: string, query: DatabaseQuery): Promise<GroupedRows[]>;

  /** Add a row */
  addRow(databaseId: string, row: DatabaseRow): Promise<void>;

  /** Update a row */
  updateRow(databaseId: string, rowId: string, properties: Record<string, unknown>): Promise<void>;

  /** Delete a row */
  deleteRow(databaseId: string, rowId: string): Promise<void>;

  /** Get a specific view configuration */
  getView(databaseId: string, viewId: string): Promise<ViewConfig | null>;

  /** Evaluate a formula for a row */
  evaluateFormula(expression: string, row: DatabaseRow, schema: DatabaseSchema): unknown;
}

export { CeptDatabaseEngine } from './engine.js';
