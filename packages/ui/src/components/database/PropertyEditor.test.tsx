import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyEditor } from './PropertyEditor.js';

describe('PropertyEditor', () => {
  describe('text type', () => {
    it('renders text input', () => {
      render(<PropertyEditor type="text" value="hello" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-text')).toBeDefined();
    });

    it('shows current value', () => {
      render(<PropertyEditor type="text" value="hello" onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-text') as HTMLInputElement).value).toBe('hello');
    });

    it('calls onChange on input', () => {
      const onChange = vi.fn();
      render(<PropertyEditor type="text" value="" onChange={onChange} />);
      fireEvent.change(screen.getByTestId('prop-editor-text'), { target: { value: 'world' } });
      expect(onChange).toHaveBeenCalledWith('world');
    });
  });

  describe('title type', () => {
    it('renders as text input', () => {
      render(<PropertyEditor type="title" value="My Page" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-text')).toBeDefined();
    });
  });

  describe('number type', () => {
    it('renders number input', () => {
      render(<PropertyEditor type="number" value={42} onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-number')).toBeDefined();
    });

    it('shows current value', () => {
      render(<PropertyEditor type="number" value={42} onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-number') as HTMLInputElement).value).toBe('42');
    });

    it('calls onChange with number', () => {
      const onChange = vi.fn();
      render(<PropertyEditor type="number" value={0} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('prop-editor-number'), { target: { value: '99' } });
      expect(onChange).toHaveBeenCalledWith(99);
    });

    it('calls onChange with null for empty value', () => {
      const onChange = vi.fn();
      render(<PropertyEditor type="number" value={42} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('prop-editor-number'), { target: { value: '' } });
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe('checkbox type', () => {
    it('renders checkbox', () => {
      render(<PropertyEditor type="checkbox" value={false} onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-checkbox')).toBeDefined();
    });

    it('shows checked state', () => {
      render(<PropertyEditor type="checkbox" value={true} onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-checkbox-input') as HTMLInputElement).checked).toBe(true);
    });

    it('calls onChange on toggle', () => {
      const onChange = vi.fn();
      render(<PropertyEditor type="checkbox" value={false} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('prop-editor-checkbox-input'));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('date type', () => {
    it('renders date input', () => {
      render(<PropertyEditor type="date" value="2026-03-04" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-date')).toBeDefined();
    });

    it('shows current value', () => {
      render(<PropertyEditor type="date" value="2026-03-04" onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-date') as HTMLInputElement).value).toBe('2026-03-04');
    });
  });

  describe('url type', () => {
    it('renders url input', () => {
      render(<PropertyEditor type="url" value="" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-url')).toBeDefined();
    });

    it('shows link when value present', () => {
      render(<PropertyEditor type="url" value="https://example.com" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-url-link')).toBeDefined();
    });

    it('does not show link when empty', () => {
      render(<PropertyEditor type="url" value="" onChange={() => {}} />);
      expect(screen.queryByTestId('prop-editor-url-link')).toBeNull();
    });
  });

  describe('email type', () => {
    it('renders email input', () => {
      render(<PropertyEditor type="email" value="" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-email')).toBeDefined();
    });
  });

  describe('phone type', () => {
    it('renders phone input', () => {
      render(<PropertyEditor type="phone" value="" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-phone')).toBeDefined();
    });
  });

  describe('person type', () => {
    it('renders person input', () => {
      render(<PropertyEditor type="person" value="" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-person')).toBeDefined();
    });
  });

  describe('readonly types', () => {
    it('renders created_time as readonly', () => {
      render(<PropertyEditor type="created_time" value="2026-03-04T12:00:00Z" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-readonly')).toBeDefined();
    });

    it('renders last_edited_time as readonly', () => {
      render(<PropertyEditor type="last_edited_time" value="2026-03-04T12:00:00Z" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-readonly')).toBeDefined();
    });

    it('renders formula as readonly', () => {
      render(<PropertyEditor type="formula" value="42" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-readonly')).toBeDefined();
    });

    it('renders created_by as readonly', () => {
      render(<PropertyEditor type="created_by" value="User" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-readonly')).toBeDefined();
    });
  });

  describe('fallback', () => {
    it('renders text input for unknown types', () => {
      render(<PropertyEditor type={'custom' as never} value="test" onChange={() => {}} />);
      expect(screen.getByTestId('prop-editor-text')).toBeDefined();
    });
  });

  describe('null value handling', () => {
    it('handles null text value', () => {
      render(<PropertyEditor type="text" value={null} onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-text') as HTMLInputElement).value).toBe('');
    });

    it('handles null number value', () => {
      render(<PropertyEditor type="number" value={null} onChange={() => {}} />);
      expect((screen.getByTestId('prop-editor-number') as HTMLInputElement).value).toBe('');
    });
  });

  describe('custom placeholder', () => {
    it('uses custom placeholder for text', () => {
      render(<PropertyEditor type="text" value="" onChange={() => {}} placeholder="Custom..." />);
      expect((screen.getByTestId('prop-editor-text') as HTMLInputElement).placeholder).toBe('Custom...');
    });
  });
});
