import { Node, mergeAttributes } from '@tiptap/core';
import type { ViewType } from '@cept/core';

export interface InlineDatabaseOptions {
  HTMLAttributes: Record<string, string>;
}

export interface InlineDatabaseAttrs {
  databaseId: string;
  viewType?: ViewType;
  viewId?: string;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineDatabase: {
      setInlineDatabase: (attrs: InlineDatabaseAttrs) => ReturnType;
    };
  }
}

export const SUPPORTED_VIEW_TYPES: ViewType[] = [
  'table',
  'board',
  'calendar',
  'gallery',
  'list',
  'map',
];

export const InlineDatabase = Node.create<InlineDatabaseOptions>({
  name: 'inlineDatabase',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      databaseId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-database-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-database-id': attributes.databaseId as string,
        }),
      },
      viewType: {
        default: 'table',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-view-type') || 'table',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-view-type': attributes.viewType as string,
        }),
      },
      viewId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-view-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-view-id': attributes.viewId as string | null,
        }),
      },
      title: {
        default: 'Untitled Database',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-title') || 'Untitled Database',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-title': attributes.title as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="inline-database"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const databaseId = attrs['data-database-id'] || '';
    const viewType = attrs['data-view-type'] || 'table';
    const title = attrs['data-title'] || 'Untitled Database';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-type': 'inline-database',
        'data-database-id': databaseId,
        'data-view-type': viewType,
        'data-view-id': attrs['data-view-id'] || '',
        'data-title': title,
        class: 'cept-inline-database',
      }),
      [
        'div',
        { class: 'cept-inline-database-header' },
        ['span', { class: 'cept-inline-database-icon' }, '\uD83D\uDDC3\uFE0F'],
        ['span', { class: 'cept-inline-database-title' }, title],
        ['span', { class: 'cept-inline-database-view-type' }, viewType],
      ],
      [
        'div',
        { class: 'cept-inline-database-body', 'data-database-id': databaseId },
      ],
    ] as const;
  },

  addCommands() {
    return {
      setInlineDatabase:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              databaseId: attrs.databaseId,
              viewType: attrs.viewType ?? 'table',
              viewId: attrs.viewId ?? null,
              title: attrs.title ?? 'Untitled Database',
            },
          });
        },
    };
  },
});
