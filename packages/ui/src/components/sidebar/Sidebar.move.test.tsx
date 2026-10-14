import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, createEvent, within } from '@testing-library/react';
import { Sidebar } from './Sidebar.js';
import type { PageTreeNode } from './PageTreeItem.js';

const pages: PageTreeNode[] = [
  { id: 'a.md', title: 'A', children: [] },
  { id: 'b.md', title: 'B', children: [] },
  {
    id: 'docs',
    title: 'Docs',
    isExpanded: true,
    children: [
      { id: 'docs/x.md', title: 'X', children: [] },
      { id: 'docs/logo.png', title: 'logo.png', foreign: true, children: [] },
    ],
  },
];

const transfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' });
const button = (id: string) => screen.getByTestId(`page-tree-button-${id}`);

// jsdom lays nothing out (every row is 0 high at y = 0): clientY < 0.25 is the top
// quarter, 0.25..0.75 the middle, above that the bottom quarter.
const dragAt = (type: 'dragOver' | 'drop', el: HTMLElement, dataTransfer: object, y: number) => {
  const event = createEvent[type](el, { dataTransfer });
  Object.defineProperty(event, 'clientY', { value: y });
  fireEvent(el, event);
};
const drag = (id: string, onto: string, clientY: number) => {
  const dataTransfer = transfer();
  fireEvent.dragStart(button(id), { dataTransfer });
  dragAt('dragOver', button(onto), dataTransfer, clientY);
  dragAt('drop', button(onto), dataTransfer, clientY);
};

describe('Sidebar moving pages into other pages (REQ-NTN-012)', () => {
  it('nests a page dropped on the middle of another row', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    drag('a.md', 'docs', 0.5);
    expect(onPageMove).toHaveBeenCalledWith('a.md', 'docs');
  });

  it('nests a page dropped on a row under a different parent, wherever on the row', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} onPageReorder={vi.fn()} />);
    drag('a.md', 'docs/x.md', 1);
    expect(onPageMove).toHaveBeenCalledWith('a.md', 'docs/x.md');
  });

  it('still reorders on the top and bottom of a sibling row', () => {
    const onPageMove = vi.fn();
    const onPageReorder = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} onPageReorder={onPageReorder} />);
    drag('a.md', 'b.md', 1);
    expect(onPageReorder).toHaveBeenCalledWith('a.md', 1);
    expect(onPageMove).not.toHaveBeenCalled();
  });

  it('shows the target row while dragging over its middle', () => {
    render(<Sidebar pages={pages} onPageMove={vi.fn()} onPageReorder={vi.fn()} />);
    const dataTransfer = transfer();
    fireEvent.dragStart(button('a.md'), { dataTransfer });
    dragAt('dragOver', button('b.md'), dataTransfer, 0.5);
    expect(button('b.md').getAttribute('data-drop')).toBe('into');
  });

  it('does not nest a page into itself, its own subtree or a file', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    drag('docs', 'docs', 0.5);
    drag('docs', 'docs/x.md', 0.5);
    drag('a.md', 'docs/logo.png', 0.5);
    expect(onPageMove).not.toHaveBeenCalled();
  });

  it('lets a file be dragged into a page', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    drag('docs/logo.png', 'a.md', 0.5);
    expect(onPageMove).toHaveBeenCalledWith('docs/logo.png', 'a.md');
  });

  it('does nothing when moving is not offered', () => {
    render(<Sidebar pages={pages} />);
    expect(button('a.md').getAttribute('draggable')).toBe('false');
  });
});

describe('Sidebar “Move to…” picker', () => {
  function open(id: string) {
    fireEvent.contextMenu(button(id));
    fireEvent.click(screen.getByTestId('ctx-move-to'));
  }

  it('lists the pages the page can move into and moves it', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    open('a.md');
    const dialog = screen.getByTestId('move-page-dialog');
    expect(within(dialog).queryByTestId('move-target-root')).toBeNull();
    expect(within(dialog).getByTestId('move-target-b.md')).toBeDefined();
    expect(within(dialog).getByTestId('move-target-docs/x.md')).toBeDefined();
    expect(within(dialog).queryByTestId('move-target-docs/logo.png')).toBeNull();
    expect(within(dialog).queryByTestId('move-target-a.md')).toBeNull();
    fireEvent.click(within(dialog).getByTestId('move-target-docs'));
    expect(onPageMove).toHaveBeenCalledWith('a.md', 'docs');
    expect(screen.queryByTestId('move-page-dialog')).toBeNull();
  });

  it('offers the space root for a nested page, but not its own subtree', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    open('docs/x.md');
    expect(screen.queryByTestId('move-target-docs')).toBeNull();
    fireEvent.click(screen.getByTestId('move-target-root'));
    expect(onPageMove).toHaveBeenCalledWith('docs/x.md', '');
  });

  it('filters by title and can be cancelled', () => {
    const onPageMove = vi.fn();
    render(<Sidebar pages={pages} onPageMove={onPageMove} />);
    open('a.md');
    fireEvent.change(screen.getByTestId('move-page-filter'), { target: { value: 'x' } });
    expect(screen.queryByTestId('move-target-b.md')).toBeNull();
    expect(screen.getByTestId('move-target-docs/x.md')).toBeDefined();
    fireEvent.change(screen.getByTestId('move-page-filter'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('move-page-empty')).toBeDefined();
    fireEvent.click(screen.getByTestId('move-page-cancel'));
    expect(screen.queryByTestId('move-page-dialog')).toBeNull();
    expect(onPageMove).not.toHaveBeenCalled();
  });
});
