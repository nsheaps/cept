import { useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import type { MarkdownDocument, PmNode } from '@cept/core';
import Placeholder from '@tiptap/extension-placeholder';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import {
  SlashCommand,
  defaultSlashCommands,
  filterSlashCommands,
} from './extensions/slash-command.js';
import type { SlashCommandItem } from './extensions/slash-command.js';
import { documentExtensions } from './document-extensions.js';
import {
  editorBaseline,
  loadMarkdown,
  markdownToSlice,
  plainTextToSlice,
  saveMarkdown,
  sliceToMarkdown,
} from './markdown-bridge.js';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu.js';
import { InlineToolbar } from './InlineToolbar.js';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

export interface CeptEditorProps {
  /** The page's Markdown. Read once: remount the editor (with a `key`) to load other content. */
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
  // The page is parsed once per mount; saves reuse the source of every block
  // that is unchanged since load (EDT-005).
  const [loaded] = useState(() => loadMarkdown(content));
  const baseline = useRef<MarkdownDocument | null>(null);
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
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: loaded.doc,
    editable,
    onCreate: ({ editor: ed }) => {
      baseline.current = editorBaseline(loaded.parsed, ed.getJSON() as PmNode);
    },
    onUpdate: ({ editor: ed }) => {
      if (!onUpdate || !baseline.current) return;
      onUpdate(saveMarkdown(ed.getJSON() as PmNode, baseline.current));
    },
    editorProps: {
      // Plain text is pasted and copied as Markdown, through the same pipeline.
      clipboardTextParser: (text, _context, plain, view) =>
        plain
          ? plainTextToSlice(text, view.state.schema)
          : markdownToSlice(text, view.state.schema),
      clipboardTextSerializer: (slice) => sliceToMarkdown(slice),
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
