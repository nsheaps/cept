import { Node, mergeAttributes } from '@tiptap/core';

export interface ImageBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (attrs: {
        src: string;
        alt?: string;
        caption?: string;
        width?: string;
      }) => ReturnType;
    };
  }
}

/** The `<img>` a parsed element stands for: itself, or the one inside a figure. */
function imageOf(element: HTMLElement): HTMLElement | null {
  return element.tagName === 'IMG' ? element : element.querySelector('img');
}

export const ImageBlock = Node.create<ImageBlockOptions>({
  name: 'imageBlock',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img = imageOf(element);
          return img?.getAttribute('src') ?? element.getAttribute('data-src') ?? null;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-src': attributes.src as string,
        }),
      },
      alt: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          const img = imageOf(element);
          return img?.getAttribute('alt') ?? element.getAttribute('data-alt') ?? '';
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-alt': attributes.alt as string,
        }),
      },
      caption: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          const figcaption = element.querySelector('figcaption');
          return figcaption?.textContent ?? element.getAttribute('data-caption') ?? '';
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-caption': attributes.caption as string,
        }),
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-width') || null,
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-width': attributes.width as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="image"]',
      },
      // A bare image in pasted HTML.
      { tag: 'img[src]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const src = attrs['data-src'] || '';
    const alt = attrs['data-alt'] || '';
    const caption = attrs['data-caption'] || '';
    const width = attrs['data-width'] || null;

    const figureAttrs = mergeAttributes(this.options.HTMLAttributes, {
      'data-type': 'image',
      'data-src': src,
      'data-alt': alt,
      'data-caption': caption,
      ...(width ? { 'data-width': width } : {}),
      class: 'cept-image-block',
    });

    const imgStyle = width ? `width: ${width}; max-width: 100%;` : 'max-width: 100%;';

    const imgSpec = [
      'img',
      {
        src,
        alt,
        style: imgStyle,
        draggable: 'false',
      },
    ] as const;

    if (caption) {
      return [
        'figure',
        figureAttrs,
        imgSpec,
        ['figcaption', { class: 'cept-image-caption' }, caption] as const,
      ] as const;
    }

    return ['figure', figureAttrs, imgSpec] as const;
  },

  addCommands() {
    return {
      setImageBlock:
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
