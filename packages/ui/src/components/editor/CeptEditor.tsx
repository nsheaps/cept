import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import {
  SlashCommand,
  defaultSlashCommands,
  filterSlashCommands,
} from './extensions/slash-command.js';
import type { SlashCommandItem } from './extensions/slash-command.js';
import { documentExtensions } from './document-extensions.js';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu.js';
import { InlineToolbar } from './InlineToolbar.js';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

export interface CeptEditorProps {
  content?: string;
  editable?: boolean;
  placeholder?: string;
  onUpdate?: (markdown: string) => void;
}

export function CeptEditor({
  content = '',
  editable = true,
  placeholder = "Type '/' for commands...",
  onUpdate,
}: CeptEditorProps) {
  const editor = useEditor({
    extensions: [
      ...documentExtensions(),
      GlobalDragHandle.configure({
        dragHandleWidth: 24,
        scrollTreshold: 100,
        customNodes: [
          'callout',
          'toggle',
          'imageBlock',
          'embed',
          'bookmark',
          'columns',
          'mathBlock',
          'mermaid',
          'rawBlock',
          'footnoteDefinition',
        ],
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => filterSlashCommands(defaultSlashCommands, query),
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
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      onUpdate?.((ed.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: 'cept-editor-content',
        spellcheck: 'false',
        // Prevent browser writing suggestions that cause spurious underlines
        writingsuggestions: 'false',
        autocorrect: 'off',
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
