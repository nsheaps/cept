import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar.js';
import type { PageTreeNode } from './PageTreeItem.js';

const pages: PageTreeNode[] = [
  { id: 'a.md', title: 'A', children: [] },
  { id: 'b.md', title: 'B', children: [] },
  { id: 'c.md', title: 'C', children: [] },
  {
    id: 'docs',
    title: 'Docs',
    isExpanded: true,
    children: [
      { id: 'docs/x.md', title: 'X', children: [] },
      { id: 'docs/y.md', title: 'Y', children: [] },
    ],
  },
];

const transfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });
const button = (id: string) => screen.getByTestId(`page-tree-button-${id}`);

// jsdom's drag events carry no coordinates, so set clientY on the event itself.
const dragAt = (type: 'dragOver' | 'drop', el: HTMLElement, dataTransfer: object, y: number) => {
  const event = createEvent[type](el, { dataTransfer });
  Object.defineProperty(event, 'clientY', { value: y });
  fireEvent(el, event);
};

// jsdom lays nothing out, so every row is 0 high at y = 0: clientY < 0 is the
// upper half ("before"), clientY >= 0 the lower half ("after").
const drag = (id: string, onto: string, clientY: number) => {
  const dataTransfer = transfer();
  fireEvent.dragStart(button(id), { dataTransfer });
  dragAt('dragOver', button(onto), dataTransfer, clientY);
  dragAt('drop', button(onto), dataTransfer, clientY);
};

describe('Sidebar page reordering (REQ-NTN-012)', () => {
  it('drops a page before another: index among the siblings without the moved page', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    drag('c.md', 'a.md', -1);
    expect(onPageReorder).toHaveBeenCalledWith('c.md', 0);
  });

  it('drops a page after another', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    drag('a.md', 'b.md', 1);
    expect(onPageReorder).toHaveBeenCalledWith('a.md', 1);
  });

  it('reorders inside a folder', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    drag('docs/y.md', 'docs/x.md', -1);
    expect(onPageReorder).toHaveBeenCalledWith('docs/y.md', 0);
  });

  it('ignores a drop onto a page under a different parent', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    drag('a.md', 'docs/x.md', 1);
    expect(onPageReorder).not.toHaveBeenCalled();
  });

  it('shows where the page would land while dragging over a row', () => {
    render(<Sidebar pages={pages} onPageReorder={vi.fn()} />);
    const dataTransfer = transfer();
    fireEvent.dragStart(button('a.md'), { dataTransfer });
    dragAt('dragOver', button('b.md'), dataTransfer, -1);
    expect(button('b.md').getAttribute('data-drop')).toBe('before');
    dragAt('dragOver', button('b.md'), dataTransfer, 1);
    expect(button('b.md').getAttribute('data-drop')).toBe('after');
    fireEvent.dragLeave(button('b.md'));
    expect(button('b.md').hasAttribute('data-drop')).toBe(false);
  });

  it('moves a page with Alt+ArrowUp / Alt+ArrowDown, and stops at the ends', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    fireEvent.keyDown(button('b.md'), { key: 'ArrowUp', altKey: true });
    expect(onPageReorder).toHaveBeenLastCalledWith('b.md', 0);
    fireEvent.keyDown(button('b.md'), { key: 'ArrowDown', altKey: true });
    expect(onPageReorder).toHaveBeenLastCalledWith('b.md', 2);
    onPageReorder.mockClear();
    fireEvent.keyDown(button('a.md'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(button('docs/y.md'), { key: 'ArrowDown', altKey: true });
    expect(onPageReorder).not.toHaveBeenCalled();
  });

  it('does not use plain arrow keys', () => {
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageReorder={onPageReorder} />);
    fireEvent.keyDown(button('b.md'), { key: 'ArrowUp' });
    expect(onPageReorder).not.toHaveBeenCalled();
  });

  it('is not draggable when read-only or without a reorder handler', () => {
    const { unmount } = render(<Sidebar pages={pages} readOnly onPageReorder={vi.fn()} />);
    expect(button('a.md').getAttribute('draggable')).toBe('false');
    unmount();
    render(<Sidebar pages={pages} />);
    expect(button('a.md').getAttribute('draggable')).toBe('false');
  });
});
