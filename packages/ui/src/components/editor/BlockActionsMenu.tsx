import { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

export interface BlockAction {
  id: string;
  label: string;
  icon: string;
  action: (editor: Editor, pos: number) => void;
}

export interface BlockActionsMenuProps {
  editor: Editor | null;
  actions: BlockAction[];
}

export interface BlockActionsMenuRef {
  show: (pos: number, rect: DOMRect) => void;
  hide: () => void;
  isVisible: () => boolean;
}

export function getDefaultBlockActions(): BlockAction[] {
  return [
    {
      id: 'delete',
      label: 'Delete',
      icon: '\u{1F5D1}',
      action: (editor, pos) => {
        const resolvedPos = editor.state.doc.resolve(pos);
        const node = resolvedPos.nodeAfter ?? resolvedPos.parent;
        if (node) {
          const from = pos;
          const to = pos + node.nodeSize;
          editor.chain().focus().deleteRange({ from, to }).run();
        }
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: '\u{29C9}',
      action: (editor, pos) => {
        const resolvedPos = editor.state.doc.resolve(pos);
        const node = resolvedPos.nodeAfter;
        if (node) {
          const endPos = pos + node.nodeSize;
          editor
            .chain()
            .focus()
            .insertContentAt(endPos, node.toJSON())
            .run();
        }
      },
    },
    {
      id: 'turn-into-paragraph',
      label: 'Text',
      icon: 'T',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .setParagraph()
          .run();
      },
    },
    {
      id: 'turn-into-h1',
      label: 'Heading 1',
      icon: 'H1',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .setHeading({ level: 1 })
          .run();
      },
    },
    {
      id: 'turn-into-h2',
      label: 'Heading 2',
      icon: 'H2',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .setHeading({ level: 2 })
          .run();
      },
    },
    {
      id: 'turn-into-h3',
      label: 'Heading 3',
      icon: 'H3',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .setHeading({ level: 3 })
          .run();
      },
    },
    {
      id: 'turn-into-bullet-list',
      label: 'Bullet List',
      icon: '\u2022',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .toggleBulletList()
          .run();
      },
    },
    {
      id: 'turn-into-ordered-list',
      label: 'Numbered List',
      icon: '1.',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .toggleOrderedList()
          .run();
      },
    },
    {
      id: 'turn-into-blockquote',
      label: 'Quote',
      icon: '\u201C',
      action: (editor, pos) => {
        editor
          .chain()
          .focus()
          .setNodeSelection(pos)
          .toggleBlockquote()
          .run();
      },
    },
  ];
}

export const BlockActionsMenu = forwardRef<
  BlockActionsMenuRef,
  BlockActionsMenuProps
>(({ editor, actions }, ref) => {
  const [visible, setVisible] = useState(false);
  const [currentPos, setCurrentPos] = useState(0);
  const [section, setSection] = useState<'main' | 'turn-into'>('main');

  const hide = useCallback(() => {
    setVisible(false);
    setSection('main');
  }, []);

  const show = useCallback((pos: number) => {
    setCurrentPos(pos);
    setVisible(true);
    setSection('main');
  }, []);

  useImperativeHandle(ref, () => ({
    show: (pos: number) => show(pos),
    hide,
    isVisible: () => visible,
  }));

  if (!visible || !editor) {
    return null;
  }

  const mainActions = actions.filter(
    (a) =>
      a.id === 'delete' || a.id === 'duplicate',
  );

  const turnIntoActions = actions.filter(
    (a) =>
      a.id !== 'delete' && a.id !== 'duplicate',
  );

  const handleAction = (action: BlockAction) => {
    action.action(editor, currentPos);
    hide();
  };

  return (
    <div className="cept-block-actions" data-testid="block-actions-menu">
      {section === 'main' && (
        <>
          {mainActions.map((action) => (
            <button
              key={action.id}
              className="cept-block-action-item"
              onClick={() => handleAction(action)}
              data-testid={`block-action-${action.id}`}
            >
              <span className="cept-block-action-icon">{action.icon}</span>
              <span className="cept-block-action-label">{action.label}</span>
            </button>
          ))}
          {turnIntoActions.length > 0 && (
            <button
              className="cept-block-action-item"
              onClick={() => setSection('turn-into')}
              data-testid="block-action-turn-into"
            >
              <span className="cept-block-action-icon">{'\u21C4'}</span>
              <span className="cept-block-action-label">Turn into</span>
              <span className="cept-block-action-arrow">{'\u203A'}</span>
            </button>
          )}
        </>
      )}
      {section === 'turn-into' && (
        <>
          <button
            className="cept-block-action-item cept-block-action-back"
            onClick={() => setSection('main')}
            data-testid="block-action-back"
          >
            <span className="cept-block-action-icon">{'\u2039'}</span>
            <span className="cept-block-action-label">Back</span>
          </button>
          <div className="cept-block-action-divider" />
          {turnIntoActions.map((action) => (
            <button
              key={action.id}
              className="cept-block-action-item"
              onClick={() => handleAction(action)}
              data-testid={`block-action-${action.id}`}
            >
              <span className="cept-block-action-icon">{action.icon}</span>
              <span className="cept-block-action-label">{action.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
});

BlockActionsMenu.displayName = 'BlockActionsMenu';
