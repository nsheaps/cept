import { Extension, type Editor } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: { from: number; to: number } }) => void;
  category: string;
}

export const defaultSlashCommands: SlashCommandItem[] = [
  // Text blocks
  {
    title: 'Heading 1',
    description: 'Large heading',
    icon: 'H1',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium heading',
    icon: 'H2',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small heading',
    icon: 'H3',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '\u2022',
    category: 'Lists',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    category: 'Lists',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: '\u2611',
    category: 'Lists',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Code with syntax highlighting',
    icon: '</>',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Blockquote',
    description: 'Quote or excerpt',
    icon: '\u201C',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: '\u2014',
    category: 'Text',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Callout',
    description: 'Highlighted info box',
    icon: '\uD83D\uDCA1',
    category: 'Blocks',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setCallout().run();
    },
  },
  {
    title: 'Toggle',
    description: 'Collapsible content',
    icon: '\u25B6',
    category: 'Blocks',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setToggle().run();
    },
  },
  {
    title: 'Image',
    description: 'Upload or embed an image',
    icon: '\uD83D\uDDBC',
    category: 'Media',
    command: ({ editor, range }) => {
      const src = window.prompt('Enter image URL:');
      if (src) {
        editor?.chain().focus().deleteRange(range).setImageBlock({ src }).run();
      }
    },
  },
  {
    title: 'Embed',
    description: 'Embed YouTube, Vimeo, etc.',
    icon: '\uD83C\uDFAC',
    category: 'Media',
    command: ({ editor, range }) => {
      const src = window.prompt('Enter embed URL:');
      if (src) {
        editor?.chain().focus().deleteRange(range).setEmbed({ src }).run();
      }
    },
  },
  {
    title: 'Bookmark',
    description: 'Link preview card',
    icon: '\uD83D\uDD17',
    category: 'Media',
    command: ({ editor, range }) => {
      const url = window.prompt('Enter URL:');
      if (url) {
        editor?.chain().focus().deleteRange(range).setBookmark({ url, title: url }).run();
      }
    },
  },
  // Tables
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '\u{1F5C2}',
    category: 'Tables',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  // Layout
  {
    title: '2 Columns',
    description: 'Split into two columns',
    icon: '\u2016',
    category: 'Layout',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setColumns(2).run();
    },
  },
  {
    title: '3 Columns',
    description: 'Split into three columns',
    icon: '\u2980',
    category: 'Layout',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setColumns(3).run();
    },
  },
  // Advanced
  {
    title: 'Math Equation',
    description: 'LaTeX math block',
    icon: '\u{1D70B}',
    category: 'Advanced',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setMathBlock().run();
    },
  },
  {
    title: 'Inline Math',
    description: 'Inline LaTeX equation',
    icon: '\u{1D465}',
    category: 'Advanced',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setInlineMath().run();
    },
  },
  {
    title: 'Mermaid Diagram',
    description: 'Flowcharts, sequences, and more',
    icon: '\u{1F4CA}',
    category: 'Advanced',
    command: ({ editor, range }) => {
      editor?.chain().focus().deleteRange(range).setMermaid().run();
    },
  },
];

export function filterSlashCommands(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q),
  );
}

export interface SlashCommandOptions {
  suggestion: Partial<SuggestionOptions>;
}

export const slashCommandPluginKey = new PluginKey('slashCommand');

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: slashCommandPluginKey,
        items: ({ query }: { query: string }) =>
          filterSlashCommands(defaultSlashCommands, query),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
