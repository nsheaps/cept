import { useState, useCallback, useMemo } from 'react';
import type { PropertyDefinition, SortConfig, SortDirection, FilterConfig, FilterOperator, DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface DatabaseTableViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  sort?: SortConfig[];
  filter?: FilterConfig | null;
  onSortChange?: (sort: SortConfig[]) => void;
  onFilterChange?: (filter: FilterConfig | null) => void;
  onRowClick?: (rowId: string) => void;
  onCellEdit?: (rowId: string, property: string, value: unknown) => void;
  onAddRow?: () => void;
}

function getCellValue(row: DatabaseRow, propertyName: string): unknown {
  return row.properties[propertyName] ?? '';
}

function formatCellValue(value: unknown, type: PropertyDefinition['type']): string {
  if (value == null) return '';
  if (type === 'checkbox') return value ? '\u2611' : '\u2610';
  if (type === 'date' && typeof value === 'string') {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function compareValues(a: unknown, b: unknown, direction: SortDirection): number {
  if (a == null && b == null) return 0;
  if (a == null) return direction === 'asc' ? -1 : 1;
  if (b == null) return direction === 'asc' ? 1 : -1;

  const aNum = Number(a);
  const bNum = Number(b);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return direction === 'asc' ? aNum - bNum : bNum - aNum;
  }

  const aStr = String(a);
  const bStr = String(b);
  const cmp = aStr.localeCompare(bStr);
  return direction === 'asc' ? cmp : -cmp;
}

function matchesFilter(row: DatabaseRow, filter: FilterConfig): boolean {
  const value = getCellValue(row, filter.property);
  const filterVal = filter.value;

  switch (filter.operator) {
    case 'equals':
      return value === filterVal;
    case 'not_equals':
      return value !== filterVal;
    case 'contains':
      return String(value).toLowerCase().includes(String(filterVal).toLowerCase());
    case 'not_contains':
      return !String(value).toLowerCase().includes(String(filterVal).toLowerCase());
    case 'starts_with':
      return String(value).toLowerCase().startsWith(String(filterVal).toLowerCase());
    case 'ends_with':
      return String(value).toLowerCase().endsWith(String(filterVal).toLowerCase());
    case 'is_empty':
      return value == null || value === '';
    case 'is_not_empty':
      return value != null && value !== '';
    case 'greater_than':
      return Number(value) > Number(filterVal);
    case 'less_than':
      return Number(value) < Number(filterVal);
    default:
      return true;
  }
}

const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

export function DatabaseTableView({
  properties,
  rows,
  sort = [],
  filter = null,
  onSortChange,
  onFilterChange,
  onRowClick,
  onAddRow,
}: DatabaseTableViewProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterProperty, setFilterProperty] = useState(properties[0]?.name ?? '');
  const [filterOperator, setFilterOperator] = useState<FilterOperator>('contains');
  const [filterValue, setFilterValue] = useState('');

  const handleSort = useCallback((propertyName: string) => {
    const existing = sort.find((s) => s.property === propertyName);
    let newSort: SortConfig[];
    if (!existing) {
      newSort = [{ property: propertyName, direction: 'asc' }];
    } else if (existing.direction === 'asc') {
      newSort = [{ property: propertyName, direction: 'desc' }];
    } else {
      newSort = [];
    }
    onSortChange?.(newSort);
  }, [sort, onSortChange]);

  const handleApplyFilter = useCallback(() => {
    onFilterChange?.({
      property: filterProperty,
      operator: filterOperator,
      value: filterValue,
    });
    setFilterOpen(false);
  }, [filterProperty, filterOperator, filterValue, onFilterChange]);

  const handleClearFilter = useCallback(() => {
    onFilterChange?.(null);
    setFilterValue('');
  }, [onFilterChange]);

  const processedRows = useMemo(() => {
    let result = [...rows];

    if (filter) {
      result = result.filter((row) => matchesFilter(row, filter));
    }

    if (sort.length > 0) {
      result.sort((a, b) => {
        for (const s of sort) {
          const aVal = getCellValue(a, s.property);
          const bVal = getCellValue(b, s.property);
          const cmp = compareValues(aVal, bVal, s.direction);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }

    return result;
  }, [rows, sort, filter]);

  const getSortIndicator = (propertyName: string): string => {
    const s = sort.find((s) => s.property === propertyName);
    if (!s) return '';
    return s.direction === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <div className="cept-table-view" data-testid="table-view">
      <div className="cept-table-toolbar" data-testid="table-toolbar">
        <button
          className="cept-table-toolbar-btn"
          onClick={() => setFilterOpen(!filterOpen)}
          data-testid="table-filter-toggle"
        >
          Filter
        </button>
        {filter && (
          <span className="cept-table-active-filter" data-testid="table-active-filter">
            {filter.property} {FILTER_OPERATORS.find((o) => o.value === filter.operator)?.label ?? filter.operator}
            {filter.value != null && filter.value !== '' ? ` "${filter.value}"` : ''}
            <button
              className="cept-table-clear-filter"
              onClick={handleClearFilter}
              data-testid="table-clear-filter"
            >
              {'\u2715'}
            </button>
          </span>
        )}
        <span className="cept-table-row-count" data-testid="table-row-count">
          {processedRows.length} rows
        </span>
      </div>

      {filterOpen && (
        <div className="cept-table-filter-form" data-testid="table-filter-form">
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            data-testid="table-filter-property"
          >
            {properties.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterOperator}
            onChange={(e) => setFilterOperator(e.target.value as FilterOperator)}
            data-testid="table-filter-operator"
          >
            {FILTER_OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Value"
            data-testid="table-filter-value"
          />
          <button
            onClick={handleApplyFilter}
            data-testid="table-filter-apply"
          >
            Apply
          </button>
        </div>
      )}

      <div className="cept-table-container" data-testid="table-container">
        <table className="cept-table">
          <thead>
            <tr>
              {properties.map((prop) => (
                <th
                  key={prop.name}
                  className="cept-table-header"
                  onClick={() => handleSort(prop.name)}
                  data-testid={`table-header-${prop.name}`}
                >
                  <span>{prop.name}</span>
                  <span className="cept-table-sort-indicator">
                    {getSortIndicator(prop.name)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedRows.map((row) => (
              <tr
                key={row.id}
                className="cept-table-row"
                onClick={() => onRowClick?.(row.id)}
                data-testid={`table-row-${row.id}`}
              >
                {properties.map((prop) => (
                  <td
                    key={prop.name}
                    className="cept-table-cell"
                    data-testid={`table-cell-${row.id}-${prop.name}`}
                  >
                    {formatCellValue(getCellValue(row, prop.name), prop.definition.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {onAddRow && (
        <button
          className="cept-table-add-row"
          onClick={onAddRow}
          data-testid="table-add-row"
        >
          + New row
        </button>
      )}
    </div>
  );
}
