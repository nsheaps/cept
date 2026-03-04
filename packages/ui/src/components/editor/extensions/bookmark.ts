import { Node, mergeAttributes } from '@tiptap/core';

export interface BookmarkOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attrs: {
        url: string;
        title?: string;
        description?: string;
        favicon?: string;
        image?: string;
      }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions>({
  name: 'bookmark',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-url') ?? null,
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-url': attributes.url as string,
        }),
      },
      title: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-title') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-title': attributes.title as string,
        }),
      },
      description: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-description') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-description': attributes.description as string,
        }),
      },
      favicon: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-favicon') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-favicon': attributes.favicon as string,
        }),
      },
      image: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-image') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-image': attributes.image as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'aside[data-type="bookmark"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const url = attrs['data-url'] || '';
    const title = attrs['data-title'] || '';
    const description = attrs['data-description'] || '';
    const favicon = attrs['data-favicon'] || '';
    const image = attrs['data-image'] || '';

    const asideAttrs = mergeAttributes(this.options.HTMLAttributes, {
      'data-type': 'bookmark',
      'data-url': url,
      'data-title': title,
      'data-description': description,
      'data-favicon': favicon,
      'data-image': image,
      class: 'cept-bookmark',
    });

    // Build bookmark text section
    const textChildren: [string, Record<string, string>, ...unknown[]][] = [];
    if (title) {
      textChildren.push(['div', { class: 'cept-bookmark-title' }, title]);
    }
    if (description) {
      textChildren.push(['div', { class: 'cept-bookmark-description' }, description]);
    }

    // Build meta row
    const metaChildren: [string, Record<string, string>, ...unknown[]][] = [];
    if (favicon) {
      metaChildren.push(['img', {
        src: favicon,
        class: 'cept-bookmark-favicon',
        width: '16',
        height: '16',
        loading: 'lazy',
      }]);
    }
    metaChildren.push(['span', { class: 'cept-bookmark-url' }, url]);

    textChildren.push(['div', { class: 'cept-bookmark-meta' }, ...metaChildren] as [string, Record<string, string>, ...unknown[]]);

    const linkContent: [string, Record<string, string>, ...unknown[]][] = [
      ['div', { class: 'cept-bookmark-text' }, ...textChildren] as [string, Record<string, string>, ...unknown[]],
    ];

    if (image) {
      linkContent.push(['div', { class: 'cept-bookmark-cover' },
        ['img', { src: image, loading: 'lazy', draggable: 'false' }],
      ] as [string, Record<string, string>, ...unknown[]]);
    }

    return [
      'aside',
      asideAttrs,
      ['a', {
        href: url || '#',
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'cept-bookmark-link',
        contenteditable: 'false',
      }, ...linkContent] as [string, Record<string, string>, ...unknown[]],
    ] as const;
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
