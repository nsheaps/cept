import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu.js';
import type { SlashCommandItem } from './extensions/slash-command.js';

const mockItems: SlashCommandItem[] = [
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: 'H1',
    category: 'Text',
    command: vi.fn(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '\u2022',
    category: 'Lists',
    command: vi.fn(),
  },
  {
    title: 'Image',
    description: 'Upload an image',
    icon: '\uD83D\uDDBC',
    category: 'Media',
    command: vi.fn(),
  },
];

describe('SlashCommandMenu', () => {
  it('renders all items', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByText('Heading 1')).toBeDefined();
    expect(screen.getByText('Bullet List')).toBeDefined();
    expect(screen.getByText('Image')).toBeDefined();
  });

  it('renders category headers', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByText('Text')).toBeDefined();
    expect(screen.getByText('Lists')).toBeDefined();
    expect(screen.getByText('Media')).toBeDefined();
  });

  it('renders descriptions', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByText('Large heading')).toBeDefined();
    expect(screen.getByText('Unordered list')).toBeDefined();
  });

  it('renders icons', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByText('H1')).toBeDefined();
  });

  it('calls command on item click', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    fireEvent.click(screen.getByText('Heading 1'));
    expect(command).toHaveBeenCalledWith(mockItems[0]);
  });

  it('shows "No results" when items is empty', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={[]} command={command} />);

    expect(screen.getByText('No results')).toBeDefined();
  });

  it('leaves Enter to the editor when there is nothing to choose', () => {
    const ref = createRef<SlashCommandMenuRef>();
    const command = vi.fn();
    render(<SlashCommandMenu ref={ref} items={[]} command={command} />);
    expect(ref.current?.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'Enter' }) })).toBe(
      false,
    );
    expect(command).not.toHaveBeenCalled();
  });

  it('highlights first item by default', () => {
    const command = vi.fn();
    const { container } = render(<SlashCommandMenu items={mockItems} command={command} />);

    const selectedItem = container.querySelector('.cept-slash-menu-item.is-selected');
    expect(selectedItem).not.toBeNull();
    expect(selectedItem?.textContent).toContain('Heading 1');
  });

  it('has the correct test id', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByTestId('slash-command-menu')).toBeDefined();
  });

  describe('when a category is not contiguous in the items', () => {
    // Text, Lists, Text: the menu shows both Text items first, so rows 1 and 2 are
    // Heading 1 and Quote, and the Bullet List row is the third.
    const split: SlashCommandItem[] = [
      { ...mockItems[0]!, title: 'Heading 1' },
      { ...mockItems[1]!, title: 'Bullet List' },
      { ...mockItems[0]!, title: 'Quote', command: vi.fn() },
    ];

    it('inserts the clicked row, not the item at that position in the list', () => {
      const command = vi.fn();
      render(<SlashCommandMenu items={split} command={command} />);

      fireEvent.click(screen.getByText('Quote'));
      expect(command).toHaveBeenCalledWith(split[2]);
    });

    it('inserts the highlighted row on Enter after moving down', () => {
      const command = vi.fn();
      const ref = createRef<SlashCommandMenuRef>();
      const { container } = render(<SlashCommandMenu ref={ref} items={split} command={command} />);

      act(() => {
        ref.current?.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'ArrowDown' }) });
      });
      expect(container.querySelector('.is-selected')?.textContent).toContain('Quote');
      act(() => {
        ref.current?.onKeyDown({ event: new KeyboardEvent('keydown', { key: 'Enter' }) });
      });
      expect(command).toHaveBeenCalledWith(split[2]);
    });
  });
});
