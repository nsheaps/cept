import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseListView } from './DatabaseListView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
  { name: 'Done', definition: { type: 'checkbox' } },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Task A', Status: 'Active', Priority: 2, Done: false } },
  { id: 'r2', properties: { Name: 'Task B', Status: 'Done', Priority: 1, Done: true } },
  { id: 'r3', properties: { Name: 'Task C', Status: 'Draft', Priority: 3, Done: false } },
];

describe('DatabaseListView', () => {
  it('renders the list view', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.getByTestId('list-view')).toBeDefined();
  });

  it('renders list items', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.getByTestId('list-items')).toBeDefined();
  });

  it('renders all rows', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.getByTestId('list-item-r1')).toBeDefined();
    expect(screen.getByTestId('list-item-r2')).toBeDefined();
    expect(screen.getByTestId('list-item-r3')).toBeDefined();
  });

  it('shows row titles', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.getByTestId('list-title-r1').textContent).toBe('Task A');
    expect(screen.getByTestId('list-title-r2').textContent).toBe('Task B');
  });

  it('starts with all items collapsed', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('list-details-r1')).toBeNull();
    expect(screen.queryByTestId('list-details-r2')).toBeNull();
  });

  it('expands item when toggle clicked', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-details-r1')).toBeDefined();
  });

  it('collapses item when toggle clicked again', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-details-r1')).toBeDefined();
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.queryByTestId('list-details-r1')).toBeNull();
  });

  it('only expands one item at a time', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-details-r1')).toBeDefined();
    fireEvent.click(screen.getByTestId('list-toggle-r2'));
    expect(screen.queryByTestId('list-details-r1')).toBeNull();
    expect(screen.getByTestId('list-details-r2')).toBeDefined();
  });

  it('shows property details when expanded', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-prop-r1-Status').textContent).toContain('Active');
    expect(screen.getByTestId('list-prop-r1-Priority').textContent).toContain('2');
  });

  it('formats checkbox values', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-prop-r1-Done').textContent).toContain('\u2610');
    fireEvent.click(screen.getByTestId('list-toggle-r2'));
    expect(screen.getByTestId('list-prop-r2-Done').textContent).toContain('\u2611');
  });

  it('does not show title property in details', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.queryByTestId('list-prop-r1-Name')).toBeNull();
  });

  it('calls onRowClick when title is clicked', () => {
    const onRowClick = vi.fn();
    render(<DatabaseListView properties={properties} rows={rows} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTestId('list-title-r2'));
    expect(onRowClick).toHaveBeenCalledWith('r2');
  });

  it('renders add button when onAddRow provided', () => {
    const onAddRow = vi.fn();
    render(<DatabaseListView properties={properties} rows={rows} onAddRow={onAddRow} />);
    expect(screen.getByTestId('list-add-item')).toBeDefined();
  });

  it('calls onAddRow when add button clicked', () => {
    const onAddRow = vi.fn();
    render(<DatabaseListView properties={properties} rows={rows} onAddRow={onAddRow} />);
    fireEvent.click(screen.getByTestId('list-add-item'));
    expect(onAddRow).toHaveBeenCalled();
  });

  it('does not render add button when onAddRow not provided', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('list-add-item')).toBeNull();
  });

  it('shows toggle arrows', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    const toggle = screen.getByTestId('list-toggle-r1');
    expect(toggle.textContent).toBe('\u25B6');
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe('\u25BC');
  });

  it('marks expanded item with class', () => {
    render(<DatabaseListView properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('list-toggle-r1'));
    expect(screen.getByTestId('list-item-r1').className).toContain('is-expanded');
  });
});
