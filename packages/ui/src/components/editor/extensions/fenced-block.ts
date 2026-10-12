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
  /**
   * Render the block's body into `element`; may return a cleanup function.
   * Called again (after the cleanup) whenever the source, language or meta
   * string changes.
   */
  render(source: string, element: HTMLElement, fence: FencedBlockInfo): void | (() => void);
}

/** The fence's info string, split as the parser splits it. */
export interface FencedBlockInfo {
  language: string;
  meta: string | null;
}

/** Plugin names become node types and CSS selectors, so keep them plain. */
const PLUGIN_NAME = /^[a-z][a-zA-Z0-9-]*$/;

function fencedBlockState(attrs: Record<string, unknown>) {
  return {
    source: String(attrs.source ?? ''),
    language: String(attrs.language ?? ''),
    meta: typeof attrs.meta === 'string' ? attrs.meta : null,
  };
}

/**
 * The TipTap node for a fenced-block plugin: an atom block with a node view.
 * `renderHTML` writes only the wrapper and the source attribute (enough for
 * copy and paste between Cept editors); a static rendering of the body for
 * export is not part of the interface yet.
 */
export function createFencedBlockExtension(plugin: FencedBlockEditorPlugin) {
  if (!PLUGIN_NAME.test(plugin.name)) {
    throw new Error(`Invalid fenced-block plugin name: ${JSON.stringify(plugin.name)}`);
  }
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
        let state = fencedBlockState(node.attrs);
        let cleanup = plugin.render(state.source, dom, {
          language: state.language,
          meta: state.meta,
        });
        return {
          dom,
          update(updated) {
            if (updated.type.name !== plugin.name) return false;
            const next = fencedBlockState(updated.attrs);
            if (
              next.source !== state.source ||
              next.language !== state.language ||
              next.meta !== state.meta
            ) {
              cleanup?.();
              dom.replaceChildren();
              state = next;
              cleanup = plugin.render(state.source, dom, {
                language: state.language,
                meta: state.meta,
              });
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
