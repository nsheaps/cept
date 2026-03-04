import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRef, useEffect } from 'react';
import {
  BlockActionsMenu,
  getDefaultBlockActions,
  type BlockActionsMenuRef,
  type BlockAction,
} from './BlockActionsMenu.js';

const mockEditor = {
  chain: vi.fn().mockReturnThis(),
  focus: vi.fn().mockReturnThis(),
  deleteRange: vi.fn().mockReturnThis(),
  insertContentAt: vi.fn().mockReturnThis(),
  setNodeSelection: vi.fn().mockReturnThis(),
  setParagraph: vi.fn().mockReturnThis(),
  setHeading: vi.fn().mockReturnThis(),
  toggleBulletList: vi.fn().mockReturnThis(),
  toggleOrderedList: vi.fn().mockReturnThis(),
  toggleBlockquote: vi.fn().mockReturnThis(),
  run: vi.fn(),
  state: {
    doc: {
      resolve: vi.fn().mockReturnValue({
        nodeAfter: {
          nodeSize: 10,
          toJSON: vi.fn().mockReturnValue({ type: 'paragraph', content: [] }),
        },
        parent: null,
      }),
    },
  },
};

function TestWrapper({
  actions,
  autoShow,
  pos,
}: {
  actions: BlockAction[];
  autoShow?: boolean;
  pos?: number;
}) {
  const ref = useRef<BlockActionsMenuRef>(null);

  useEffect(() => {
    if (autoShow && ref.current) {
      ref.current.show(pos ?? 0, new DOMRect(0, 0, 100, 20));
    }
  }, [autoShow, pos]);

  return (
    <BlockActionsMenu
      ref={ref}
      editor={mockEditor as never}
      actions={actions}
    />
  );
}

describe('BlockActionsMenu', () => {
  it('is hidden by default', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} />,
    );

    expect(screen.queryByTestId('block-actions-menu')).toBeNull();
  });

  it('shows menu when show() is called', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} autoShow />,
    );

    expect(screen.getByTestId('block-actions-menu')).toBeDefined();
  });

  it('shows main actions (Delete, Duplicate, Turn into)', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} autoShow />,
    );

    expect(screen.getByText('Delete')).toBeDefined();
    expect(screen.getByText('Duplicate')).toBeDefined();
    expect(screen.getByText('Turn into')).toBeDefined();
  });

  it('navigates to turn-into submenu', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} autoShow />,
    );

    fireEvent.click(screen.getByTestId('block-action-turn-into'));

    // Should show turn-into options
    expect(screen.getByText('Text')).toBeDefined();
    expect(screen.getByText('Heading 1')).toBeDefined();
    expect(screen.getByText('Heading 2')).toBeDefined();
    expect(screen.getByText('Back')).toBeDefined();
  });

  it('navigates back from turn-into submenu', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} autoShow />,
    );

    fireEvent.click(screen.getByTestId('block-action-turn-into'));
    expect(screen.getByText('Back')).toBeDefined();

    fireEvent.click(screen.getByTestId('block-action-back'));
    expect(screen.getByText('Delete')).toBeDefined();
    expect(screen.getByText('Turn into')).toBeDefined();
  });

  it('calls delete action', () => {
    const deleteAction: BlockAction = {
      id: 'delete',
      label: 'Delete',
      icon: '\u{1F5D1}',
      action: vi.fn(),
    };

    render(
      <TestWrapper actions={[deleteAction]} autoShow pos={5} />,
    );

    fireEvent.click(screen.getByTestId('block-action-delete'));
    expect(deleteAction.action).toHaveBeenCalledWith(mockEditor, 5);
  });

  it('hides after action is executed', () => {
    const deleteAction: BlockAction = {
      id: 'delete',
      label: 'Delete',
      icon: '\u{1F5D1}',
      action: vi.fn(),
    };

    render(
      <TestWrapper actions={[deleteAction]} autoShow />,
    );

    fireEvent.click(screen.getByTestId('block-action-delete'));
    expect(screen.queryByTestId('block-actions-menu')).toBeNull();
  });

  it('getDefaultBlockActions returns expected actions', () => {
    const actions = getDefaultBlockActions();
    const ids = actions.map((a) => a.id);

    expect(ids).toContain('delete');
    expect(ids).toContain('duplicate');
    expect(ids).toContain('turn-into-paragraph');
    expect(ids).toContain('turn-into-h1');
    expect(ids).toContain('turn-into-h2');
    expect(ids).toContain('turn-into-h3');
    expect(ids).toContain('turn-into-bullet-list');
    expect(ids).toContain('turn-into-ordered-list');
    expect(ids).toContain('turn-into-blockquote');
  });

  it('renders with correct test ids', () => {
    const actions = getDefaultBlockActions();
    render(
      <TestWrapper actions={actions} autoShow />,
    );

    expect(screen.getByTestId('block-action-delete')).toBeDefined();
    expect(screen.getByTestId('block-action-duplicate')).toBeDefined();
    expect(screen.getByTestId('block-action-turn-into')).toBeDefined();
  });
});
