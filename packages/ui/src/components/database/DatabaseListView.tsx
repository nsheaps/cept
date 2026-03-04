import { useState, useCallback } from 'react';
import type { PropertyDefinition, DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface DatabaseListViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  onRowClick?: (rowId: string) => void;
  onAddRow?: () => void;
}

function getTitleValue(row: DatabaseRow, properties: SchemaProperty[]): string {
  const titleProp = properties.find((p) => p.definition.type === 'title');
  if (!titleProp) return row.id;
  const val = row.properties[titleProp.name];
  return val != null ? String(val) : '';
}

function formatValue(value: unknown, type: PropertyDefinition['type']): string {
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

export function DatabaseListView({
  properties,
  rows,
  onRowClick,
  onAddRow,
}: DatabaseListViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const detailProperties = properties.filter((p) => p.definition.type !== 'title');

  const handleToggle = useCallback((rowId: string) => {
    setExpandedId((prev) => (prev === rowId ? null : rowId));
  }, []);

  return (
    <div className="cept-list-view" data-testid="list-view">
      <div className="cept-list-items" data-testid="list-items">
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          return (
            <div
              key={row.id}
              className={`cept-list-item${isExpanded ? ' is-expanded' : ''}`}
              data-testid={`list-item-${row.id}`}
            >
              <div
                className="cept-list-item-header"
                data-testid={`list-header-${row.id}`}
              >
                <button
                  className="cept-list-item-toggle"
                  onClick={() => handleToggle(row.id)}
                  data-testid={`list-toggle-${row.id}`}
                >
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </button>
                <span
                  className="cept-list-item-title"
                  onClick={() => onRowClick?.(row.id)}
                  data-testid={`list-title-${row.id}`}
                >
                  {getTitleValue(row, properties)}
                </span>
              </div>
              {isExpanded && (
                <div
                  className="cept-list-item-details"
                  data-testid={`list-details-${row.id}`}
                >
                  {detailProperties.map((prop) => (
                    <div
                      key={prop.name}
                      className="cept-list-item-property"
                      data-testid={`list-prop-${row.id}-${prop.name}`}
                    >
                      <span className="cept-list-item-property-name">{prop.name}</span>
                      <span className="cept-list-item-property-value">
                        {formatValue(row.properties[prop.name], prop.definition.type)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onAddRow && (
        <button
          className="cept-list-add"
          onClick={onAddRow}
          data-testid="list-add-item"
        >
          + New
        </button>
      )}
    </div>
  );
}
