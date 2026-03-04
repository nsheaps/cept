import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashCommandMenu } from './SlashCommandMenu.js';
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

  it('highlights first item by default', () => {
    const command = vi.fn();
    const { container } = render(
      <SlashCommandMenu items={mockItems} command={command} />,
    );

    const selectedItem = container.querySelector('.cept-slash-menu-item.is-selected');
    expect(selectedItem).not.toBeNull();
    expect(selectedItem?.textContent).toContain('Heading 1');
  });

  it('has the correct test id', () => {
    const command = vi.fn();
    render(<SlashCommandMenu items={mockItems} command={command} />);

    expect(screen.getByTestId('slash-command-menu')).toBeDefined();
  });
});
