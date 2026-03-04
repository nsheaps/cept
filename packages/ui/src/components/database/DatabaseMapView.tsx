import { useMemo } from 'react';
import type { DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface MapMarker {
  rowId: string;
  title: string;
  lat: number;
  lng: number;
}

export interface DatabaseMapViewProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  locationProperty: string;
  onRowClick?: (rowId: string) => void;
  onAddRow?: (lat: number, lng: number) => void;
  renderMap?: (markers: MapMarker[], onMarkerClick?: (rowId: string) => void) => React.ReactNode;
}

function getTitleValue(row: DatabaseRow, properties: SchemaProperty[]): string {
  const titleProp = properties.find((p) => p.definition.type === 'title');
  if (!titleProp) return row.id;
  const val = row.properties[titleProp.name];
  return val != null ? String(val) : '';
}

function parseLocation(value: unknown): { lat: number; lng: number } | null {
  if (value == null) return null;

  // Object with lat/lng
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const lat = Number(obj.lat ?? obj.latitude);
    const lng = Number(obj.lng ?? obj.longitude ?? obj.lon);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    return null;
  }

  // String format: "lat,lng"
  if (typeof value === 'string') {
    const parts = value.split(',').map((s) => s.trim());
    if (parts.length === 2) {
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
  }

  return null;
}

export function DatabaseMapView({
  properties,
  rows,
  locationProperty,
  onRowClick,
  renderMap,
}: DatabaseMapViewProps) {
  const markers = useMemo(() => {
    const result: MapMarker[] = [];
    for (const row of rows) {
      const loc = parseLocation(row.properties[locationProperty]);
      if (!loc) continue;
      result.push({
        rowId: row.id,
        title: getTitleValue(row, properties),
        lat: loc.lat,
        lng: loc.lng,
      });
    }
    return result;
  }, [rows, locationProperty, properties]);

  return (
    <div className="cept-map-view" data-testid="map-view">
      {renderMap ? (
        <div className="cept-map-container" data-testid="map-container">
          {renderMap(markers, onRowClick)}
        </div>
      ) : (
        <div className="cept-map-placeholder" data-testid="map-placeholder">
          <div className="cept-map-placeholder-text">Map view</div>
          <div className="cept-map-placeholder-count" data-testid="map-marker-count">
            {markers.length} locations
          </div>
        </div>
      )}

      <div className="cept-map-marker-list" data-testid="map-marker-list">
        {markers.map((marker) => (
          <div
            key={marker.rowId}
            className="cept-map-marker-item"
            onClick={() => onRowClick?.(marker.rowId)}
            data-testid={`map-marker-${marker.rowId}`}
          >
            <span className="cept-map-marker-title">{marker.title}</span>
            <span className="cept-map-marker-coords" data-testid={`map-coords-${marker.rowId}`}>
              {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
