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
          const img = element.querySelector('img');
          return img?.getAttribute('src') ?? element.getAttribute('data-src') ?? null;
        },
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-src': attributes.src as string,
        }),
      },
      alt: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          const img = element.querySelector('img');
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
        default: '100%',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-width') || '100%',
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
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const src = attrs['data-src'] || '';
    const alt = attrs['data-alt'] || '';
    const caption = attrs['data-caption'] || '';
    const width = attrs['data-width'] || '100%';

    const figureAttrs = mergeAttributes(this.options.HTMLAttributes, {
      'data-type': 'image',
      'data-src': src,
      'data-alt': alt,
      'data-caption': caption,
      'data-width': width,
      class: 'cept-image-block',
    });

    const imgSpec = [
      'img',
      {
        src,
        alt,
        style: `width: ${width}; max-width: 100%;`,
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

  addStorage() {
    return {
      markdown: {
        serialize(
          state: Record<string, unknown>,
          node: { attrs: { src: string; alt: string } },
        ) {
          const s = state as unknown as {
            write: (text: string) => void;
            ensureNewLine: () => void;
            closeBlock: (n: unknown) => void;
          };
          s.write(`![${node.attrs.alt || ''}](${node.attrs.src || ''})`);
          s.closeBlock(node);
        },
        parse: {
          // Transform bare <img> tags into <figure data-type="image"> before
          // ProseMirror parsing so they match imageBlock's parseHTML rule
          // instead of being consumed by tiptap-markdown's built-in image node.
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('img').forEach((img) => {
              // Skip images already inside a figure
              if (img.closest('figure[data-type="image"]')) return;
              const figure = img.ownerDocument.createElement('figure');
              figure.setAttribute('data-type', 'image');
              figure.setAttribute('data-src', img.getAttribute('src') || '');
              figure.setAttribute('data-alt', img.getAttribute('alt') || '');
              const newImg = img.ownerDocument.createElement('img');
              newImg.setAttribute('src', img.getAttribute('src') || '');
              newImg.setAttribute('alt', img.getAttribute('alt') || '');
              figure.appendChild(newImg);
              img.replaceWith(figure);
            });
          },
        },
      },
    };
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
