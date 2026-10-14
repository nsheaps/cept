import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import type { CommentAuthor, MarkdownDocument, PmNode } from '@cept/core';
import Placeholder from '@tiptap/extension-placeholder';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import {
  SlashCommand,
  defaultSlashCommands,
  filterSlashCommands,
} from './extensions/slash-command.js';
import type { SlashCommandItem } from './extensions/slash-command.js';
import { Mention } from './extensions/mention.js';
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
import { CommentComposer } from './CommentComposer.js';
import { usePageLinks, scrollToHeading, type PageLinksContext } from './page-links.js';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

/** Who comments are written as. Without it the editor offers no commenting. */
export interface CommentingContext {
  /** The signed-in or saved author; null asks for a display name when the first comment is written. */
  author: CommentAuthor | null;
  /** Remembers a display name entered in the composer and returns the author it makes. */
  chooseName: (name: string) => CommentAuthor;
}

interface ComposerState {
  quote: string;
  /** The selection the comment is about; null for a comment on the whole page. */
  range: { from: number; to: number } | null;
  position: { top: number; left: number };
}

export interface CeptEditorProps {
  /** The page's Markdown. Read once: remount the editor (with a `key`) to load other content. */
  content?: string;
  editable?: boolean;
  placeholder?: string;
  onUpdate?: (markdown: string) => void;
  /** Resolves the page's relative links and images against its space (REQ-EDT-027). */
  links?: PageLinksContext;
  /** A heading to scroll to when the page opens, by GitHub slug. */
  anchor?: string;
  /** Turns on commenting (REQ-NTN-002): the toolbar button, Ctrl/Cmd+Alt+M and "Comment on page". */
  commenting?: CommentingContext;
}

/** The popup that lists a suggestion's items under the caret, shared by `/` and `@`. */
function renderSuggestionMenu() {
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
}

export function CeptEditor({
  content = '',
  editable = true,
  placeholder = "Type '/' for commands...",
  onUpdate,
  links,
  anchor,
  commenting,
}: CeptEditorProps) {
  // The page is parsed once per mount; saves reuse the source of every block
  // that is unchanged since load (EDT-005).
  const [loaded] = useState(() => loadMarkdown(content));
  const baseline = useRef<MarkdownDocument | null>(null);
  // The extensions are built once, so the mention menu reads the space through a ref.
  const latestLinks = useRef(links);
  latestLinks.current = links;
  // The shortcut is registered once, so it reaches the composer through a ref too.
  const openComposerRef = useRef<(() => void) | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
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
          'graph',
          'rawBlock',
          'footnoteDefinition',
        ],
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => filterSlashCommands(defaultSlashCommands, query),
          render: renderSuggestionMenu,
        },
      }),
      Mention.configure({
        source: () => {
          const current = latestLinks.current;
          return current?.pages ? { pageId: current.pageId, pages: current.pages } : undefined;
        },
        suggestion: { render: renderSuggestionMenu },
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
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === 'KeyM') {
          if (!openComposerRef.current) return false;
          event.preventDefault();
          openComposerRef.current();
          return true;
        }
        return false;
      },
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

  const commentable = editable && commenting !== undefined;
  const openComposer = (pageLevel: boolean) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const onSelection = !pageLevel && !empty;
    let position = { top: 96, left: 96 };
    try {
      const at = editor.view.coordsAtPos(onSelection ? to : from);
      position = {
        top: at.bottom + 8,
        left: Math.max(8, Math.min(at.left, window.innerWidth - 336)),
      };
    } catch {
      // No layout (tests): the default position will do.
    }
    setComposer({
      quote: onSelection ? editor.state.doc.textBetween(from, to, '\n') : '',
      range: onSelection ? { from, to } : null,
      position,
    });
  };
  openComposerRef.current = commentable ? () => openComposer(false) : null;

  const submitComment = ({ body, name }: { body: string; name: string }) => {
    if (!editor || !commenting || !composer) return;
    const author = commenting.author ?? commenting.chooseName(name);
    if (composer.range) editor.commands.setTextSelection(composer.range);
    else editor.commands.setTextSelection(1);
    editor.commands.addComment({ author, body });
    setComposer(null);
    editor.commands.focus();
  };

  const containerRef = useRef<HTMLDivElement>(null);
  usePageLinks(containerRef, links, editable);
  useEffect(() => {
    if (editor && anchor && containerRef.current) scrollToHeading(containerRef.current, anchor);
  }, [editor, anchor]);

  return (
    <div className="cept-editor" data-testid="cept-editor" ref={containerRef}>
      <EditorContent editor={editor} />
      {editable && (
        <InlineToolbar
          editor={editor}
          {...(commentable ? { onComment: () => openComposer(false) } : {})}
        />
      )}
      {commentable && (
        <button
          type="button"
          className="cept-comment-page-button"
          onClick={() => openComposer(true)}
          data-testid="comment-on-page"
        >
          {'\u{1F4AC}'} Comment on page
        </button>
      )}
      {composer && commenting && (
        <CommentComposer
          quote={composer.quote}
          askName={commenting.author === null}
          position={composer.position}
          onSubmit={submitComment}
          onCancel={() => setComposer(null)}
        />
      )}
    </div>
  );
}
