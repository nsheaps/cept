import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Callout } from './extensions/callout.js';
import { Toggle } from './extensions/toggle.js';

const lowlight = createLowlight(common);

export interface CeptEditorProps {
  content?: string;
  editable?: boolean;
  placeholder?: string;
  onUpdate?: (html: string) => void;
}

export function CeptEditor({
  content = '',
  editable = true,
  placeholder = "Type '/' for commands...",
  onUpdate,
}: CeptEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: {
            class: 'cept-bullet-list',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'cept-ordered-list',
          },
        },
        listItem: {
          HTMLAttributes: {
            class: 'cept-list-item',
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: 'cept-paragraph',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'cept-blockquote',
          },
        },
        horizontalRule: {
          HTMLAttributes: {
            class: 'cept-divider',
          },
        },
        // Disable default code block in favor of lowlight version
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'cept-code-block',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'cept-task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'cept-task-item',
        },
      }),
      Callout,
      Toggle,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'cept-editor-content',
      },
    },
  });

  return (
    <div className="cept-editor" data-testid="cept-editor">
      <EditorContent editor={editor} />
    </div>
  );
}
