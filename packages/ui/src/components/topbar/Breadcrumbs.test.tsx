import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumbs } from './Breadcrumbs.js';

const items = [
  { id: 'root', title: 'Root', icon: '\u{1F4C1}' },
  { id: 'child', title: 'Child Page' },
  { id: 'grandchild', title: 'Grandchild' },
];

describe('Breadcrumbs', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders breadcrumb nav', () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByTestId('breadcrumbs')).toBeDefined();
  });

  it('renders all items', () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByText('Root')).toBeDefined();
    expect(screen.getByText('Child Page')).toBeDefined();
    expect(screen.getByText('Grandchild')).toBeDefined();
  });

  it('renders separators between items', () => {
    render(<Breadcrumbs items={items} />);
    const separators = screen.getAllByText('/');
    expect(separators).toHaveLength(2);
  });

  it('renders last item as current (not a link)', () => {
    render(<Breadcrumbs items={items} />);
    const last = screen.getByTestId('breadcrumb-grandchild');
    expect(last.tagName).toBe('SPAN');
    expect(last.getAttribute('aria-current')).toBe('page');
  });

  it('renders non-last items as buttons', () => {
    render(<Breadcrumbs items={items} />);
    const root = screen.getByTestId('breadcrumb-root');
    expect(root.tagName).toBe('BUTTON');
  });

  it('calls onNavigate when a breadcrumb link is clicked', () => {
    const onNavigate = vi.fn();
    render(<Breadcrumbs items={items} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('breadcrumb-root'));
    expect(onNavigate).toHaveBeenCalledWith('root');
  });

  it('renders icons when provided', () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByText('\u{1F4C1}')).toBeDefined();
  });

  it('renders single item without separator', () => {
    render(<Breadcrumbs items={[{ id: 'only', title: 'Only Page' }]} />);
    expect(screen.getByText('Only Page')).toBeDefined();
    expect(screen.queryByText('/')).toBeNull();
  });

  it('shows Untitled for pages with empty title', () => {
    render(<Breadcrumbs items={[{ id: 'x', title: '' }]} />);
    expect(screen.getByText('Untitled')).toBeDefined();
  });
});
