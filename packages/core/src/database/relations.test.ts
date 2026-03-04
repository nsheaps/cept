import { describe, it, expect } from 'vitest';
import {
  resolveRelation,
  getRelatedValues,
  computeRollup,
  addReverseRelation,
  removeReverseRelation,
} from './relations.js';
import type { DatabaseRow } from '../models/index.js';

const targetRows: DatabaseRow[] = [
  { id: 't1', properties: { Name: 'Alpha', Score: 10, Status: 'Active' } },
  { id: 't2', properties: { Name: 'Beta', Score: 20, Status: 'Active' } },
  { id: 't3', properties: { Name: 'Gamma', Score: 30, Status: '' } },
  { id: 't4', properties: { Name: 'Delta', Score: 40, Status: 'Done' } },
];

describe('resolveRelation', () => {
  it('returns matching rows by ID', () => {
    const result = resolveRelation(['t1', 't3'], targetRows);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('t1');
    expect(result[1].id).toBe('t3');
  });

  it('returns empty array for no matches', () => {
    const result = resolveRelation(['x1', 'x2'], targetRows);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty relation', () => {
    const result = resolveRelation([], targetRows);
    expect(result).toHaveLength(0);
  });

  it('ignores non-existent IDs', () => {
    const result = resolveRelation(['t1', 'missing', 't4'], targetRows);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['t1', 't4']);
  });
});

describe('getRelatedValues', () => {
  it('extracts values from specified property', () => {
    const values = getRelatedValues(targetRows, 'Score');
    expect(values).toEqual([10, 20, 30, 40]);
  });

  it('filters out null/undefined values', () => {
    const rows: DatabaseRow[] = [
      { id: 'r1', properties: { Name: 'A', Val: 5 } },
      { id: 'r2', properties: { Name: 'B' } },
      { id: 'r3', properties: { Name: 'C', Val: 10 } },
    ];
    const values = getRelatedValues(rows, 'Val');
    expect(values).toEqual([5, 10]);
  });
});

describe('computeRollup', () => {
  it('count returns number of rows', () => {
    expect(computeRollup(targetRows, 'Score', 'count')).toBe(4);
  });

  it('count returns 0 for empty rows', () => {
    expect(computeRollup([], 'Score', 'count')).toBe(0);
  });

  it('count_values returns number of non-null values', () => {
    const rows: DatabaseRow[] = [
      { id: 'r1', properties: { Val: 5 } },
      { id: 'r2', properties: {} },
      { id: 'r3', properties: { Val: 10 } },
    ];
    expect(computeRollup(rows, 'Val', 'count_values')).toBe(2);
  });

  it('sum adds up numeric values', () => {
    expect(computeRollup(targetRows, 'Score', 'sum')).toBe(100);
  });

  it('average computes mean', () => {
    expect(computeRollup(targetRows, 'Score', 'average')).toBe(25);
  });

  it('min returns smallest value', () => {
    expect(computeRollup(targetRows, 'Score', 'min')).toBe(10);
  });

  it('max returns largest value', () => {
    expect(computeRollup(targetRows, 'Score', 'max')).toBe(40);
  });

  it('show_original returns all values', () => {
    const result = computeRollup(targetRows, 'Name', 'show_original');
    expect(result).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
  });

  it('percent_empty calculates correctly', () => {
    expect(computeRollup(targetRows, 'Status', 'percent_empty')).toBe(25); // t3 has empty status
  });

  it('percent_not_empty calculates correctly', () => {
    expect(computeRollup(targetRows, 'Status', 'percent_not_empty')).toBe(75);
  });

  it('percent_empty returns 0 for empty rows', () => {
    expect(computeRollup([], 'Status', 'percent_empty')).toBe(0);
  });

  it('sum returns null for no numeric values', () => {
    const rows: DatabaseRow[] = [
      { id: 'r1', properties: { Val: 'text' } },
    ];
    expect(computeRollup(rows, 'Val', 'sum')).toBe(null);
  });

  it('numeric rollup returns null for empty rows', () => {
    expect(computeRollup([], 'Score', 'sum')).toBe(null);
  });
});

describe('addReverseRelation', () => {
  const rows: DatabaseRow[] = [
    { id: 't1', properties: { Name: 'A', RelatedTo: [] } },
    { id: 't2', properties: { Name: 'B', RelatedTo: ['existing'] } },
  ];

  it('adds source ID to target row reverse property', () => {
    const result = addReverseRelation('src1', 't1', 'RelatedTo', rows);
    expect(result[0].properties.RelatedTo).toEqual(['src1']);
  });

  it('appends to existing relations', () => {
    const result = addReverseRelation('src1', 't2', 'RelatedTo', rows);
    expect(result[1].properties.RelatedTo).toEqual(['existing', 'src1']);
  });

  it('does not duplicate existing relation', () => {
    const result = addReverseRelation('existing', 't2', 'RelatedTo', rows);
    expect(result[1].properties.RelatedTo).toEqual(['existing']);
  });

  it('does not modify other rows', () => {
    const result = addReverseRelation('src1', 't1', 'RelatedTo', rows);
    expect(result[1]).toBe(rows[1]);
  });
});

describe('removeReverseRelation', () => {
  const rows: DatabaseRow[] = [
    { id: 't1', properties: { Name: 'A', RelatedTo: ['src1', 'src2'] } },
    { id: 't2', properties: { Name: 'B', RelatedTo: ['src1'] } },
  ];

  it('removes source ID from target row', () => {
    const result = removeReverseRelation('src1', 't1', 'RelatedTo', rows);
    expect(result[0].properties.RelatedTo).toEqual(['src2']);
  });

  it('leaves empty array when last relation removed', () => {
    const result = removeReverseRelation('src1', 't2', 'RelatedTo', rows);
    expect(result[1].properties.RelatedTo).toEqual([]);
  });

  it('does not modify other rows', () => {
    const result = removeReverseRelation('src1', 't2', 'RelatedTo', rows);
    expect(result[0]).toBe(rows[0]);
  });
});
