import { useState, useCallback } from 'react';
import type { PropertyType, PropertyDefinition } from '@cept/core';

export interface SchemaProperty {
  name: string;
  definition: PropertyDefinition;
}

export interface DatabaseSchemaEditorProps {
  properties: SchemaProperty[];
  onAddProperty: (name: string, definition: PropertyDefinition) => void;
  onUpdateProperty: (oldName: string, newName: string, definition: PropertyDefinition) => void;
  onDeleteProperty: (name: string) => void;
  onReorderProperties: (properties: SchemaProperty[]) => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'date', label: 'Date' },
  { value: 'person', label: 'Person' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'files', label: 'Files' },
  { value: 'formula', label: 'Formula' },
  { value: 'relation', label: 'Relation' },
  { value: 'rollup', label: 'Rollup' },
  { value: 'created_time', label: 'Created time' },
  { value: 'last_edited_time', label: 'Last edited time' },
  { value: 'created_by', label: 'Created by' },
  { value: 'last_edited_by', label: 'Last edited by' },
];

export function DatabaseSchemaEditor({
  properties,
  onAddProperty,
  onUpdateProperty,
  onDeleteProperty,
  onReorderProperties,
}: DatabaseSchemaEditorProps) {
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<PropertyType>('text');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PropertyType>('text');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const startEditing = useCallback((prop: SchemaProperty) => {
    setEditingProperty(prop.name);
    setEditName(prop.name);
    setEditType(prop.definition.type);
  }, []);

  const saveEditing = useCallback(() => {
    if (!editingProperty || !editName.trim()) return;
    onUpdateProperty(editingProperty, editName.trim(), { type: editType });
    setEditingProperty(null);
  }, [editingProperty, editName, editType, onUpdateProperty]);

  const cancelEditing = useCallback(() => {
    setEditingProperty(null);
  }, []);

  const handleAddNew = useCallback(() => {
    if (!newName.trim()) return;
    onAddProperty(newName.trim(), { type: newType });
    setNewName('');
    setNewType('text');
    setAddingNew(false);
  }, [newName, newType, onAddProperty]);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...properties];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onReorderProperties(reordered);
    setDragIndex(index);
  }, [dragIndex, properties, onReorderProperties]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  return (
    <div className="cept-schema-editor" data-testid="schema-editor">
      <div className="cept-schema-header">
        <span className="cept-schema-title">Properties</span>
        <button
          className="cept-schema-add-btn"
          onClick={() => setAddingNew(true)}
          data-testid="schema-add-property"
        >
          + Add property
        </button>
      </div>

      <div className="cept-schema-list" data-testid="schema-property-list">
        {properties.map((prop, index) => (
          <div
            key={prop.name}
            className={`cept-schema-property ${dragIndex === index ? 'is-dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            data-testid={`schema-property-${prop.name}`}
          >
            {editingProperty === prop.name ? (
              <div className="cept-schema-property-edit" data-testid={`schema-edit-${prop.name}`}>
                <input
                  className="cept-schema-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEditing();
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  data-testid="schema-edit-name"
                  autoFocus
                />
                <select
                  className="cept-schema-select"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as PropertyType)}
                  data-testid="schema-edit-type"
                >
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
                <button
                  className="cept-schema-btn cept-schema-btn--save"
                  onClick={saveEditing}
                  data-testid="schema-edit-save"
                >
                  Save
                </button>
                <button
                  className="cept-schema-btn"
                  onClick={cancelEditing}
                  data-testid="schema-edit-cancel"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="cept-schema-property-view">
                <span className="cept-schema-drag-handle" data-testid={`schema-drag-${prop.name}`}>
                  {'\u2630'}
                </span>
                <span className="cept-schema-property-name" data-testid={`schema-name-${prop.name}`}>
                  {prop.name}
                </span>
                <span className="cept-schema-property-type" data-testid={`schema-type-${prop.name}`}>
                  {PROPERTY_TYPES.find((pt) => pt.value === prop.definition.type)?.label ?? prop.definition.type}
                </span>
                {prop.definition.type !== 'title' && (
                  <>
                    <button
                      className="cept-schema-btn"
                      onClick={() => startEditing(prop)}
                      data-testid={`schema-edit-btn-${prop.name}`}
                    >
                      Edit
                    </button>
                    <button
                      className="cept-schema-btn cept-schema-btn--danger"
                      onClick={() => onDeleteProperty(prop.name)}
                      data-testid={`schema-delete-${prop.name}`}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {addingNew && (
        <div className="cept-schema-add-form" data-testid="schema-add-form">
          <input
            className="cept-schema-input"
            placeholder="Property name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddNew();
              if (e.key === 'Escape') setAddingNew(false);
            }}
            data-testid="schema-new-name"
            autoFocus
          />
          <select
            className="cept-schema-select"
            value={newType}
            onChange={(e) => setNewType(e.target.value as PropertyType)}
            data-testid="schema-new-type"
          >
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt.value} value={pt.value}>{pt.label}</option>
            ))}
          </select>
          <button
            className="cept-schema-btn cept-schema-btn--save"
            onClick={handleAddNew}
            data-testid="schema-new-save"
          >
            Add
          </button>
          <button
            className="cept-schema-btn"
            onClick={() => setAddingNew(false)}
            data-testid="schema-new-cancel"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
