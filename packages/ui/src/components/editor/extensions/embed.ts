import { Node, mergeAttributes } from '@tiptap/core';

export interface EmbedOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: {
        src: string;
        width?: string;
        height?: string;
      }) => ReturnType;
    };
  }
}

function detectProvider(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/twitter\.com|x\.com/.test(url)) return 'twitter';
  if (/codepen\.io/.test(url)) return 'codepen';
  if (/figma\.com/.test(url)) return 'figma';
  if (/loom\.com/.test(url)) return 'loom';
  return 'generic';
}

function toEmbedUrl(url: string, provider: string): string {
  if (provider === 'youtube') {
    const match =
      url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/) ??
      url.match(/youtube\.com\/embed\/([\w-]+)/);
    if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (provider === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/);
    if (match?.[1]) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return url;
}

export const Embed = Node.create<EmbedOptions>({
  name: 'embed',

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
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-src'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-src': attributes.src as string,
        }),
      },
      provider: {
        default: 'generic',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-provider') || 'generic',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-provider': attributes.provider as string,
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
      height: {
        default: '400px',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-height') || '400px',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-height': attributes.height as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="embed"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const src = attrs['data-src'] || '';
    const provider = attrs['data-provider'] || 'generic';
    const width = attrs['data-width'] || '100%';
    const height = attrs['data-height'] || '400px';
    const embedUrl = toEmbedUrl(src, provider);

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-type': 'embed',
        'data-provider': provider,
        'data-src': src,
        'data-width': width,
        'data-height': height,
        class: 'cept-embed',
      }),
      [
        'iframe',
        {
          src: embedUrl,
          width,
          height,
          frameborder: '0',
          allowfullscreen: 'true',
          loading: 'lazy',
          style: 'border: none; border-radius: 4px;',
        },
      ],
    ] as const;
  },

  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands }) => {
          const provider = detectProvider(attrs.src);
          return commands.insertContent({
            type: this.name,
            attrs: { ...attrs, provider },
          });
        },
    };
  },
});

export { detectProvider, toEmbedUrl };
