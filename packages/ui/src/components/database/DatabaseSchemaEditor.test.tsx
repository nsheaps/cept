import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatabaseSchemaEditor } from './DatabaseSchemaEditor.js';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

const mockProperties: SchemaProperty[] = [
  { name: 'Name', definition: { type: 'title' } },
  { name: 'Status', definition: { type: 'select' } },
  { name: 'Priority', definition: { type: 'number' } },
  { name: 'Due Date', definition: { type: 'date' } },
];

const defaultProps = {
  properties: mockProperties,
  onAddProperty: vi.fn(),
  onUpdateProperty: vi.fn(),
  onDeleteProperty: vi.fn(),
  onReorderProperties: vi.fn(),
};

describe('DatabaseSchemaEditor', () => {
  it('renders the schema editor', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-editor')).toBeDefined();
  });

  it('renders all properties', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-property-Name')).toBeDefined();
    expect(screen.getByTestId('schema-property-Status')).toBeDefined();
    expect(screen.getByTestId('schema-property-Priority')).toBeDefined();
    expect(screen.getByTestId('schema-property-Due Date')).toBeDefined();
  });

  it('shows property names', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-name-Name').textContent).toBe('Name');
    expect(screen.getByTestId('schema-name-Status').textContent).toBe('Status');
  });

  it('shows property types', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-type-Status').textContent).toBe('Select');
    expect(screen.getByTestId('schema-type-Priority').textContent).toBe('Number');
  });

  it('does not show edit/delete for title property', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.queryByTestId('schema-edit-btn-Name')).toBeNull();
    expect(screen.queryByTestId('schema-delete-Name')).toBeNull();
  });

  it('shows edit and delete buttons for non-title properties', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-edit-btn-Status')).toBeDefined();
    expect(screen.getByTestId('schema-delete-Status')).toBeDefined();
  });

  it('calls onDeleteProperty when delete is clicked', () => {
    const onDeleteProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onDeleteProperty={onDeleteProperty} />);
    fireEvent.click(screen.getByTestId('schema-delete-Status'));
    expect(onDeleteProperty).toHaveBeenCalledWith('Status');
  });

  it('opens edit mode when edit is clicked', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));
    expect(screen.getByTestId('schema-edit-Status')).toBeDefined();
    expect(screen.getByTestId('schema-edit-name')).toBeDefined();
    expect(screen.getByTestId('schema-edit-type')).toBeDefined();
  });

  it('populates edit form with current values', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));

    const nameInput = screen.getByTestId('schema-edit-name') as HTMLInputElement;
    const typeSelect = screen.getByTestId('schema-edit-type') as HTMLSelectElement;
    expect(nameInput.value).toBe('Status');
    expect(typeSelect.value).toBe('select');
  });

  it('calls onUpdateProperty when save is clicked', () => {
    const onUpdateProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onUpdateProperty={onUpdateProperty} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));

    const nameInput = screen.getByTestId('schema-edit-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'State' } });
    fireEvent.click(screen.getByTestId('schema-edit-save'));

    expect(onUpdateProperty).toHaveBeenCalledWith('Status', 'State', { type: 'select' });
  });

  it('closes edit mode when cancel is clicked', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));
    fireEvent.click(screen.getByTestId('schema-edit-cancel'));

    expect(screen.queryByTestId('schema-edit-Status')).toBeNull();
  });

  it('saves on Enter key', () => {
    const onUpdateProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onUpdateProperty={onUpdateProperty} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));

    const nameInput = screen.getByTestId('schema-edit-name');
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(onUpdateProperty).toHaveBeenCalled();
  });

  it('cancels on Escape key', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Status'));

    const nameInput = screen.getByTestId('schema-edit-name');
    fireEvent.keyDown(nameInput, { key: 'Escape' });
    expect(screen.queryByTestId('schema-edit-Status')).toBeNull();
  });

  it('shows add property button', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-add-property')).toBeDefined();
  });

  it('opens add form when add button is clicked', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-add-property'));
    expect(screen.getByTestId('schema-add-form')).toBeDefined();
    expect(screen.getByTestId('schema-new-name')).toBeDefined();
    expect(screen.getByTestId('schema-new-type')).toBeDefined();
  });

  it('calls onAddProperty when new property is saved', () => {
    const onAddProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onAddProperty={onAddProperty} />);
    fireEvent.click(screen.getByTestId('schema-add-property'));

    const nameInput = screen.getByTestId('schema-new-name');
    fireEvent.change(nameInput, { target: { value: 'Tags' } });

    const typeSelect = screen.getByTestId('schema-new-type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'multi_select' } });

    fireEvent.click(screen.getByTestId('schema-new-save'));
    expect(onAddProperty).toHaveBeenCalledWith('Tags', { type: 'multi_select' });
  });

  it('closes add form on cancel', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('schema-add-property'));
    fireEvent.click(screen.getByTestId('schema-new-cancel'));
    expect(screen.queryByTestId('schema-add-form')).toBeNull();
  });

  it('does not add empty name', () => {
    const onAddProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onAddProperty={onAddProperty} />);
    fireEvent.click(screen.getByTestId('schema-add-property'));
    fireEvent.click(screen.getByTestId('schema-new-save'));
    expect(onAddProperty).not.toHaveBeenCalled();
  });

  it('renders drag handles for reordering', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-drag-Name')).toBeDefined();
    expect(screen.getByTestId('schema-drag-Status')).toBeDefined();
  });

  it('renders property list container', () => {
    render(<DatabaseSchemaEditor {...defaultProps} />);
    expect(screen.getByTestId('schema-property-list')).toBeDefined();
  });

  it('allows type change in edit mode', () => {
    const onUpdateProperty = vi.fn();
    render(<DatabaseSchemaEditor {...defaultProps} onUpdateProperty={onUpdateProperty} />);
    fireEvent.click(screen.getByTestId('schema-edit-btn-Priority'));

    const typeSelect = screen.getByTestId('schema-edit-type') as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'text' } });
    fireEvent.click(screen.getByTestId('schema-edit-save'));

    expect(onUpdateProperty).toHaveBeenCalledWith('Priority', 'Priority', { type: 'text' });
  });
});
