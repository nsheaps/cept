import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseTableView } from './DatabaseTableView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
  { name: 'Done', definition: { type: 'checkbox' } },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Task A', Status: 'In Progress', Priority: 2, Done: false } },
  { id: 'r2', properties: { Name: 'Task B', Status: 'Done', Priority: 1, Done: true } },
  { id: 'r3', properties: { Name: 'Task C', Status: 'To Do', Priority: 3, Done: false } },
];

describe('DatabaseTableView', () => {
  it('renders the table view', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-view')).toBeDefined();
  });

  it('renders column headers', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-header-Name')).toBeDefined();
    expect(screen.getByTestId('table-header-Status')).toBeDefined();
    expect(screen.getByTestId('table-header-Priority')).toBeDefined();
    expect(screen.getByTestId('table-header-Done')).toBeDefined();
  });

  it('renders all rows', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-row-r1')).toBeDefined();
    expect(screen.getByTestId('table-row-r2')).toBeDefined();
    expect(screen.getByTestId('table-row-r3')).toBeDefined();
  });

  it('renders cell values', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-cell-r1-Name').textContent).toBe('Task A');
    expect(screen.getByTestId('table-cell-r1-Status').textContent).toBe('In Progress');
    expect(screen.getByTestId('table-cell-r1-Priority').textContent).toBe('2');
  });

  it('formats checkbox values', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-cell-r1-Done').textContent).toBe('\u2610');
    expect(screen.getByTestId('table-cell-r2-Done').textContent).toBe('\u2611');
  });

  it('shows row count', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-row-count').textContent).toBe('3 rows');
  });

  it('calls onRowClick when row is clicked', () => {
    const onRowClick = vi.fn();
    render(<DatabaseTableView properties={properties} rows={rows} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTestId('table-row-r2'));
    expect(onRowClick).toHaveBeenCalledWith('r2');
  });

  it('sorts ascending when header is clicked', () => {
    const onSortChange = vi.fn();
    render(<DatabaseTableView properties={properties} rows={rows} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByTestId('table-header-Name'));
    expect(onSortChange).toHaveBeenCalledWith([{ property: 'Name', direction: 'asc' }]);
  });

  it('sorts descending on second click', () => {
    const onSortChange = vi.fn();
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        sort={[{ property: 'Name', direction: 'asc' }]}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByTestId('table-header-Name'));
    expect(onSortChange).toHaveBeenCalledWith([{ property: 'Name', direction: 'desc' }]);
  });

  it('clears sort on third click', () => {
    const onSortChange = vi.fn();
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        sort={[{ property: 'Name', direction: 'desc' }]}
        onSortChange={onSortChange}
      />
    );
    fireEvent.click(screen.getByTestId('table-header-Name'));
    expect(onSortChange).toHaveBeenCalledWith([]);
  });

  it('sorts rows by column', () => {
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        sort={[{ property: 'Priority', direction: 'asc' }]}
      />
    );
    const tableRows = screen.getAllByTestId(/^table-row-r/);
    expect(tableRows[0].getAttribute('data-testid')).toBe('table-row-r2'); // Priority 1
    expect(tableRows[1].getAttribute('data-testid')).toBe('table-row-r1'); // Priority 2
    expect(tableRows[2].getAttribute('data-testid')).toBe('table-row-r3'); // Priority 3
  });

  it('shows sort indicator', () => {
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        sort={[{ property: 'Priority', direction: 'asc' }]}
      />
    );
    expect(screen.getByTestId('table-header-Priority').textContent).toContain('\u2191');
  });

  it('opens filter form when filter button clicked', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('table-filter-form')).toBeNull();
    fireEvent.click(screen.getByTestId('table-filter-toggle'));
    expect(screen.getByTestId('table-filter-form')).toBeDefined();
  });

  it('applies filter', () => {
    const onFilterChange = vi.fn();
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        onFilterChange={onFilterChange}
      />
    );
    fireEvent.click(screen.getByTestId('table-filter-toggle'));
    fireEvent.change(screen.getByTestId('table-filter-value'), { target: { value: 'Task' } });
    fireEvent.click(screen.getByTestId('table-filter-apply'));
    expect(onFilterChange).toHaveBeenCalledWith({
      property: 'Name',
      operator: 'contains',
      value: 'Task',
    });
  });

  it('filters rows by value', () => {
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        filter={{ property: 'Status', operator: 'equals', value: 'Done' }}
      />
    );
    expect(screen.getByTestId('table-row-count').textContent).toBe('1 rows');
    expect(screen.getByTestId('table-row-r2')).toBeDefined();
    expect(screen.queryByTestId('table-row-r1')).toBeNull();
  });

  it('shows active filter indicator', () => {
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        filter={{ property: 'Status', operator: 'contains', value: 'Done' }}
      />
    );
    expect(screen.getByTestId('table-active-filter')).toBeDefined();
  });

  it('clears filter when clear button clicked', () => {
    const onFilterChange = vi.fn();
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        filter={{ property: 'Status', operator: 'equals', value: 'Done' }}
        onFilterChange={onFilterChange}
      />
    );
    fireEvent.click(screen.getByTestId('table-clear-filter'));
    expect(onFilterChange).toHaveBeenCalledWith(null);
  });

  it('renders add row button when onAddRow provided', () => {
    const onAddRow = vi.fn();
    render(<DatabaseTableView properties={properties} rows={rows} onAddRow={onAddRow} />);
    expect(screen.getByTestId('table-add-row')).toBeDefined();
  });

  it('calls onAddRow when add row button clicked', () => {
    const onAddRow = vi.fn();
    render(<DatabaseTableView properties={properties} rows={rows} onAddRow={onAddRow} />);
    fireEvent.click(screen.getByTestId('table-add-row'));
    expect(onAddRow).toHaveBeenCalled();
  });

  it('does not show add row button when onAddRow not provided', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.queryByTestId('table-add-row')).toBeNull();
  });

  it('renders toolbar', () => {
    render(<DatabaseTableView properties={properties} rows={rows} />);
    expect(screen.getByTestId('table-toolbar')).toBeDefined();
  });

  it('handles contains filter case-insensitively', () => {
    render(
      <DatabaseTableView
        properties={properties}
        rows={rows}
        filter={{ property: 'Status', operator: 'contains', value: 'progress' }}
      />
    );
    expect(screen.getByTestId('table-row-count').textContent).toBe('1 rows');
    expect(screen.getByTestId('table-row-r1')).toBeDefined();
  });

  it('handles is_empty filter', () => {
    const rowsWithEmpty: DatabaseRow[] = [
      ...rows,
      { id: 'r4', properties: { Name: '', Status: '', Priority: null } },
    ];
    render(
      <DatabaseTableView
        properties={properties}
        rows={rowsWithEmpty}
        filter={{ property: 'Name', operator: 'is_empty', value: '' }}
      />
    );
    expect(screen.getByTestId('table-row-count').textContent).toBe('1 rows');
  });
});
