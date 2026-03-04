import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseGalleryView } from './DatabaseGalleryView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Cover', definition: { type: 'files' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
  { name: 'Tags', definition: { type: 'multi_select' } },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Item A', Cover: 'https://example.com/a.jpg', Status: 'Active', Priority: 1, Tags: ['design', 'ui'] } },
  { id: 'r2', properties: { Name: 'Item B', Cover: 'https://example.com/b.jpg', Status: 'Draft', Priority: 2, Tags: [] } },
  { id: 'r3', properties: { Name: 'Item C', Status: 'Active', Priority: 3, Tags: ['dev'] } },
];

describe('DatabaseGalleryView', () => {
  it('renders the gallery view', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.getByTestId('gallery-view')).toBeDefined();
  });

  it('renders gallery grid', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.getByTestId('gallery-grid')).toBeDefined();
  });

  it('renders cards for each row', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.getByTestId('gallery-card-r1')).toBeDefined();
    expect(screen.getByTestId('gallery-card-r2')).toBeDefined();
    expect(screen.getByTestId('gallery-card-r3')).toBeDefined();
  });

  it('shows card titles', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.getByTestId('gallery-title-r1').textContent).toBe('Item A');
    expect(screen.getByTestId('gallery-title-r2').textContent).toBe('Item B');
  });

  it('renders cover images when coverProperty is set', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} coverProperty="Cover" />);
    expect(screen.getByTestId('gallery-cover-r1')).toBeDefined();
    const img = screen.getByTestId('gallery-img-r1') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/a.jpg');
  });

  it('shows empty cover when row has no cover value', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} coverProperty="Cover" />);
    expect(screen.getByTestId('gallery-cover-r3')).toBeDefined();
    expect(screen.queryByTestId('gallery-img-r3')).toBeNull();
  });

  it('does not render cover section when coverProperty not set', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('gallery-cover-r1')).toBeNull();
  });

  it('shows property previews on cards', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.getByTestId('gallery-prop-r1-Status').textContent).toContain('Active');
    expect(screen.getByTestId('gallery-prop-r1-Priority').textContent).toContain('1');
  });

  it('limits property previews to 3 by default', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    // Properties shown: Cover, Status, Priority (first 3 non-title)
    // Tags on r1 has values but might exceed the 3-property limit
    // Cover is 'https://...' which is truthy, so it shows
    expect(screen.getByTestId('gallery-prop-r1-Cover')).toBeDefined();
    expect(screen.getByTestId('gallery-prop-r1-Status')).toBeDefined();
    expect(screen.getByTestId('gallery-prop-r1-Priority')).toBeDefined();
    expect(screen.queryByTestId('gallery-prop-r1-Tags')).toBeNull();
  });

  it('respects visibleProperties filter', () => {
    render(
      <DatabaseGalleryView
        properties={properties}
        rows={rows}
        visibleProperties={['Status', 'Tags']}
      />,
    );
    expect(screen.getByTestId('gallery-prop-r1-Status')).toBeDefined();
    expect(screen.getByTestId('gallery-prop-r1-Tags')).toBeDefined();
    expect(screen.queryByTestId('gallery-prop-r1-Priority')).toBeNull();
  });

  it('formats array values as comma-separated', () => {
    render(
      <DatabaseGalleryView
        properties={properties}
        rows={rows}
        visibleProperties={['Tags']}
      />,
    );
    expect(screen.getByTestId('gallery-prop-r1-Tags').textContent).toContain('design, ui');
  });

  it('calls onRowClick when card is clicked', () => {
    const onRowClick = vi.fn();
    render(<DatabaseGalleryView properties={properties} rows={rows} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTestId('gallery-card-r2'));
    expect(onRowClick).toHaveBeenCalledWith('r2');
  });

  it('renders add button when onAddRow provided', () => {
    const onAddRow = vi.fn();
    render(<DatabaseGalleryView properties={properties} rows={rows} onAddRow={onAddRow} />);
    expect(screen.getByTestId('gallery-add-card')).toBeDefined();
  });

  it('calls onAddRow when add button clicked', () => {
    const onAddRow = vi.fn();
    render(<DatabaseGalleryView properties={properties} rows={rows} onAddRow={onAddRow} />);
    fireEvent.click(screen.getByTestId('gallery-add-card'));
    expect(onAddRow).toHaveBeenCalled();
  });

  it('does not render add button when onAddRow not provided', () => {
    render(<DatabaseGalleryView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('gallery-add-card')).toBeNull();
  });

  it('handles cover from array value', () => {
    const rowsWithArrayCover: DatabaseRow[] = [
      { id: 'r1', properties: { Name: 'Arr', Cover: ['https://example.com/first.jpg', 'https://example.com/second.jpg'] } },
    ];
    render(
      <DatabaseGalleryView
        properties={properties}
        rows={rowsWithArrayCover}
        coverProperty="Cover"
      />,
    );
    const img = screen.getByTestId('gallery-img-r1') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/first.jpg');
  });
});
