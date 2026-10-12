import { Node, mergeAttributes } from '@tiptap/core';
import type { FencedBlockPlugin } from '@cept/core';

/**
 * An editor plugin for a fenced block (EDT-013, D-33): it claims fences by
 * their info string and renders their body. The page pipeline loads claimed
 * fences as the plugin's node (`claimFencedBlocks`) and saves them back to the
 * same fence (`releaseFencedBlocks`). Internal to Cept for now.
 */
export interface FencedBlockEditorPlugin extends FencedBlockPlugin {
  /** The fence language written for blocks inserted in the editor. */
  language: string;
  /** The body of a newly inserted block. */
  defaultSource?: string;
  /** Render the block's body into `element`; may return a cleanup function. */
  render(source: string, element: HTMLElement): void | (() => void);
}

/** The TipTap node for a fenced-block plugin: an atom block with a node view. */
export function createFencedBlockExtension(plugin: FencedBlockEditorPlugin) {
  return Node.create({
    name: plugin.name,
    group: 'block',
    atom: true,

    addAttributes() {
      return {
        language: { default: plugin.language },
        meta: { default: null },
        fence: { default: '```' },
        source: {
          default: plugin.defaultSource ?? '',
          parseHTML: (element: HTMLElement) => element.getAttribute('data-source') ?? '',
          renderHTML: (attributes: Record<string, unknown>) => ({
            'data-source': String(attributes.source ?? ''),
          }),
        },
      };
    },

    parseHTML() {
      return [{ tag: `div[data-type="${plugin.name}"]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, { 'data-type': plugin.name, class: 'cept-fenced-block' }),
      ];
    },

    addNodeView() {
      return ({ node }) => {
        const dom = document.createElement('div');
        dom.className = 'cept-fenced-block';
        dom.setAttribute('data-type', plugin.name);
        let source = String(node.attrs.source ?? '');
        let cleanup = plugin.render(source, dom);
        return {
          dom,
          update(updated) {
            if (updated.type.name !== plugin.name) return false;
            const next = String(updated.attrs.source ?? '');
            if (next !== source) {
              cleanup?.();
              dom.replaceChildren();
              source = next;
              cleanup = plugin.render(source, dom);
            }
            return true;
          },
          destroy() {
            cleanup?.();
          },
        };
      };
    },
  });
}
