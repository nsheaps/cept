import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectEditor, MultiSelectEditor, DEFAULT_COLORS } from './SelectEditor.js';
import type { SelectOption } from '@cept/core';

const options: SelectOption[] = [
  { value: 'Red', color: '#ef4444' },
  { value: 'Blue', color: '#3b82f6' },
  { value: 'Green', color: '#22c55e' },
];

describe('SelectEditor', () => {
  it('renders the select editor', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    expect(screen.getByTestId('select-editor')).toBeDefined();
  });

  it('shows placeholder when no value', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    expect(screen.getByTestId('select-placeholder').textContent).toBe('Select...');
  });

  it('shows selected value', () => {
    render(<SelectEditor value="Red" options={options} onChange={() => {}} />);
    expect(screen.getByTestId('select-value').textContent).toContain('Red');
  });

  it('opens dropdown on click', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    expect(screen.queryByTestId('select-dropdown')).toBeNull();
    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByTestId('select-dropdown')).toBeDefined();
  });

  it('shows all options in dropdown', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByTestId('select-option-Red')).toBeDefined();
    expect(screen.getByTestId('select-option-Blue')).toBeDefined();
    expect(screen.getByTestId('select-option-Green')).toBeDefined();
  });

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn();
    render(<SelectEditor value={null} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.click(screen.getByTestId('select-option-Blue'));
    expect(onChange).toHaveBeenCalledWith('Blue');
  });

  it('closes dropdown after selection', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.click(screen.getByTestId('select-option-Red'));
    expect(screen.queryByTestId('select-dropdown')).toBeNull();
  });

  it('clears value when clear button clicked', () => {
    const onChange = vi.fn();
    render(<SelectEditor value="Red" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('select-clear'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('filters options by search', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.change(screen.getByTestId('select-search'), { target: { value: 'gre' } });
    expect(screen.getByTestId('select-option-Green')).toBeDefined();
    expect(screen.queryByTestId('select-option-Red')).toBeNull();
    expect(screen.queryByTestId('select-option-Blue')).toBeNull();
  });

  it('shows create option when search has no match', () => {
    const onCreateOption = vi.fn();
    render(
      <SelectEditor
        value={null}
        options={options}
        onChange={() => {}}
        onCreateOption={onCreateOption}
      />,
    );
    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.change(screen.getByTestId('select-search'), { target: { value: 'Purple' } });
    expect(screen.getByTestId('select-create')).toBeDefined();
  });

  it('calls onCreateOption when create clicked', () => {
    const onCreateOption = vi.fn();
    const onChange = vi.fn();
    render(
      <SelectEditor
        value={null}
        options={options}
        onChange={onChange}
        onCreateOption={onCreateOption}
      />,
    );
    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.change(screen.getByTestId('select-search'), { target: { value: 'Purple' } });
    fireEvent.click(screen.getByTestId('select-create'));
    expect(onCreateOption).toHaveBeenCalledWith('Purple');
    expect(onChange).toHaveBeenCalledWith('Purple');
  });

  it('marks selected option', () => {
    render(<SelectEditor value="Blue" options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByTestId('select-option-Blue').className).toContain('is-selected');
  });

  it('custom placeholder', () => {
    render(<SelectEditor value={null} options={options} onChange={() => {}} placeholder="Pick one" />);
    expect(screen.getByTestId('select-placeholder').textContent).toBe('Pick one');
  });
});

describe('MultiSelectEditor', () => {
  it('renders the multiselect editor', () => {
    render(<MultiSelectEditor values={[]} options={options} onChange={() => {}} />);
    expect(screen.getByTestId('multiselect-editor')).toBeDefined();
  });

  it('shows placeholder when no values', () => {
    render(<MultiSelectEditor values={[]} options={options} onChange={() => {}} />);
    expect(screen.getByTestId('multiselect-placeholder').textContent).toBe('Select...');
  });

  it('shows selected values as tags', () => {
    render(<MultiSelectEditor values={['Red', 'Blue']} options={options} onChange={() => {}} />);
    expect(screen.getByTestId('multiselect-tag-Red')).toBeDefined();
    expect(screen.getByTestId('multiselect-tag-Blue')).toBeDefined();
  });

  it('opens dropdown on click', () => {
    render(<MultiSelectEditor values={[]} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    expect(screen.getByTestId('multiselect-dropdown')).toBeDefined();
  });

  it('adds value when unselected option clicked', () => {
    const onChange = vi.fn();
    render(<MultiSelectEditor values={['Red']} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    fireEvent.click(screen.getByTestId('multiselect-option-Blue'));
    expect(onChange).toHaveBeenCalledWith(['Red', 'Blue']);
  });

  it('removes value when selected option clicked', () => {
    const onChange = vi.fn();
    render(<MultiSelectEditor values={['Red', 'Blue']} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    fireEvent.click(screen.getByTestId('multiselect-option-Red'));
    expect(onChange).toHaveBeenCalledWith(['Blue']);
  });

  it('removes value via tag close button', () => {
    const onChange = vi.fn();
    render(<MultiSelectEditor values={['Red', 'Blue']} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('multiselect-remove-Red'));
    expect(onChange).toHaveBeenCalledWith(['Blue']);
  });

  it('shows checkmark on selected options', () => {
    render(<MultiSelectEditor values={['Green']} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    expect(screen.getByTestId('multiselect-option-Green').className).toContain('is-selected');
  });

  it('filters options by search', () => {
    render(<MultiSelectEditor values={[]} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    fireEvent.change(screen.getByTestId('multiselect-search'), { target: { value: 'red' } });
    expect(screen.getByTestId('multiselect-option-Red')).toBeDefined();
    expect(screen.queryByTestId('multiselect-option-Blue')).toBeNull();
  });

  it('shows create option for new values', () => {
    const onCreateOption = vi.fn();
    render(
      <MultiSelectEditor
        values={[]}
        options={options}
        onChange={() => {}}
        onCreateOption={onCreateOption}
      />,
    );
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    fireEvent.change(screen.getByTestId('multiselect-search'), { target: { value: 'Yellow' } });
    expect(screen.getByTestId('multiselect-create')).toBeDefined();
  });

  it('creates and adds new option', () => {
    const onCreateOption = vi.fn();
    const onChange = vi.fn();
    render(
      <MultiSelectEditor
        values={['Red']}
        options={options}
        onChange={onChange}
        onCreateOption={onCreateOption}
      />,
    );
    fireEvent.click(screen.getByTestId('multiselect-trigger'));
    fireEvent.change(screen.getByTestId('multiselect-search'), { target: { value: 'Yellow' } });
    fireEvent.click(screen.getByTestId('multiselect-create'));
    expect(onCreateOption).toHaveBeenCalledWith('Yellow');
    expect(onChange).toHaveBeenCalledWith(['Red', 'Yellow']);
  });
});

describe('DEFAULT_COLORS', () => {
  it('has 10 default colors', () => {
    expect(DEFAULT_COLORS).toHaveLength(10);
  });

  it('all colors are valid hex strings', () => {
    for (const color of DEFAULT_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
