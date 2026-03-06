import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

export interface ToggleOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: (attrs?: { summary?: string }) => ReturnType;
    };
  }
}

/**
 * Matches `> ` at the start of a line to create a toggle (like Notion).
 * This takes priority over the blockquote input rule.
 */
const toggleInputRegex = /^\s*>\s$/;

export const Toggle = Node.create<ToggleOptions>({
  name: 'toggle',

  // Higher priority than blockquote (100) so `> ` triggers toggle first
  priority: 110,

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
      summary: {
        default: 'Toggle',
        parseHTML: (element) =>
          element.querySelector('.cept-toggle-summary')?.textContent || 'Toggle',
        renderHTML: () => ({}),
      },
      open: {
        default: false,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attributes) => {
          if (attributes.open) {
            return { open: '' };
          }
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'details[data-type="toggle"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'details',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'toggle',
        class: 'cept-toggle',
      }),
      [
        'summary',
        { class: 'cept-toggle-summary' },
        node.attrs.summary as string,
      ],
      ['div', { class: 'cept-toggle-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setToggle:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: toggleInputRegex,
        type: this.type,
      }),
    ];
  },
});
