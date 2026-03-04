import { useState, useCallback, useMemo, useRef } from 'react';
import type { DatabaseRow, SelectOption } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface BoardColumn {
  value: string;
  color: string;
  rows: DatabaseRow[];
}

export interface DatabaseBoardViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  groupByProperty: string;
  options?: SelectOption[];
  onRowClick?: (rowId: string) => void;
  onAddRow?: (groupValue: string) => void;
  onMoveRow?: (rowId: string, fromGroup: string, toGroup: string) => void;
}

function getTitleValue(row: DatabaseRow, properties: SchemaProperty[]): string {
  const titleProp = properties.find((p) => p.definition.type === 'title');
  if (!titleProp) return row.id;
  const val = row.properties[titleProp.name];
  return val != null ? String(val) : '';
}

function getPropertyPreview(row: DatabaseRow, properties: SchemaProperty[], groupByProperty: string): { name: string; value: string }[] {
  const previews: { name: string; value: string }[] = [];
  for (const prop of properties) {
    if (prop.definition.type === 'title') continue;
    if (prop.name === groupByProperty) continue;
    const val = row.properties[prop.name];
    if (val == null || val === '') continue;
    previews.push({ name: prop.name, value: String(val) });
    if (previews.length >= 2) break;
  }
  return previews;
}

export function DatabaseBoardView({
  properties,
  rows,
  groupByProperty,
  options = [],
  onRowClick,
  onAddRow,
  onMoveRow,
}: DatabaseBoardViewProps) {
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragSourceColumn = useRef<string | null>(null);

  const columns = useMemo(() => {
    const columnMap = new Map<string, DatabaseRow[]>();

    // Initialize columns from options
    for (const opt of options) {
      columnMap.set(opt.value, []);
    }

    // Add an "Uncategorized" column for rows without a value
    const uncategorized: DatabaseRow[] = [];

    for (const row of rows) {
      const val = row.properties[groupByProperty];
      const key = val != null ? String(val) : '';
      if (key === '') {
        uncategorized.push(row);
      } else if (columnMap.has(key)) {
        columnMap.get(key)!.push(row);
      } else {
        // Value not in options — create a dynamic column
        columnMap.set(key, [row]);
      }
    }

    const result: BoardColumn[] = [];

    // Options-defined columns first
    for (const opt of options) {
      result.push({
        value: opt.value,
        color: opt.color,
        rows: columnMap.get(opt.value) ?? [],
      });
    }

    // Dynamic columns (values not in options)
    for (const [key, colRows] of columnMap) {
      if (options.some((o) => o.value === key)) continue;
      result.push({ value: key, color: '#d1d5db', rows: colRows });
    }

    // Uncategorized last, only if there are rows
    if (uncategorized.length > 0) {
      result.push({ value: '', color: '#e5e7eb', rows: uncategorized });
    }

    return result;
  }, [rows, groupByProperty, options]);

  const handleDragStart = useCallback((rowId: string, columnValue: string) => {
    setDragRowId(rowId);
    dragSourceColumn.current = columnValue;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnValue: string) => {
    e.preventDefault();
    setDragOverColumn(columnValue);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((columnValue: string) => {
    if (dragRowId && dragSourceColumn.current != null && dragSourceColumn.current !== columnValue) {
      onMoveRow?.(dragRowId, dragSourceColumn.current, columnValue);
    }
    setDragRowId(null);
    setDragOverColumn(null);
    dragSourceColumn.current = null;
  }, [dragRowId, onMoveRow]);

  const handleDragEnd = useCallback(() => {
    setDragRowId(null);
    setDragOverColumn(null);
    dragSourceColumn.current = null;
  }, []);

  return (
    <div className="cept-board-view" data-testid="board-view">
      <div className="cept-board-columns" data-testid="board-columns">
        {columns.map((column) => (
          <div
            key={column.value || '__uncategorized'}
            className={`cept-board-column${dragOverColumn === column.value ? ' is-drag-over' : ''}`}
            data-testid={`board-column-${column.value || 'uncategorized'}`}
            onDragOver={(e) => handleDragOver(e, column.value)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(column.value)}
          >
            <div className="cept-board-column-header" data-testid={`board-column-header-${column.value || 'uncategorized'}`}>
              <span
                className="cept-board-column-color"
                style={{ backgroundColor: column.color }}
              />
              <span className="cept-board-column-title">
                {column.value || 'Uncategorized'}
              </span>
              <span className="cept-board-column-count" data-testid={`board-column-count-${column.value || 'uncategorized'}`}>
                {column.rows.length}
              </span>
            </div>

            <div className="cept-board-column-cards">
              {column.rows.map((row) => (
                <div
                  key={row.id}
                  className={`cept-board-card${dragRowId === row.id ? ' is-dragging' : ''}`}
                  data-testid={`board-card-${row.id}`}
                  draggable
                  onDragStart={() => handleDragStart(row.id, column.value)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onRowClick?.(row.id)}
                >
                  <div className="cept-board-card-title">
                    {getTitleValue(row, properties)}
                  </div>
                  {getPropertyPreview(row, properties, groupByProperty).map((preview) => (
                    <div key={preview.name} className="cept-board-card-property">
                      <span className="cept-board-card-property-name">{preview.name}</span>
                      <span className="cept-board-card-property-value">{preview.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {onAddRow && (
              <button
                className="cept-board-add-card"
                onClick={() => onAddRow(column.value)}
                data-testid={`board-add-card-${column.value || 'uncategorized'}`}
              >
                + New
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
