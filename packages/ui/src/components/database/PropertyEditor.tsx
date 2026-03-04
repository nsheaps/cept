import type { PropertyType } from '@cept/core';

export interface PropertyEditorProps {
  type: PropertyType;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
}

function TextEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Enter text...'}
      data-testid="prop-editor-text"
    />
  );
}

function NumberEditor({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="number"
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      placeholder="Enter number..."
      data-testid="prop-editor-number"
    />
  );
}

function CheckboxEditor({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cept-prop-editor-checkbox" data-testid="prop-editor-checkbox">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        data-testid="prop-editor-checkbox-input"
      />
      <span className="cept-prop-editor-checkbox-label">
        {value ? '\u2611' : '\u2610'}
      </span>
    </label>
  );
}

function DateEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="prop-editor-date"
    />
  );
}

function UrlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="cept-prop-editor-url" data-testid="prop-editor-url">
      <input
        className="cept-prop-editor-input"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        data-testid="prop-editor-url-input"
      />
      {value && (
        <a
          className="cept-prop-editor-url-link"
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="prop-editor-url-link"
        >
          {'\u2197'}
        </a>
      )}
    </div>
  );
}

function EmailEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="name@example.com"
      data-testid="prop-editor-email"
    />
  );
}

function PhoneEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="+1 (555) 000-0000"
      data-testid="prop-editor-phone"
    />
  );
}

function PersonEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="cept-prop-editor-input"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Person name..."
      data-testid="prop-editor-person"
    />
  );
}

function ReadOnlyEditor({ value, label }: { value: string; label: string }) {
  return (
    <div className="cept-prop-editor-readonly" data-testid="prop-editor-readonly">
      <span className="cept-prop-editor-readonly-label">{label}</span>
      <span className="cept-prop-editor-readonly-value">{value}</span>
    </div>
  );
}

export function PropertyEditor({ type, value, onChange, placeholder }: PropertyEditorProps) {
  const strVal = value != null ? String(value) : '';

  switch (type) {
    case 'title':
    case 'text':
      return <TextEditor value={strVal} onChange={onChange} placeholder={placeholder} />;

    case 'number':
      return (
        <NumberEditor
          value={value != null ? Number(value) : null}
          onChange={onChange}
        />
      );

    case 'checkbox':
      return <CheckboxEditor value={Boolean(value)} onChange={onChange} />;

    case 'date':
      return <DateEditor value={strVal} onChange={onChange} />;

    case 'url':
      return <UrlEditor value={strVal} onChange={onChange} />;

    case 'email':
      return <EmailEditor value={strVal} onChange={onChange} />;

    case 'phone':
      return <PhoneEditor value={strVal} onChange={onChange} />;

    case 'person':
      return <PersonEditor value={strVal} onChange={onChange} />;

    case 'created_time':
    case 'last_edited_time':
      return <ReadOnlyEditor value={strVal} label={type === 'created_time' ? 'Created' : 'Edited'} />;

    case 'created_by':
    case 'last_edited_by':
      return <ReadOnlyEditor value={strVal} label={type === 'created_by' ? 'Created by' : 'Edited by'} />;

    case 'formula':
      return <ReadOnlyEditor value={strVal} label="Formula" />;

    default:
      return <TextEditor value={strVal} onChange={onChange} placeholder={placeholder} />;
  }
}
