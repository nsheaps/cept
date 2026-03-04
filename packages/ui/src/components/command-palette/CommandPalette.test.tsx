import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette, filterCommands } from './CommandPalette.js';
import type { CommandItem } from './CommandPalette.js';

const mockItems: CommandItem[] = [
  { id: 'new-page', title: 'New Page', icon: '\u{1F4C4}', category: 'Pages', action: vi.fn() },
  { id: 'search', title: 'Search', icon: '\u{1F50D}', category: 'Navigation', action: vi.fn() },
  { id: 'settings', title: 'Settings', icon: '\u2699', category: 'Navigation', action: vi.fn() },
  { id: 'bold', title: 'Bold', icon: 'B', category: 'Formatting', action: vi.fn() },
  { id: 'italic', title: 'Italic', icon: 'I', category: 'Formatting', action: vi.fn() },
];

describe('CommandPalette', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <CommandPalette isOpen={false} items={mockItems} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);
    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('renders search input', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);
    expect(screen.getByTestId('command-input')).toBeDefined();
  });

  it('renders all items', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);
    expect(screen.getByTestId('command-item-new-page')).toBeDefined();
    expect(screen.getByTestId('command-item-search')).toBeDefined();
    expect(screen.getByTestId('command-item-settings')).toBeDefined();
    expect(screen.getByTestId('command-item-bold')).toBeDefined();
    expect(screen.getByTestId('command-item-italic')).toBeDefined();
  });

  it('filters items by query', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('command-input'), { target: { value: 'bold' } });

    expect(screen.getByTestId('command-item-bold')).toBeDefined();
    expect(screen.queryByTestId('command-item-search')).toBeNull();
  });

  it('shows no results message', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);

    fireEvent.change(screen.getByTestId('command-input'), { target: { value: 'zzzzz' } });
    expect(screen.getByTestId('command-empty')).toBeDefined();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} items={mockItems} onClose={onClose} />);

    fireEvent.keyDown(screen.getByTestId('command-input'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on overlay click', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} items={mockItems} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('command-palette-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('executes command on Enter', () => {
    const action = vi.fn();
    const items: CommandItem[] = [
      { id: 'test', title: 'Test', category: 'Test', action },
    ];
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} items={items} onClose={onClose} />);

    fireEvent.keyDown(screen.getByTestId('command-input'), { key: 'Enter' });
    expect(action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('executes command on click', () => {
    const action = vi.fn();
    const items: CommandItem[] = [
      { id: 'test', title: 'Test', category: 'Test', action },
    ];
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} items={items} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('command-item-test'));
    expect(action).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates with arrow keys', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);
    const input = screen.getByTestId('command-input');

    // First item selected by default
    expect(screen.getByTestId('command-item-new-page').className).toContain('is-selected');

    // Arrow down
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('command-item-search').className).toContain('is-selected');

    // Arrow up
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByTestId('command-item-new-page').className).toContain('is-selected');
  });

  it('renders category headers', () => {
    render(<CommandPalette isOpen={true} items={mockItems} onClose={vi.fn()} />);
    expect(screen.getByText('Pages')).toBeDefined();
    expect(screen.getByText('Navigation')).toBeDefined();
    expect(screen.getByText('Formatting')).toBeDefined();
  });
});

describe('filterCommands', () => {
  it('returns all items when query is empty', () => {
    expect(filterCommands(mockItems, '')).toHaveLength(5);
  });

  it('filters by title', () => {
    const result = filterCommands(mockItems, 'bold');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('bold');
  });

  it('filters by category', () => {
    const result = filterCommands(mockItems, 'formatting');
    expect(result).toHaveLength(2);
  });

  it('is case-insensitive', () => {
    const result = filterCommands(mockItems, 'SEARCH');
    expect(result).toHaveLength(1);
  });
});
