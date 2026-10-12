/**
 * Fenced-block plugins (EDT-013, D-33; phase-1 plan PR 50).
 *
 * A plugin claims code fences by their info string (```` ```mermaid ````) and
 * gives them their own editor node type, so the editor can render them with
 * its node view. The interface is internal to Cept; a third-party registry is
 * later.
 *
 * The page pipeline stays plugin-free: `parseMarkdownDocument` loads every
 * fence as a `codeBlock`. `claimFencedBlocks` turns the claimed ones into
 * plugin nodes for the editor, and `releaseFencedBlocks` turns them back
 * before `serializeMarkdownDocument`. A released node is the same `codeBlock`
 * the parse produced, so an unchanged block is saved byte for byte and an
 * edited one is written with the same fence and info string.
 *
 * A plugin node holds `language`, `meta` (when the fence has one), `fence`
 * (the fence it was written with; null when indented) and `source` (the
 * fence body).
 */

import type { PmNode } from './prosemirror.js';

/** A fenced-block plugin: which fences it claims and the node type they load as. */
export interface FencedBlockPlugin {
  /** The editor node type of the plugin's blocks, e.g. `mermaid`. */
  name: string;
  /** Whether the plugin claims a fence with this language and meta string. */
  claims(language: string, meta: string | null): boolean;
}

/**
 * The plugin node for a new block with this body. It is written as a backtick
 * fence; the caller passes a `language` its plugin claims (otherwise the block
 * loads back as a plain code block).
 */
export function fencedBlockNode(
  plugin: FencedBlockPlugin,
  language: string,
  source: string,
): PmNode {
  return { type: plugin.name, attrs: { language, fence: '```', source } };
}

/**
 * Turn every `codeBlock` a plugin claims into that plugin's node. When several
 * plugins claim a fence, the first in `plugins` wins.
 */
export function claimFencedBlocks(doc: PmNode, plugins: readonly FencedBlockPlugin[]): PmNode {
  if (plugins.length === 0) return doc;
  return mapNodes(doc, (node) => {
    if (node.type !== 'codeBlock') return node;
    const language = node.attrs?.language;
    if (typeof language !== 'string' || language === '') return node;
    const meta = typeof node.attrs?.meta === 'string' ? node.attrs.meta : null;
    const plugin = plugins.find((candidate) => candidate.claims(language, meta));
    if (!plugin) return node;
    const source = (node.content ?? []).map((child) => child.text ?? '').join('');
    return { type: plugin.name, attrs: { ...node.attrs, source } };
  });
}

/** Turn every plugin node back into the `codeBlock` it is saved as. */
export function releaseFencedBlocks(doc: PmNode, plugins: readonly FencedBlockPlugin[]): PmNode {
  if (plugins.length === 0) return doc;
  const names = new Set(plugins.map((plugin) => plugin.name));
  return mapNodes(doc, (node) => {
    if (!names.has(node.type)) return node;
    const { source, meta, fence, ...rest } = node.attrs ?? {};
    // Match the parse's shape exactly so unchanged blocks reuse their source:
    // `meta` only when set, `fence` only when known.
    const attrs = {
      ...rest,
      ...(typeof meta === 'string' && meta !== '' ? { meta } : {}),
      ...(fence !== undefined ? { fence } : {}),
    };
    const text = typeof source === 'string' ? source : '';
    return {
      type: 'codeBlock',
      attrs,
      ...(text ? { content: [{ type: 'text', text }] } : {}),
    };
  });
}

function mapNodes(node: PmNode, fn: (node: PmNode) => PmNode): PmNode {
  const mapped = fn(node);
  if (mapped !== node || !node.content) return mapped;
  return { ...node, content: node.content.map((child) => mapNodes(child, fn)) };
}
