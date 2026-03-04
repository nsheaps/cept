import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { common, createLowlight } from 'lowlight';
import { Callout } from './extensions/callout.js';
import { Toggle } from './extensions/toggle.js';
import { ImageBlock } from './extensions/image.js';
import { Embed } from './extensions/embed.js';
import { Bookmark } from './extensions/bookmark.js';
import { Columns, Column } from './extensions/columns.js';
import { MathBlock, InlineMath } from './extensions/math.js';
import { Mermaid } from './extensions/mermaid.js';
import { SlashCommand, defaultSlashCommands, filterSlashCommands } from './extensions/slash-command.js';
import type { SlashCommandItem } from './extensions/slash-command.js';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu.js';
import { InlineToolbar } from './InlineToolbar.js';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

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
        // Disable defaults to use standalone configured versions
        link: false,
        underline: false,
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
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'cept-link',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Callout,
      Toggle,
      ImageBlock,
      Embed,
      Bookmark,
      Columns,
      Column,
      MathBlock,
      InlineMath,
      Mermaid,
      GlobalDragHandle.configure({
        dragHandleWidth: 24,
        scrollTreshold: 100,
        customNodes: ['callout', 'toggle', 'imageBlock', 'embed', 'bookmark', 'columns', 'mathBlock', 'mermaid'],
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) =>
            filterSlashCommands(defaultSlashCommands, query),
          render: () => {
            let component: ReactRenderer<SlashCommandMenuRef> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: SuggestionProps<SlashCommandItem>) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props: { items: props.items, command: props.command },
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
                component?.updateProps({ items: props.items, command: props.command });
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect as () => DOMRect,
                  });
                }
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
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
      {editable && <InlineToolbar editor={editor} />}
    </div>
  );
}
