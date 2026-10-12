import type { AnyExtension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import { Callout } from './extensions/callout.js';
import { Toggle } from './extensions/toggle.js';
import { ImageBlock } from './extensions/image.js';
import { Embed } from './extensions/embed.js';
import { Bookmark } from './extensions/bookmark.js';
import { Columns, Column } from './extensions/columns.js';
import { MathBlock, InlineMath } from './extensions/math.js';
import { Mermaid } from './extensions/mermaid.js';
import { MarkdownAttributes } from './extensions/markdown-attributes.js';
import { RawBlock, RawInline } from './extensions/raw-markdown.js';
import { FootnoteReference, FootnoteDefinition } from './extensions/footnote.js';

const lowlight = createLowlight(common);

/**
 * The extensions that make up the editor's document schema: every node and
 * mark a page can hold. The Markdown pipeline's documents must fit this
 * schema (see `document-extensions.test.ts`); interface-only extensions
 * (slash menu, drag handle, placeholder) are added by `CeptEditor`.
 */
export function documentExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      bulletList: { HTMLAttributes: { class: 'cept-bullet-list' } },
      orderedList: { HTMLAttributes: { class: 'cept-ordered-list' } },
      listItem: { HTMLAttributes: { class: 'cept-list-item' } },
      paragraph: { HTMLAttributes: { class: 'cept-paragraph' } },
      blockquote: { HTMLAttributes: { class: 'cept-blockquote' } },
      horizontalRule: { HTMLAttributes: { class: 'cept-divider' } },
      // Disable default code block in favor of lowlight version
      codeBlock: false,
      // Disable defaults to use standalone configured versions
      link: false,
      underline: false,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      HTMLAttributes: { class: 'cept-code-block' },
    }),
    TaskList.configure({ HTMLAttributes: { class: 'cept-task-list' } }),
    TaskItem.configure({ nested: true, HTMLAttributes: { class: 'cept-task-item' } }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: false,
      HTMLAttributes: { class: 'cept-link' },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Callout,
    Toggle,
    ImageBlock,
    Embed,
    Bookmark,
    Columns,
    Column,
    MathBlock,
    InlineMath,
    Table.configure({ resizable: true, HTMLAttributes: { class: 'cept-table' } }),
    TableRow.configure({ HTMLAttributes: { class: 'cept-table-row' } }),
    TableCell.configure({ HTMLAttributes: { class: 'cept-table-cell' } }),
    TableHeader.configure({ HTMLAttributes: { class: 'cept-table-header-cell' } }),
    Mermaid,
    RawBlock,
    RawInline,
    FootnoteReference,
    FootnoteDefinition,
    MarkdownAttributes,
  ];
}
