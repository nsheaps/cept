import { useState, useCallback } from 'react';
import type { ViewType, FilterConfig, SortConfig, DatabaseRow } from '@cept/core';
import type { SchemaProperty } from './DatabaseSchemaEditor.js';

export interface LinkedViewConfig {
  id: string;
  name: string;
  sourceDatabase: string;
  viewType: ViewType;
  filter?: FilterConfig | null;
  sort?: SortConfig[];
  groupBy?: string;
  visibleProperties?: string[];
}

export interface LinkedDatabaseViewProps {
  config: LinkedViewConfig;
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  availableViewTypes?: ViewType[];
  onViewTypeChange?: (viewType: ViewType) => void;
  onFilterChange?: (filter: FilterConfig | null) => void;
  onSortChange?: (sort: SortConfig[]) => void;
  onRowClick?: (rowId: string) => void;
  onConfigChange?: (config: LinkedViewConfig) => void;
  renderView?: (viewType: ViewType, props: LinkedViewRenderProps) => React.ReactNode;
}

export interface LinkedViewRenderProps {
  properties: SchemaProperty[];
  rows: DatabaseRow[];
  filter: FilterConfig | null;
  sort: SortConfig[];
  onRowClick?: (rowId: string) => void;
}

const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  table: 'Table',
  board: 'Board',
  calendar: 'Calendar',
  map: 'Map',
  gallery: 'Gallery',
  list: 'List',
};

const DEFAULT_VIEW_TYPES: ViewType[] = ['table', 'board', 'calendar', 'gallery', 'list', 'map'];

export function LinkedDatabaseView({
  config,
  properties,
  rows,
  availableViewTypes = DEFAULT_VIEW_TYPES,
  onViewTypeChange,
  onRowClick,
  onConfigChange,
  renderView,
}: LinkedDatabaseViewProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(config.name);

  const handleViewTypeChange = useCallback((viewType: ViewType) => {
    onViewTypeChange?.(viewType);
    onConfigChange?.({ ...config, viewType });
  }, [config, onViewTypeChange, onConfigChange]);

  const handleNameSave = useCallback(() => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== config.name) {
      onConfigChange?.({ ...config, name: nameValue.trim() });
    } else {
      setNameValue(config.name);
    }
  }, [nameValue, config, onConfigChange]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNameSave();
    if (e.key === 'Escape') {
      setEditingName(false);
      setNameValue(config.name);
    }
  }, [handleNameSave, config.name]);

  const renderProps: LinkedViewRenderProps = {
    properties,
    rows,
    filter: config.filter ?? null,
    sort: config.sort ?? [],
    onRowClick,
  };

  return (
    <div className="cept-linked-db" data-testid="linked-db-view">
      <div className="cept-linked-db-header" data-testid="linked-db-header">
        <span className="cept-linked-db-icon" data-testid="linked-db-icon">
          {'\u2197'}
        </span>
        {editingName ? (
          <input
            className="cept-linked-db-name-input"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            autoFocus
            data-testid="linked-db-name-input"
          />
        ) : (
          <span
            className="cept-linked-db-name"
            onClick={() => setEditingName(true)}
            data-testid="linked-db-name"
          >
            {config.name}
          </span>
        )}
        <span className="cept-linked-db-source" data-testid="linked-db-source">
          {config.sourceDatabase}
        </span>
      </div>

      <div className="cept-linked-db-toolbar" data-testid="linked-db-toolbar">
        <div className="cept-linked-db-view-tabs" data-testid="linked-db-tabs">
          {availableViewTypes.map((vt) => (
            <button
              key={vt}
              className={`cept-linked-db-tab${config.viewType === vt ? ' is-active' : ''}`}
              onClick={() => handleViewTypeChange(vt)}
              data-testid={`linked-db-tab-${vt}`}
            >
              {VIEW_TYPE_LABELS[vt]}
            </button>
          ))}
        </div>
      </div>

      <div className="cept-linked-db-body" data-testid="linked-db-body">
        {renderView ? (
          renderView(config.viewType, renderProps)
        ) : (
          <div className="cept-linked-db-placeholder" data-testid="linked-db-placeholder">
            <span>{VIEW_TYPE_LABELS[config.viewType]} view</span>
            <span className="cept-linked-db-row-count" data-testid="linked-db-row-count">
              {rows.length} rows
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
