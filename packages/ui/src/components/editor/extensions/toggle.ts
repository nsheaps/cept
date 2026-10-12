import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface ToggleOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: (attrs?: { summary?: string }) => ReturnType;
      toggleToggleOpen: (pos: number) => ReturnType;
    };
  }
}

/**
 * Matches `> ` at the start of a line to create a toggle (like Notion).
 * This takes priority over the blockquote input rule.
 */
const toggleInputRegex = /^\s*>\s$/;

const togglePluginKey = new PluginKey('toggleClick');

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
      ['summary', { class: 'cept-toggle-summary' }, node.attrs.summary as string],
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
      toggleToggleOpen:
        (pos) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (dispatch) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              open: !node.attrs.open,
            });
            dispatch(tr);
          }
          return true;
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

  addProseMirrorPlugins() {
    const nodeName = this.name;
    return [
      new Plugin({
        key: togglePluginKey,
        props: {
          handleClickOn(view, _pos, node, nodePos, event) {
            if (node.type.name !== nodeName) return false;
            const target = event.target as HTMLElement;
            // Only toggle when clicking on the summary element
            if (!target.closest('.cept-toggle-summary')) return false;
            // Prevent default to stop ProseMirror from handling the click
            event.preventDefault();
            // Toggle the open attribute
            const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
              ...node.attrs,
              open: !node.attrs.open,
            });
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
