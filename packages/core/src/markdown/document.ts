/**
 * Markdown page <-> ProseMirror document (D-15 option A; phase-1 plan PR 47).
 *
 * `parseMarkdownDocument` splits off the front matter (PR 46), parses the body
 * with remark and converts it with the bridge in `prosemirror.ts`. It also
 * records the exact source text of every top-level block.
 *
 * `serializeMarkdownDocument` writes a document back. Given the parse it came
 * from, every top-level block that is unchanged is written as its original
 * source text, so loading and saving a page without edits returns it byte for
 * byte (EDT-005), and an edit rewrites only the blocks it touched. Changed and
 * new blocks go through remark-stringify, using the style kept on each node.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Options as StringifyOptions } from 'remark-stringify';
import { defaultHandlers } from 'mdast-util-to-markdown';
import type { Handle, State } from 'mdast-util-to-markdown';
import type { Nodes, Root } from 'mdast';
import { frontMatterPrefix } from './front-matter.js';
import { blocksToMdast, mdastToBlocks, styleOf } from './prosemirror.js';
import type { PmNode } from './prosemirror.js';

/** A parsed page: its front matter, its document and each block's source. */
export interface MarkdownDocument {
  /** The bytes before the first block, kept verbatim (see `frontMatterPrefix`). */
  frontMatter: string;
  /** The page body as a ProseMirror `doc` node. */
  doc: PmNode;
  /**
   * The source text of each top-level block of `doc`, including the blank
   * lines after it; joined, they are the page body.
   */
  sources: string[];
}

const parser = unified().use(remarkParse).use(remarkGfm);

/** Parse a page into a ProseMirror document. */
export function parseMarkdownDocument(markdown: string): MarkdownDocument {
  const frontMatter = frontMatterPrefix(markdown);
  const body = markdown.slice(frontMatter.length);
  const tree = parser.parse(body);
  const starts = tree.children.map((node, i) => (i === 0 ? 0 : node.position!.start.offset!));
  const sources = starts.map((start, i) => body.slice(start, starts[i + 1] ?? body.length));
  if (sources.length === 0 && body !== '') sources.push(body);
  const content = mdastToBlocks(tree.children, body);
  // Whitespace-only bodies have no blocks; keep the text as one raw block.
  if (content.length === 0 && body !== '') {
    content.push({ type: 'rawBlock', attrs: { markdown: body } });
  }
  return { frontMatter, doc: { type: 'doc', content }, sources };
}

/**
 * Serialize a document. With `original` (the parse it was edited from), its
 * front matter and the source of every unchanged block are reused; without
 * it, the whole body is generated and `frontMatter` is used as the prefix.
 */
export function serializeMarkdownDocument(
  doc: PmNode,
  original?: MarkdownDocument,
  frontMatter = original?.frontMatter ?? '',
): string {
  const blocks = (doc.content ?? []).filter((block) => !isEmptyParagraph(block, doc));
  const unused = new Map<string, number[]>();
  (original?.doc.content ?? []).forEach((block, i) => {
    const key = JSON.stringify(block);
    unused.set(key, [...(unused.get(key) ?? []), i]);
  });

  let body = '';
  let previous: number | undefined;
  blocks.forEach((block, index) => {
    const last = index === blocks.length - 1;
    const reuse = unused.get(JSON.stringify(block))?.shift();
    let text =
      reuse !== undefined && original
        ? original.sources[reuse]!
        : `${stringifyBlocks([block])}${last ? '' : '\n'}`;
    // A reused block that is now last keeps one line ending, not blank lines.
    if (last && reuse !== undefined && reuse !== original!.sources.length - 1) {
      text = text.replace(/(\r?\n)\s*$/, '$1');
    }
    // Blocks that were not neighbours in the source get a blank line between them.
    const neighbours = reuse !== undefined && previous !== undefined && reuse === previous + 1;
    if (body !== '' && !neighbours && !/\n[ \t]*\r?\n$/.test(body)) {
      body = body.replace(/(?:\r?\n)?$/, '\n\n');
    }
    body += text;
    previous = reuse;
  });
  return frontMatter + body;
}

