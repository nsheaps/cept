/**
 * Relations and rollups for database properties.
 *
 * Relations link rows between databases. Rollups aggregate
 * values from related rows (count, sum, avg, min, max, etc.).
 */

import type { DatabaseRow } from '../models/index.js';

/** Relation value is an array of row IDs from the target database */
export type RelationValue = string[];

/** Rollup function types */
export type RollupFunction =
  | 'count'
  | 'count_values'
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'percent_empty'
  | 'percent_not_empty'
  | 'show_original';

/** Configuration for a relation property */
export interface RelationConfig {
  targetDatabase: string;
  targetProperty?: string;
  isBidirectional?: boolean;
}

/** Configuration for a rollup property */
export interface RollupConfig {
  relationProperty: string;
  targetProperty: string;
  function: RollupFunction;
}

/**
 * Resolves related rows from a relation value.
 * Given a row's relation value (array of target row IDs),
 * returns matching rows from the target database.
 */
export function resolveRelation(
  relationValue: RelationValue,
  targetRows: DatabaseRow[],
): DatabaseRow[] {
  const idSet = new Set(relationValue);
  return targetRows.filter((row) => idSet.has(row.id));
}

/**
 * Gets the values of a specific property from an array of rows.
 */
export function getRelatedValues(
  rows: DatabaseRow[],
  propertyName: string,
): unknown[] {
  return rows.map((row) => row.properties[propertyName]).filter((v) => v != null);
}

/**
 * Computes a rollup value from related rows.
 */
export function computeRollup(
  relatedRows: DatabaseRow[],
  targetProperty: string,
  rollupFn: RollupFunction,
): unknown {
  if (rollupFn === 'count') {
    return relatedRows.length;
  }

  const values = getRelatedValues(relatedRows, targetProperty);

  if (rollupFn === 'count_values') {
    return values.length;
  }

  if (rollupFn === 'show_original') {
    return values;
  }

  if (rollupFn === 'percent_empty') {
    if (relatedRows.length === 0) return 0;
    const empty = relatedRows.filter(
      (r) => r.properties[targetProperty] == null || r.properties[targetProperty] === '',
    ).length;
    return Math.round((empty / relatedRows.length) * 100);
  }

  if (rollupFn === 'percent_not_empty') {
    if (relatedRows.length === 0) return 0;
    const notEmpty = relatedRows.filter(
      (r) => r.properties[targetProperty] != null && r.properties[targetProperty] !== '',
    ).length;
    return Math.round((notEmpty / relatedRows.length) * 100);
  }

  // Numeric rollups
  const numbers = values.map(Number).filter((n) => !isNaN(n));
  if (numbers.length === 0) return null;

  if (rollupFn === 'sum') {
    return numbers.reduce((a, b) => a + b, 0);
  }

  if (rollupFn === 'average') {
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  if (rollupFn === 'min') {
    return Math.min(...numbers);
  }

  if (rollupFn === 'max') {
    return Math.max(...numbers);
  }

  return null;
}

/**
 * Adds a reverse relation when a bidirectional relation is updated.
 * Returns updated target rows with the reverse relation applied.
 */
export function addReverseRelation(
  sourceRowId: string,
  targetRowId: string,
  reverseProperty: string,
  targetRows: DatabaseRow[],
): DatabaseRow[] {
  return targetRows.map((row) => {
    if (row.id !== targetRowId) return row;
    const current = (row.properties[reverseProperty] as RelationValue) ?? [];
    if (current.includes(sourceRowId)) return row;
    return {
      ...row,
      properties: {
        ...row.properties,
        [reverseProperty]: [...current, sourceRowId],
      },
    };
  });
}

/**
 * Removes a reverse relation when a bidirectional relation is removed.
 */
export function removeReverseRelation(
  sourceRowId: string,
  targetRowId: string,
  reverseProperty: string,
  targetRows: DatabaseRow[],
): DatabaseRow[] {
  return targetRows.map((row) => {
    if (row.id !== targetRowId) return row;
    const current = (row.properties[reverseProperty] as RelationValue) ?? [];
    return {
      ...row,
      properties: {
        ...row.properties,
        [reverseProperty]: current.filter((id) => id !== sourceRowId),
      },
    };
  });
}
