import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { icon?: string; color?: string }) => ReturnType;
      toggleCallout: (attrs?: { icon?: string; color?: string }) => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      icon: {
        default: '\uD83D\uDCA1',
        parseHTML: (element) => element.getAttribute('data-icon') || '\uD83D\uDCA1',
        renderHTML: (attributes) => ({
          'data-icon': attributes.icon as string,
        }),
      },
      color: {
        default: 'default',
        parseHTML: (element) => element.getAttribute('data-color') || 'default',
        renderHTML: (attributes) => ({
          'data-color': attributes.color as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: 'cept-callout',
      }),
      [
        'span',
        { class: 'cept-callout-icon', contenteditable: 'false' },
        HTMLAttributes['data-icon'] || '\uD83D\uDCA1',
      ],
      ['div', { class: 'cept-callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});
