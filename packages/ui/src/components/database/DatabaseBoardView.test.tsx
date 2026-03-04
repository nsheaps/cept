import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseBoardView } from './DatabaseBoardView.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';
import type { DatabaseRow, SelectOption } from '@cept/core';

const properties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
];

const options: SelectOption[] = [
  { value: 'To Do', color: '#94a3b8' },
  { value: 'In Progress', color: '#3b82f6' },
  { value: 'Done', color: '#22c55e' },
];

const rows: DatabaseRow[] = [
  { id: 'r1', properties: { Name: 'Task A', Status: 'In Progress', Priority: 2 } },
  { id: 'r2', properties: { Name: 'Task B', Status: 'Done', Priority: 1 } },
  { id: 'r3', properties: { Name: 'Task C', Status: 'To Do', Priority: 3 } },
  { id: 'r4', properties: { Name: 'Task D', Status: 'To Do', Priority: 1 } },
];

describe('DatabaseBoardView', () => {
  it('renders the board view', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-view')).toBeDefined();
  });

  it('renders columns for each select option', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-column-To Do')).toBeDefined();
    expect(screen.getByTestId('board-column-In Progress')).toBeDefined();
    expect(screen.getByTestId('board-column-Done')).toBeDefined();
  });

  it('renders column headers with titles', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-column-header-To Do').textContent).toContain('To Do');
    expect(screen.getByTestId('board-column-header-In Progress').textContent).toContain('In Progress');
    expect(screen.getByTestId('board-column-header-Done').textContent).toContain('Done');
  });

  it('shows row counts per column', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-column-count-To Do').textContent).toBe('2');
    expect(screen.getByTestId('board-column-count-In Progress').textContent).toBe('1');
    expect(screen.getByTestId('board-column-count-Done').textContent).toBe('1');
  });

  it('renders cards in correct columns', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-card-r1')).toBeDefined();
    expect(screen.getByTestId('board-card-r2')).toBeDefined();
    expect(screen.getByTestId('board-card-r3')).toBeDefined();
    expect(screen.getByTestId('board-card-r4')).toBeDefined();
  });

  it('shows card titles from title property', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-card-r1').textContent).toContain('Task A');
    expect(screen.getByTestId('board-card-r3').textContent).toContain('Task C');
  });

  it('shows property previews on cards', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    // Priority should show as a preview (it's not title or groupBy)
    expect(screen.getByTestId('board-card-r1').textContent).toContain('Priority');
    expect(screen.getByTestId('board-card-r1').textContent).toContain('2');
  });

  it('calls onRowClick when card is clicked', () => {
    const onRowClick = vi.fn();
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByTestId('board-card-r2'));
    expect(onRowClick).toHaveBeenCalledWith('r2');
  });

  it('renders add card buttons when onAddRow provided', () => {
    const onAddRow = vi.fn();
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
        onAddRow={onAddRow}
      />,
    );
    expect(screen.getByTestId('board-add-card-To Do')).toBeDefined();
    expect(screen.getByTestId('board-add-card-In Progress')).toBeDefined();
    expect(screen.getByTestId('board-add-card-Done')).toBeDefined();
  });

  it('calls onAddRow with group value when add button clicked', () => {
    const onAddRow = vi.fn();
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
        onAddRow={onAddRow}
      />,
    );
    fireEvent.click(screen.getByTestId('board-add-card-In Progress'));
    expect(onAddRow).toHaveBeenCalledWith('In Progress');
  });

  it('does not render add card buttons when onAddRow not provided', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.queryByTestId('board-add-card-To Do')).toBeNull();
  });

  it('shows uncategorized column for rows without group value', () => {
    const rowsWithEmpty: DatabaseRow[] = [
      ...rows,
      { id: 'r5', properties: { Name: 'Task E', Status: '', Priority: 0 } },
    ];
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rowsWithEmpty}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-column-uncategorized')).toBeDefined();
    expect(screen.getByTestId('board-card-r5')).toBeDefined();
  });

  it('does not show uncategorized column when all rows have values', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.queryByTestId('board-column-uncategorized')).toBeNull();
  });

  it('creates dynamic columns for values not in options', () => {
    const rowsWithExtra: DatabaseRow[] = [
      ...rows,
      { id: 'r5', properties: { Name: 'Task E', Status: 'Review', Priority: 0 } },
    ];
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rowsWithExtra}
        groupByProperty="Status"
        options={options}
      />,
    );
    expect(screen.getByTestId('board-column-Review')).toBeDefined();
    expect(screen.getByTestId('board-card-r5')).toBeDefined();
  });

  it('works without options (creates columns from data)', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
      />,
    );
    expect(screen.getByTestId('board-column-In Progress')).toBeDefined();
    expect(screen.getByTestId('board-column-Done')).toBeDefined();
    expect(screen.getByTestId('board-column-To Do')).toBeDefined();
  });

  it('makes cards draggable', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    const card = screen.getByTestId('board-card-r1');
    expect(card.getAttribute('draggable')).toBe('true');
  });

  it('adds dragging class during drag', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    const card = screen.getByTestId('board-card-r1');
    fireEvent.dragStart(card);
    expect(card.className).toContain('is-dragging');
  });

  it('calls onMoveRow when card is dropped on a different column', () => {
    const onMoveRow = vi.fn();
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
        onMoveRow={onMoveRow}
      />,
    );
    const card = screen.getByTestId('board-card-r1');
    const targetColumn = screen.getByTestId('board-column-Done');

    fireEvent.dragStart(card);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    expect(onMoveRow).toHaveBeenCalledWith('r1', 'In Progress', 'Done');
  });

  it('does not call onMoveRow when card is dropped on same column', () => {
    const onMoveRow = vi.fn();
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
        onMoveRow={onMoveRow}
      />,
    );
    const card = screen.getByTestId('board-card-r1');
    const sameColumn = screen.getByTestId('board-column-In Progress');

    fireEvent.dragStart(card);
    fireEvent.dragOver(sameColumn);
    fireEvent.drop(sameColumn);

    expect(onMoveRow).not.toHaveBeenCalled();
  });

  it('renders color indicators on column headers', () => {
    const { container } = render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    const colorDots = container.querySelectorAll('.cept-board-column-color');
    expect(colorDots.length).toBeGreaterThanOrEqual(3);
  });

  it('cards are placed in correct columns based on groupBy value', () => {
    render(
      <DatabaseBoardView
        properties={properties}
        rows={rows}
        groupByProperty="Status"
        options={options}
      />,
    );
    // r3 and r4 are "To Do"
    const toDoColumn = screen.getByTestId('board-column-To Do');
    expect(toDoColumn.querySelector('[data-testid="board-card-r3"]')).toBeDefined();
    expect(toDoColumn.querySelector('[data-testid="board-card-r4"]')).toBeDefined();
    // r1 is "In Progress"
    const inProgressColumn = screen.getByTestId('board-column-In Progress');
    expect(inProgressColumn.querySelector('[data-testid="board-card-r1"]')).toBeDefined();
  });

  it('renders empty columns for options with no rows', () => {
    const singleRow: DatabaseRow[] = [
      { id: 'r1', properties: { Name: 'Only', Status: 'To Do', Priority: 1 } },
    ];
    render(
      <DatabaseBoardView
        properties={properties}
        rows={singleRow}
        groupByProperty="Status"
        options={options}
      />,
    );
    // All 3 columns should exist
    expect(screen.getByTestId('board-column-To Do')).toBeDefined();
    expect(screen.getByTestId('board-column-In Progress')).toBeDefined();
    expect(screen.getByTestId('board-column-Done')).toBeDefined();
    // But only To Do has a card
    expect(screen.getByTestId('board-column-count-To Do').textContent).toBe('1');
    expect(screen.getByTestId('board-column-count-In Progress').textContent).toBe('0');
    expect(screen.getByTestId('board-column-count-Done').textContent).toBe('0');
  });
});
