import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseMapView } from './DatabaseMapView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Location', definition: { type: 'location' } },
  { name: 'Status', definition: { type: 'select' } },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Place A', Location: '40.7128,-74.0060', Status: 'Active' } },
  { id: 'r2', properties: { Name: 'Place B', Location: { lat: 51.5074, lng: -0.1278 }, Status: 'Active' } },
  { id: 'r3', properties: { Name: 'Place C', Location: '48.8566,2.3522', Status: 'Closed' } },
];

describe('DatabaseMapView', () => {
  it('renders the map view', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-view')).toBeDefined();
  });

  it('renders placeholder when no renderMap provided', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-placeholder')).toBeDefined();
  });

  it('shows marker count', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-marker-count').textContent).toBe('3 locations');
  });

  it('renders marker list items', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-marker-r1')).toBeDefined();
    expect(screen.getByTestId('map-marker-r2')).toBeDefined();
    expect(screen.getByTestId('map-marker-r3')).toBeDefined();
  });

  it('shows marker titles', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-marker-r1').textContent).toContain('Place A');
    expect(screen.getByTestId('map-marker-r2').textContent).toContain('Place B');
  });

  it('shows marker coordinates', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-coords-r1').textContent).toBe('40.7128, -74.0060');
    expect(screen.getByTestId('map-coords-r2').textContent).toBe('51.5074, -0.1278');
  });

  it('parses string location format (lat,lng)', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-coords-r3').textContent).toBe('48.8566, 2.3522');
  });

  it('parses object location format ({lat, lng})', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-coords-r2').textContent).toBe('51.5074, -0.1278');
  });

  it('calls onRowClick when marker is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByTestId('map-marker-r2'));
    expect(onRowClick).toHaveBeenCalledWith('r2');
  });

  it('skips rows with null location', () => {
    const rowsWithNull: DatabaseRow[] = [
      ...rows,
      { id: 'r4', properties: { Name: 'No Loc', Status: 'Active' } },
    ];
    render(
      <DatabaseMapView
        properties={properties}
        rows={rowsWithNull}
        locationProperty="Location"
      />,
    );
    expect(screen.queryByTestId('map-marker-r4')).toBeNull();
    expect(screen.getByTestId('map-marker-count').textContent).toBe('3 locations');
  });

  it('skips rows with invalid location string', () => {
    const rowsWithBad: DatabaseRow[] = [
      ...rows,
      { id: 'r4', properties: { Name: 'Bad', Location: 'not-coords', Status: '' } },
    ];
    render(
      <DatabaseMapView
        properties={properties}
        rows={rowsWithBad}
        locationProperty="Location"
      />,
    );
    expect(screen.queryByTestId('map-marker-r4')).toBeNull();
  });

  it('uses custom renderMap when provided', () => {
    const renderMap = vi.fn().mockReturnValue(<div data-testid="custom-map">Custom Map</div>);
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
        renderMap={renderMap}
      />,
    );
    expect(screen.getByTestId('map-container')).toBeDefined();
    expect(screen.getByTestId('custom-map')).toBeDefined();
    expect(renderMap).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ rowId: 'r1', lat: 40.7128, lng: -74.006 }),
      ]),
      undefined,
    );
  });

  it('passes onRowClick to renderMap', () => {
    const renderMap = vi.fn().mockReturnValue(null);
    const onRowClick = vi.fn();
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
        renderMap={renderMap}
        onRowClick={onRowClick}
      />,
    );
    expect(renderMap).toHaveBeenCalledWith(expect.any(Array), onRowClick);
  });

  it('parses object with latitude/longitude keys', () => {
    const rowsAlt: DatabaseRow[] = [
      { id: 'r1', properties: { Name: 'Alt', Location: { latitude: 35.6762, longitude: 139.6503 } } },
    ];
    render(
      <DatabaseMapView
        properties={properties}
        rows={rowsAlt}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-coords-r1').textContent).toBe('35.6762, 139.6503');
  });

  it('renders marker list', () => {
    render(
      <DatabaseMapView
        properties={properties}
        rows={rows}
        locationProperty="Location"
      />,
    );
    expect(screen.getByTestId('map-marker-list')).toBeDefined();
  });
});
