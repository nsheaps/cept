import { Node, mergeAttributes } from '@tiptap/core';

export interface ColumnsOptions {
  HTMLAttributes: Record<string, string>;
}

export interface ColumnOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count?: number) => ReturnType;
    };
  }
}

export const Column = Node.create<ColumnOptions>({
  name: 'column',

  group: 'block',

  content: 'block+',

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'column',
        class: 'cept-column',
      }),
      0,
    ] as const;
  },
});

export const Columns = Node.create<ColumnsOptions>({
  name: 'columns',

  group: 'block',

  content: 'column{2,}',

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      count: {
        default: 2,
        parseHTML: (element: HTMLElement) => {
          const val = element.getAttribute('data-columns');
          return val ? parseInt(val, 10) : 2;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-columns': String(attributes.count),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'columns',
        class: 'cept-columns',
      }),
      0,
    ] as const;
  },

  addCommands() {
    return {
      setColumns:
        (count = 2) =>
        ({ commands }) => {
          const columns = Array.from({ length: count }, () => ({
            type: 'column',
            content: [{ type: 'paragraph' }],
          }));

          return commands.insertContent({
            type: this.name,
            attrs: { count },
            content: columns,
          });
        },
    };
  },
});
