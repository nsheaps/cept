import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Attributes } from '@tiptap/core';
import type { FencedBlockEditorPlugin } from './fenced-block.js';
import { createFencedBlockExtension } from './fenced-block.js';
import { KnowledgeGraphView } from '../../knowledge-graph/KnowledgeGraphView.js';
import type { GraphData, GraphLink } from '../../knowledge-graph/graph-types.js';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    graph: {
      setGraph: (attrs?: { source?: string }) => ReturnType;
    };
  }
}

export const defaultGraphContent = JSON.stringify(
  {
    nodes: [
      { id: 'home', title: 'Home' },
      { id: 'notes', title: 'Notes' },
    ],
    links: [{ source: 'home', target: 'notes', type: 'link' }],
  },
  null,
  2,
);

const LINK_TYPES: ReadonlySet<string> = new Set<GraphLink['type']>(['link', 'parent']);

/**
 * Read the body of a ` ```graph ` fence: JSON with `nodes` (`id`, `title`,
 * optional `group` and `icon`) and optional `links` (`source`, `target`,
 * optional `type`, default `link`). Throws a readable error for anything else.
 */
export function parseGraphBlock(source: string): GraphData {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new Error(`Graph block is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof raw !== 'object' || raw === null) throw new Error('Graph block needs an object');
  const { nodes, links = [] } = raw as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(nodes)) throw new Error('Graph block needs a "nodes" list');
  if (!Array.isArray(links)) throw new Error('Graph block "links" must be a list');

  const ids = new Set<string>();
  const parsedNodes = nodes.map((node: unknown, index) => {
    const n = (node ?? {}) as Record<string, unknown>;
    if (typeof n.id !== 'string' || n.id === '') throw new Error(`Node ${index} needs an "id"`);
    if (typeof n.title !== 'string' || n.title === '') {
      throw new Error(`Node "${n.id}" needs a "title"`);
    }
    if (ids.has(n.id)) throw new Error(`Duplicate node id "${n.id}"`);
    ids.add(n.id);
    return {
      id: n.id,
      title: n.title,
      ...(typeof n.group === 'string' ? { group: n.group } : {}),
      ...(typeof n.icon === 'string' ? { icon: n.icon } : {}),
    };
  });

  const parsedLinks = links.map((link: unknown, index) => {
    const l = (link ?? {}) as Record<string, unknown>;
    for (const end of ['source', 'target'] as const) {
      const id = l[end];
      if (typeof id !== 'string') throw new Error(`Link ${index} needs a "${end}"`);
      if (!ids.has(id)) throw new Error(`Link ${index} points at unknown node "${id}"`);
    }
    const type = typeof l.type === 'string' && LINK_TYPES.has(l.type) ? l.type : 'link';
    return {
      source: l.source as string,
      target: l.target as string,
      type: type as GraphLink['type'],
    };
  });

  return { nodes: parsedNodes, links: parsedLinks };
}

/**
 * The graph fenced-block plugin (D-33): claims ` ```graph ` fences and shows
 * their JSON body as an interactive knowledge graph. A body that does not
 * parse shows its source and the error instead.
 */
export const graphBlockPlugin: FencedBlockEditorPlugin = {
  name: 'graph',
  language: 'graph',
  defaultSource: defaultGraphContent,
  claims: (language) => language === 'graph',
  render(source, element) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cept-graph-block';
    element.append(wrapper);
    try {
      const data = parseGraphBlock(source);
      const root = createRoot(wrapper);
      // A fixed size that fits the editor column; the view does not measure its container.
      root.render(createElement(KnowledgeGraphView, { data, width: 640, height: 360 }));
      return () => {
        // Unmount after the current render pass; ProseMirror may be mid-update.
        queueMicrotask(() => root.unmount());
      };
    } catch (error) {
      const code = document.createElement('pre');
      code.className = 'cept-graph-source';
      code.textContent = source;
      const message = document.createElement('div');
      message.className = 'cept-graph-error';
      message.textContent = error instanceof Error ? error.message : String(error);
      wrapper.append(code, message);
      return undefined;
    }
  },
};

/** The editor node for graph blocks, saved as a ` ```graph ` fence. */
export const GraphBlock = createFencedBlockExtension(graphBlockPlugin).extend({
  addAttributes() {
    const attributes: Attributes = this.parent?.() ?? {};
    return attributes;
  },

  addCommands() {
    return {
      setGraph:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { source: attrs?.source ?? defaultGraphContent },
          }),
    };
  },
});
