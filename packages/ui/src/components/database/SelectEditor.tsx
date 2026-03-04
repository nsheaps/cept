import { useState, useCallback, useRef, useEffect } from 'react';
import type { SelectOption } from '@cept/core';

export interface SelectEditorProps {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
  onCreateOption?: (value: string) => void;
  placeholder?: string;
}

export interface MultiSelectEditorProps {
  values: string[];
  options: SelectOption[];
  onChange: (values: string[]) => void;
  onCreateOption?: (value: string) => void;
  placeholder?: string;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6', '#f43f5e',
];

export function SelectEditor({
  value,
  options,
  onChange,
  onCreateOption,
  placeholder = 'Select...',
}: SelectEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.value.toLowerCase().includes(search.toLowerCase()),
  );

  const canCreate = search.trim() !== '' && !options.some(
    (opt) => opt.value.toLowerCase() === search.trim().toLowerCase(),
  );

  const handleSelect = useCallback((optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleCreate = useCallback(() => {
    if (canCreate && onCreateOption) {
      onCreateOption(search.trim());
      onChange(search.trim());
      setOpen(false);
      setSearch('');
    }
  }, [canCreate, search, onCreateOption, onChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="cept-select-editor" ref={containerRef} data-testid="select-editor">
      <div
        className="cept-select-trigger"
        onClick={() => setOpen(!open)}
        data-testid="select-trigger"
      >
        {selectedOption ? (
          <span className="cept-select-tag" data-testid="select-value">
            <span
              className="cept-select-color"
              style={{ backgroundColor: selectedOption.color }}
            />
            {selectedOption.value}
            <button
              className="cept-select-clear"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              data-testid="select-clear"
            >
              {'\u2715'}
            </button>
          </span>
        ) : (
          <span className="cept-select-placeholder" data-testid="select-placeholder">
            {placeholder}
          </span>
        )}
      </div>

      {open && (
        <div className="cept-select-dropdown" data-testid="select-dropdown">
          <input
            className="cept-select-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create..."
            autoFocus
            data-testid="select-search"
          />
          <div className="cept-select-options" data-testid="select-options">
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`cept-select-option${value === opt.value ? ' is-selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
                data-testid={`select-option-${opt.value}`}
              >
                <span
                  className="cept-select-color"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.value}
              </div>
            ))}
            {canCreate && onCreateOption && (
              <div
                className="cept-select-create"
                onClick={handleCreate}
                data-testid="select-create"
              >
                Create &quot;{search.trim()}&quot;
              </div>
            )}
            {filteredOptions.length === 0 && !canCreate && (
              <div className="cept-select-empty" data-testid="select-empty">
                No options
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiSelectEditor({
  values,
  options,
  onChange,
  onCreateOption,
  placeholder = 'Select...',
}: MultiSelectEditorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.value.toLowerCase().includes(search.toLowerCase()),
  );

  const canCreate = search.trim() !== '' && !options.some(
    (opt) => opt.value.toLowerCase() === search.trim().toLowerCase(),
  );

  const handleToggle = useCallback((optValue: string) => {
    if (values.includes(optValue)) {
      onChange(values.filter((v) => v !== optValue));
    } else {
      onChange([...values, optValue]);
    }
  }, [values, onChange]);

  const handleRemove = useCallback((optValue: string) => {
    onChange(values.filter((v) => v !== optValue));
  }, [values, onChange]);

  const handleCreate = useCallback(() => {
    if (canCreate && onCreateOption) {
      onCreateOption(search.trim());
      onChange([...values, search.trim()]);
      setSearch('');
    }
  }, [canCreate, search, values, onCreateOption, onChange]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="cept-multiselect-editor" ref={containerRef} data-testid="multiselect-editor">
      <div
        className="cept-multiselect-trigger"
        onClick={() => setOpen(!open)}
        data-testid="multiselect-trigger"
      >
        {values.length > 0 ? (
          <div className="cept-multiselect-tags" data-testid="multiselect-values">
            {values.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span key={v} className="cept-select-tag" data-testid={`multiselect-tag-${v}`}>
                  <span
                    className="cept-select-color"
                    style={{ backgroundColor: opt?.color ?? '#6b7280' }}
                  />
                  {v}
                  <button
                    className="cept-select-clear"
                    onClick={(e) => { e.stopPropagation(); handleRemove(v); }}
                    data-testid={`multiselect-remove-${v}`}
                  >
                    {'\u2715'}
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="cept-select-placeholder" data-testid="multiselect-placeholder">
            {placeholder}
          </span>
        )}
      </div>

      {open && (
        <div className="cept-select-dropdown" data-testid="multiselect-dropdown">
          <input
            className="cept-select-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create..."
            autoFocus
            data-testid="multiselect-search"
          />
          <div className="cept-select-options" data-testid="multiselect-options">
            {filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className={`cept-select-option${values.includes(opt.value) ? ' is-selected' : ''}`}
                onClick={() => handleToggle(opt.value)}
                data-testid={`multiselect-option-${opt.value}`}
              >
                <span
                  className="cept-select-color"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.value}
                {values.includes(opt.value) && (
                  <span className="cept-select-check">{'\u2713'}</span>
                )}
              </div>
            ))}
            {canCreate && onCreateOption && (
              <div
                className="cept-select-create"
                onClick={handleCreate}
                data-testid="multiselect-create"
              >
                Create &quot;{search.trim()}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_COLORS };