/** An empty document is one empty paragraph in the editor; it is no text. */
function isEmptyParagraph(block: PmNode, doc: PmNode): boolean {
  return doc.content?.length === 1 && block.type === 'paragraph' && !block.content;
}

/** Run `fn` with serializer options overridden for one node. */
function withOptions<T>(state: State, override: Record<string, unknown>, fn: () => T): T {
  const options = state.options as Record<string, unknown>;
  const saved = Object.fromEntries(Object.keys(override).map((key) => [key, options[key]]));
  Object.assign(options, override);
  try {
    return fn();
  } finally {
    Object.assign(options, saved);
  }
}

/** A handler (and its `peek`, used for the neighbouring node) with per-node options. */
/** A handler; some (emphasis, strong, link) also have a `peek` for their first character. */
type PeekHandle = Handle & { peek?: Handle };

function styled(handle: PeekHandle, pick: (node: Nodes) => Record<string, unknown>): Handle {
  const wrapped: PeekHandle = (node, parent, state, info) =>
    withOptions(state, pick(node as Nodes), () => handle(node as never, parent, state, info));
  const peek = handle.peek;
  if (peek) {
    wrapped.peek = (node: Nodes, parent, state, info) =>
      withOptions(state, pick(node as Nodes), () => peek(node as never, parent, state, info));
  }
  return wrapped;
}

const pick = (entries: [string, unknown][]) =>
  Object.fromEntries(entries.filter(([, value]) => value !== undefined));

function ruleOptions(marker: string | undefined): Record<string, unknown> {
  const match = marker ? /^([-*_])/.exec(marker) : null;
  if (!match) return {};
  const char = match[1]!;
  return {
    rule: char,
    ruleRepetition: Math.max(3, marker!.split(char).length - 1),
    ruleSpaces: /\s/.test(marker!),
  };
}

const handlers: StringifyOptions['handlers'] = {
  emphasis: styled(defaultHandlers.emphasis, (n) => pick([['emphasis', styleOf(n).marker?.[0]]])),
  strong: styled(defaultHandlers.strong, (n) => pick([['strong', styleOf(n).marker?.[0]]])),
  heading: styled(defaultHandlers.heading, (n) => pick([['setext', styleOf(n).setext]])),
  thematicBreak: styled(defaultHandlers.thematicBreak, (n) => ruleOptions(styleOf(n).marker)),
  code: styled(defaultHandlers.code, (n) => {
    const fence = styleOf(n).fence;
    if (fence === null && !(n as { lang?: string | null }).lang) return { fences: false };
    return pick([['fence', fence?.[0]]]);
  }),
  list: styled(defaultHandlers.list, (n) =>
    pick([
      ['bullet', styleOf(n).bullet],
      ['bulletOrdered', styleOf(n).delimiter],
    ]),
  ),
  link(node, parent, state, info) {
    // A bare URL (GFM autolink literal) is written as it was typed.
    if (styleOf(node).autolink === 'literal') {
      return node.children.map((child: Nodes) => ('value' in child ? child.value : '')).join('');
    }
    return defaultHandlers.link(node, parent, state, info);
  },
  break(node, parent, state, info) {
    return styleOf(node).spaces ? '  \n' : defaultHandlers.break(node, parent, state, info);
  },
};

const stringifier = unified().use(remarkGfm).use(remarkStringify, {
  bullet: '-',
  emphasis: '*',
  strong: '*',
  fence: '`',
  rule: '-',
  listItemIndent: 'one',
  handlers,
});

function stringifyBlocks(blocks: readonly PmNode[]): string {
  const root: Root = { type: 'root', children: blocksToMdast(blocks) };
  return stringifier.stringify(root);
}
