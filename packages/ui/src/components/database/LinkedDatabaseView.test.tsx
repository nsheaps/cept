import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkedDatabaseView } from './LinkedDatabaseView.js';
import type { LinkedViewConfig } from './LinkedDatabaseView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Task A', Status: 'Active', Priority: 1 } },
  { id: 'r2', properties: { Name: 'Task B', Status: 'Done', Priority: 2 } },
];

const config: LinkedViewConfig = {
  id: 'lv-1',
  name: 'Active Tasks',
  sourceDatabase: 'tasks-db',
  viewType: 'table',
  filter: { property: 'Status', operator: 'equals', value: 'Active' },
  sort: [{ property: 'Priority', direction: 'asc' }],
};

describe('LinkedDatabaseView', () => {
  it('renders the linked database view', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-view')).toBeDefined();
  });

  it('shows the view name', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-name').textContent).toBe('Active Tasks');
  });

  it('shows source database name', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-source').textContent).toBe('tasks-db');
  });

  it('shows linked icon', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-icon')).toBeDefined();
  });

  it('renders view type tabs', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-tab-table')).toBeDefined();
    expect(screen.getByTestId('linked-db-tab-board')).toBeDefined();
    expect(screen.getByTestId('linked-db-tab-calendar')).toBeDefined();
  });

  it('marks active tab', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-tab-table').className).toContain('is-active');
    expect(screen.getByTestId('linked-db-tab-board').className).not.toContain('is-active');
  });

  it('calls onViewTypeChange when tab clicked', () => {
    const onViewTypeChange = vi.fn();
    render(
      <LinkedDatabaseView
        config={config}
        properties={properties}
        rows={rows}
        onViewTypeChange={onViewTypeChange}
      />,
    );
    fireEvent.click(screen.getByTestId('linked-db-tab-board'));
    expect(onViewTypeChange).toHaveBeenCalledWith('board');
  });

  it('calls onConfigChange when tab clicked', () => {
    const onConfigChange = vi.fn();
    render(
      <LinkedDatabaseView
        config={config}
        properties={properties}
        rows={rows}
        onConfigChange={onConfigChange}
      />,
    );
    fireEvent.click(screen.getByTestId('linked-db-tab-gallery'));
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ viewType: 'gallery' }),
    );
  });

  it('shows placeholder when no renderView', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-placeholder')).toBeDefined();
    expect(screen.getByTestId('linked-db-row-count').textContent).toBe('2 rows');
  });

  it('uses renderView when provided', () => {
    const renderView = vi.fn().mockReturnValue(<div data-testid="custom-view">Custom</div>);
    render(
      <LinkedDatabaseView
        config={config}
        properties={properties}
        rows={rows}
        renderView={renderView}
      />,
    );
    expect(screen.getByTestId('custom-view')).toBeDefined();
    expect(renderView).toHaveBeenCalledWith('table', expect.objectContaining({
      properties,
      rows,
      filter: config.filter,
      sort: config.sort,
    }));
  });

  it('enters name editing on click', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('linked-db-name'));
    expect(screen.getByTestId('linked-db-name-input')).toBeDefined();
  });

  it('saves name on Enter', () => {
    const onConfigChange = vi.fn();
    render(
      <LinkedDatabaseView
        config={config}
        properties={properties}
        rows={rows}
        onConfigChange={onConfigChange}
      />,
    );
    fireEvent.click(screen.getByTestId('linked-db-name'));
    const input = screen.getByTestId('linked-db-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Name' }),
    );
  });

  it('cancels name editing on Escape', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    fireEvent.click(screen.getByTestId('linked-db-name'));
    const input = screen.getByTestId('linked-db-name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('linked-db-name').textContent).toBe('Active Tasks');
  });

  it('respects availableViewTypes', () => {
    render(
      <LinkedDatabaseView
        config={config}
        properties={properties}
        rows={rows}
        availableViewTypes={['table', 'board']}
      />,
    );
    expect(screen.getByTestId('linked-db-tab-table')).toBeDefined();
    expect(screen.getByTestId('linked-db-tab-board')).toBeDefined();
    expect(screen.queryByTestId('linked-db-tab-calendar')).toBeNull();
  });

  it('renders header', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-header')).toBeDefined();
  });

  it('renders toolbar', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-toolbar')).toBeDefined();
  });

  it('renders body', () => {
    render(<LinkedDatabaseView config={config} properties={properties} rows={rows} />);
    expect(screen.getByTestId('linked-db-body')).toBeDefined();
  });
});
