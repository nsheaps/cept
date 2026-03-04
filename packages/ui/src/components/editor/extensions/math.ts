import { Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';

export interface MathBlockOptions {
  HTMLAttributes: Record<string, string>;
}

export interface InlineMathOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (attrs?: { content?: string }) => ReturnType;
    };
    inlineMath: {
      setInlineMath: (attrs?: { content?: string }) => ReturnType;
    };
  }
}

export function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch {
    return `<span class="cept-math-error">${latex}</span>`;
  }
}

export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-math') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-math': attributes.content as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const latex = attrs['data-math'] || '';
    const rendered = renderKatex(latex, true);

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, attrs, {
        'data-type': 'math-block',
        class: 'cept-math-block',
      }),
      ['div', { class: 'cept-math-rendered', innerHTML: rendered }],
    ] as const;
  },

  addCommands() {
    return {
      setMathBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content: attrs?.content ?? 'E = mc^2' },
          });
        },
    };
  },
});

export const InlineMath = Node.create<InlineMathOptions>({
  name: 'inlineMath',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-math') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-math': attributes.content as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, string>;
    const latex = attrs['data-math'] || '';
    const rendered = renderKatex(latex, false);

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, attrs, {
        'data-type': 'inline-math',
        class: 'cept-inline-math',
      }),
      rendered,
    ] as const;
  },

  addCommands() {
    return {
      setInlineMath:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content: attrs?.content ?? 'x^2' },
          });
        },
    };
  },
});
