import { useMemo } from 'react';
import type { DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface DatabaseGalleryViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  coverProperty?: string;
  visibleProperties?: string[];
  onRowClick?: (rowId: string) => void;
  onAddRow?: () => void;
}

function getTitleValue(row: DatabaseRow, properties: SchemaProperty[]): string {
  const titleProp = properties.find((p) => p.definition.type === 'title');
  if (!titleProp) return row.id;
  const val = row.properties[titleProp.name];
  return val != null ? String(val) : '';
}

function getCoverUrl(row: DatabaseRow, coverProperty: string): string | null {
  const val = row.properties[coverProperty];
  if (val == null || val === '') return null;
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return String(val[0]);
  return null;
}

export function DatabaseGalleryView({
  properties,
  rows,
  coverProperty,
  visibleProperties,
  onRowClick,
  onAddRow,
}: DatabaseGalleryViewProps) {
  const displayProperties = useMemo(() => {
    if (visibleProperties) {
      return properties.filter(
        (p) => visibleProperties.includes(p.name) && p.definition.type !== 'title',
      );
    }
    return properties.filter((p) => p.definition.type !== 'title').slice(0, 3);
  }, [properties, visibleProperties]);

  return (
    <div className="cept-gallery-view" data-testid="gallery-view">
      <div className="cept-gallery-grid" data-testid="gallery-grid">
        {rows.map((row) => {
          const coverUrl = coverProperty ? getCoverUrl(row, coverProperty) : null;
          return (
            <div
              key={row.id}
              className="cept-gallery-card"
              onClick={() => onRowClick?.(row.id)}
              data-testid={`gallery-card-${row.id}`}
            >
              {coverProperty && (
                <div
                  className="cept-gallery-cover"
                  data-testid={`gallery-cover-${row.id}`}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt=""
                      className="cept-gallery-cover-img"
                      data-testid={`gallery-img-${row.id}`}
                    />
                  ) : (
                    <div className="cept-gallery-cover-empty" />
                  )}
                </div>
              )}
              <div className="cept-gallery-card-body">
                <div className="cept-gallery-card-title" data-testid={`gallery-title-${row.id}`}>
                  {getTitleValue(row, properties)}
                </div>
                {displayProperties.map((prop) => {
                  const val = row.properties[prop.name];
                  if (val == null || val === '') return null;
                  return (
                    <div
                      key={prop.name}
                      className="cept-gallery-card-property"
                      data-testid={`gallery-prop-${row.id}-${prop.name}`}
                    >
                      <span className="cept-gallery-card-property-name">{prop.name}</span>
                      <span className="cept-gallery-card-property-value">
                        {Array.isArray(val) ? val.join(', ') : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {onAddRow && (
        <button
          className="cept-gallery-add"
          onClick={onAddRow}
          data-testid="gallery-add-card"
        >
          + New
        </button>
      )}
    </div>
  );
}
