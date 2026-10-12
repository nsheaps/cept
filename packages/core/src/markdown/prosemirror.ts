/**
 * mdast <-> ProseMirror JSON bridge (D-15 option A, D-49; phase-1 plan PR 47).
 *
 * Markdown is parsed once by remark into mdast; this module turns mdast into
 * ProseMirror JSON that uses the editor's (TipTap's) node and mark names, and
 * back. How a construct was written (`_` or `*`, a `~~~` fence, a `+` bullet,
 * an autolink) is kept in attributes so an edited block is written the way
 * it was. Math (`$..$`, `$$` blocks) maps to the editor's KaTeX nodes and
 * footnotes to reference and definition nodes (PR 52). Cept's custom blocks
 * (toggles, callouts, columns, embeds, bookmarks) are HTML in the file and
 * are modelled in `html-blocks.ts` (PR 48). Syntax
 * the bridge does not model is kept as raw Markdown in a `rawBlock` or
 * `rawInline` node, so nothing is lost.
 */

import type {
  BlockContent,
  Code,
  DefinitionContent,
  FootnoteDefinition,
  Heading,
  Link,
  List,
  ListItem,
  Nodes,
  Paragraph,
  Parents,
  PhrasingContent,
  RootContent,
  Table,
  TableCell,
  TableRow,
  ThematicBreak,
} from 'mdast';
import { containerOf, elementBlock, htmlBlockTo, structuralTokens } from './html-blocks.js';
import type { StructuralToken } from './html-blocks.js';

/** A ProseMirror mark as JSON. */
export interface PmMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/** A ProseMirror node as JSON (`Node.toJSON()` shape). */
export interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  marks?: PmMark[];
  text?: string;
}

type Attrs = Record<string, unknown>;

/** The source text of an mdast node. */
function sourceOf(node: Nodes, src: string): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? '' : src.slice(start, end);
}

function pmNode(type: string, attrs?: Attrs, content?: PmNode[]): PmNode {
  const node: PmNode = { type };
  const defined = attrs && Object.entries(attrs).filter(([, value]) => value !== undefined);
  if (defined && defined.length > 0) node.attrs = Object.fromEntries(defined);
  if (content && content.length > 0) node.content = content;
  return node;
}

// ---------------------------------------------------------------- mdast -> PM

/** Convert top-level or nested mdast block nodes. */
export function mdastToBlocks(nodes: readonly RootContent[], src: string): PmNode[] {
  return mdastToSourcedBlocks(nodes, src).map((block) => block.node);
}

/** A converted block and the source offset it starts at. */
export interface SourcedBlock {
  node: PmNode;
  start: number | undefined;
}

/**
 * Convert sibling mdast blocks, regrouping the blocks between a container's
 * opening and closing tags (see `html-blocks.ts`). Recovery is local: a tag
 * that does not nest, or a container that cannot be modelled where it is,
 * becomes `rawBlock`s around its body, and the containers around it still load.
 */
export function mdastToSourcedBlocks(nodes: readonly RootContent[], src: string): SourcedBlock[] {
  const root: SourcedBlock[] = [];
  const stack: Frame[] = [];
  const items = () => stack[stack.length - 1]?.items ?? root;
  // Give up on the innermost open container: its opening tag stays raw.
  const unwind = () => {
    const frame = stack.pop()!;
    items().push({ node: rawBlock(frame.token.text), start: frame.start }, ...frame.items);
  };
  for (const node of nodes) {
    const base = node.position?.start.offset;
    const tokens = node.type === 'html' ? structuralTokens(node.value) : null;
    if (!tokens) {
      items().push({ node: blockFrom(node, src), start: base });
      continue;
    }
    for (const token of tokens) {
      const start = base === undefined ? undefined : base + token.offset;
      if (token.kind === 'open') {
        stack.push({ token, container: containerOf(token), items: [], start });
        continue;
      }
      const closer = { node: rawBlock(token.text), start };
      let depth = stack.length - 1;
      while (depth >= 0 && stack[depth]!.token.tag !== token.tag) depth--;
      if (depth < 0) {
        items().push(closer);
        continue;
      }
      while (stack.length > depth + 1) unwind();
      const frame = stack.pop()!;
      const closed = closeFrame(frame, stack[stack.length - 1]);
      if (closed) items().push(...closed, ...(frame.container ? [] : [closer]));
      else
        items().push(
          { node: rawBlock(frame.token.text), start: frame.start },
          ...frame.items,
          closer,
        );
    }
  }
  while (stack.length > 0) unwind();
  return root;
}

interface Frame {
  token: StructuralToken & { kind: 'open' };
  container: PmNode | null;
  items: SourcedBlock[];
  start: number | undefined;
}

const rawBlock = (markdown: string): PmNode => pmNode('rawBlock', { markdown });

/** The blocks a closed container becomes, or null if it cannot be modelled here. */
function closeFrame(frame: Frame, parent: Frame | undefined): SourcedBlock[] | null {
  const { container } = frame;
  // A container Cept does not model: its tags stay raw around its body.
  if (!container) return [{ node: rawBlock(frame.token.text), start: frame.start }, ...frame.items];
  const content = frame.items.map((item) => item.node);
  const inColumns = parent?.container?.type === 'columns';
  if (container.type === 'column' && !inColumns) return null;
  if (
    container.type === 'columns' &&
    !(content.length >= 2 && content.every((node) => node.type === 'column'))
  ) {
    return null;
  }
  const node: PmNode = {
    ...container,
    content: content.length > 0 ? content : [pmNode('paragraph')],
  };
  return [{ node, start: frame.start }];
}

/** Convert mdast that has no source (built from HTML): style detection is skipped. */
const sourceless = (nodes: RootContent[]) => mdastToBlocks(nodes, '');

/** Container content; ProseMirror needs at least one block in it. */
function childBlocks(nodes: readonly RootContent[], src: string): PmNode[] {
  const blocks = mdastToBlocks(nodes, src);
  return blocks.length > 0 ? blocks : [pmNode('paragraph')];
}

function blockFrom(node: RootContent, src: string): PmNode {
  switch (node.type) {
    case 'paragraph':
      return paragraphFrom(node, src);
    case 'heading':
      return pmNode(
        'heading',
        {
          level: node.depth,
          ...(/^\s*[^\s#]/.test(sourceOf(node, src)) ? { setext: true } : {}),
        },
        inlineFrom(node.children, src, []),
      );
    case 'thematicBreak':
      return pmNode('horizontalRule', { marker: sourceOf(node, src).trim() || undefined });
    case 'blockquote':
      return pmNode('blockquote', {}, childBlocks(node.children, src));
    case 'code':
      return pmNode(
        'codeBlock',
        {
          language: node.lang ?? null,
          ...(node.meta ? { meta: node.meta } : {}),
          fence: fenceOf(sourceOf(node, src)),
        },
        node.value ? [{ type: 'text', text: node.value }] : [],
      );
    case 'list':
      return listFrom(node, src);
    case 'table':
      return tableFrom(node, src);
    case 'html':
      return elementBlock(node.value, sourceless) ?? rawBlock(node.value);
    case 'math':
      return pmNode('mathBlock', {
        content: node.value,
        ...(node.meta ? { meta: node.meta } : {}),
      });
    case 'footnoteDefinition':
      return pmNode(
        'footnoteDefinition',
        { identifier: node.identifier, label: node.label ?? node.identifier },
        childBlocks(node.children, src),
      );
    default:
      // Link definitions and anything else not modelled yet.
      return pmNode('rawBlock', { markdown: sourceOf(node, src) });
  }
}

/** The fence a code block was written with; null when indented, undefined without source. */
function fenceOf(text: string): string | null | undefined {
  if (!text) return undefined;
  return /^ {0,3}(`{3,}|~{3,})/.exec(text)?.[1] ?? null;
}

function paragraphFrom(node: Paragraph, src: string): PmNode {
  const [only] = node.children;
  if (node.children.length === 1 && only?.type === 'image') {
    return pmNode('imageBlock', { src: only.url, alt: only.alt ?? '', title: only.title ?? null });
  }
  return pmNode('paragraph', {}, inlineFrom(node.children, src, []));
}

function listFrom(node: List, src: string): PmNode {
  const task = node.children.some((item) => typeof item.checked === 'boolean');
  const text = sourceOf(node, src);
  const attrs: Attrs = { spread: node.spread ?? false };
  let type: string;
  if (node.ordered) {
    attrs.start = node.start ?? 1;
    attrs.delimiter = /^\s*\d+([.)])/.exec(text)?.[1] ?? '.';
    type = 'orderedList';
  } else {
    attrs.bullet = /^\s*([-*+])/.exec(text)?.[1] ?? '-';
    type = 'bulletList';
  }
  if (task) {
    attrs.ordered = node.ordered ?? false;
    type = 'taskList';
  }
  const items = node.children.map((item: ListItem) =>
    pmNode(
      task ? 'taskItem' : 'listItem',
      {
        ...(task ? { checked: item.checked === true } : {}),
        spread: item.spread ?? false,
      },
      childBlocks(item.children, src),
    ),
  );
  return pmNode(type, attrs, items);
}

function tableFrom(node: Table, src: string): PmNode {
  const rows = node.children.map((row: TableRow, index) =>
    pmNode(
      'tableRow',
      {},
      row.children.map((cell: TableCell) =>
        pmNode(index === 0 ? 'tableHeader' : 'tableCell', {}, [
          pmNode('paragraph', {}, inlineFrom(cell.children, src, [])),
        ]),
      ),
    ),
  );
  return pmNode('table', { align: node.align ?? [] }, rows);
}

/** Convert phrasing content, flattening nested marks onto text nodes. */
function inlineFrom(nodes: readonly PhrasingContent[], src: string, marks: PmMark[]): PmNode[] {
  const out: PmNode[] = [];
  const push = (node: PmNode) => {
    if (marks.length > 0) node.marks = [...marks];
    out.push(node);
  };
  for (const node of nodes) {
    const text = sourceOf(node, src);
    switch (node.type) {
      case 'text':
        if (node.value) push({ type: 'text', text: node.value });
        break;
      case 'emphasis':
        out.push(...inlineFrom(node.children, src, [...marks, styled('italic', text, '_')]));
        break;
      case 'strong':
        out.push(...inlineFrom(node.children, src, [...marks, styled('bold', text, '__')]));
        break;
      case 'delete':
        out.push(...inlineFrom(node.children, src, [...marks, { type: 'strike' }]));
        break;
      case 'inlineCode':
        out.push({ type: 'text', text: node.value, marks: [...marks, { type: 'code' }] });
        break;
      case 'link':
        out.push(...inlineFrom(node.children, src, [...marks, linkMark(node, text)]));
        break;
      case 'break':
        push(pmNode('hardBreak', text && !text.startsWith('\\') ? { spaces: true } : {}));
        break;
      case 'html':
        push(pmNode('rawInline', { markdown: node.value }));
        break;
      case 'inlineMath':
        if (isProse(text, src, node.position?.end.offset)) {
          push({ type: 'text', text });
        } else {
          push(pmNode('inlineMath', { content: node.value }));
        }
        break;
      case 'footnoteReference':
        push(
          pmNode('footnoteReference', {
            identifier: node.identifier,
            label: node.label ?? node.identifier,
          }),
        );
        break;
      default:
        // Images inside text, link references.
        push(pmNode('rawInline', { markdown: text }));
    }
  }
  return mergeText(out);
}

/**
 * Whether `$..$` is prose with dollar signs (`$5 and $10`), not math. remark
 * reads any pair of single dollars as math; like Pandoc, Cept keeps them as
 * text when the math would start or end with whitespace or the closing dollar
 * is followed by a digit. Written back, such dollars are escaped (`\$`).
 */
function isProse(text: string, src: string, end: number | undefined): boolean {
  if (!text.startsWith('$') || text.startsWith('$$')) return false;
  if (/^\$\s|\s\$$/.test(text)) return true;
  return end !== undefined && /[0-9]/.test(src.charAt(end));
}

function styled(type: string, text: string, alternate: string): PmMark {
  return text.startsWith(alternate[0]!) ? { type, attrs: { marker: alternate } } : { type };
}

function linkMark(node: Link, text: string): PmMark {
  const attrs: Attrs = { href: node.url, title: node.title ?? null };
  if (text.startsWith('<')) attrs.autolink = 'angle';
  else if (text && !text.startsWith('[')) attrs.autolink = 'literal';
  return { type: 'link', attrs };
}

function sameMark(a: PmMark, b: PmMark): boolean {
  return a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});
}

function sameMarks(a: readonly PmMark[] = [], b: readonly PmMark[] = []): boolean {
  return a.length === b.length && a.every((mark, i) => sameMark(mark, b[i]!));
}

/** Merge adjacent text nodes with the same marks, as ProseMirror does. */
function mergeText(nodes: PmNode[]): PmNode[] {
  const out: PmNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === 'text' && last?.type === 'text' && sameMarks(last.marks, node.marks)) {
      last.text = `${last.text ?? ''}${node.text ?? ''}`;
    } else {
      if (node.marks?.length === 0) delete node.marks;
      out.push(node);
    }
  }
  return out;
}

// ---------------------------------------------------------------- PM -> mdast

/** Markdown style kept on mdast nodes for the serializer's handlers. */
export interface CeptStyle {
  marker?: string;
  fence?: string | null;
  bullet?: string;
  delimiter?: string;
  setext?: boolean;
  autolink?: string;
  spaces?: boolean;
}

function withStyle<T extends Nodes>(node: T, style: CeptStyle): T {
  const defined = Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined));
  if (Object.keys(defined).length > 0) node.data = { ...node.data, cept: defined } as T['data'];
  return node;
}

/** The Markdown style a serializer handler should use for a node. */
export function styleOf(node: Nodes): CeptStyle {
  return ((node.data as { cept?: CeptStyle } | undefined)?.cept ?? {}) as CeptStyle;
}

const attr = <T>(node: PmNode, key: string): T | undefined => node.attrs?.[key] as T | undefined;

/** Convert ProseMirror block nodes back to mdast. */
export function blocksToMdast(nodes: readonly PmNode[]): RootContent[] {
  return nodes.flatMap((node) => blockTo(node));
}

function blockTo(node: PmNode): RootContent[] {
  const content = node.content ?? [];
  const custom = htmlBlockTo(node, blocksToMdast);
  if (custom) return custom;
  switch (node.type) {
    case 'paragraph':
      return [{ type: 'paragraph', children: inlineTo(content) }];
    case 'heading':
      return [
        withStyle<Heading>(
          {
            type: 'heading',
            depth: Math.min(Math.max(attr<number>(node, 'level') ?? 1, 1), 6) as Heading['depth'],
            children: inlineTo(content),
          },
          { setext: attr<boolean>(node, 'setext') },
        ),
      ];
    case 'horizontalRule':
      return [
        withStyle<ThematicBreak>({ type: 'thematicBreak' }, { marker: attr(node, 'marker') }),
      ];
    case 'blockquote':
      return [{ type: 'blockquote', children: blocksToMdast(content) as BlockContent[] }];
    case 'codeBlock':
      return [
        withStyle<Code>(
          {
            type: 'code',
            lang: attr<string>(node, 'language') ?? null,
            meta: attr<string>(node, 'meta') ?? null,
            value: content.map((child) => child.text ?? '').join(''),
          },
          { fence: attr<string | null>(node, 'fence') },
        ),
      ];
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return [listTo(node)];
    case 'table':
      return [tableTo(node)];
    case 'imageBlock':
      return [
        {
          type: 'paragraph',
          children: [
            {
              type: 'image',
              url: attr<string>(node, 'src') ?? '',
              alt: attr<string>(node, 'alt') ?? '',
              title: attr<string>(node, 'title') ?? null,
            },
          ],
        },
      ];
    case 'rawBlock':
      return [{ type: 'html', value: attr<string>(node, 'markdown') ?? '' }];
    case 'mathBlock':
      return [
        {
          type: 'math',
          value: attr<string>(node, 'content') ?? '',
          meta: attr(node, 'meta') ?? null,
        },
      ];
    case 'footnoteDefinition':
      return [footnoteDefinitionTo(node)];
    default:
      // A node type the bridge does not know: keep its content. Inline
      // children held directly are wrapped in paragraphs so they are not lost.
      return blocksToMdast(wrapInline(content));
  }
}

const INLINE_TYPES = new Set(['text', 'hardBreak', 'rawInline', 'inlineMath', 'footnoteReference']);

function footnoteDefinitionTo(node: PmNode): FootnoteDefinition {
  const label = attr<string>(node, 'label') ?? attr<string>(node, 'identifier') ?? '';
  return {
    type: 'footnoteDefinition',
    identifier: attr<string>(node, 'identifier') ?? label.toLowerCase(),
    label,
    children: blocksToMdast(node.content ?? []) as (BlockContent | DefinitionContent)[],
  };
}

/** Group runs of inline nodes into paragraphs, leaving block nodes as they are. */
function wrapInline(nodes: readonly PmNode[]): PmNode[] {
  const out: PmNode[] = [];
  let run: PmNode[] | undefined;
  for (const node of nodes) {
    if (!INLINE_TYPES.has(node.type)) {
      run = undefined;
      out.push(node);
    } else if (run) {
      run.push(node);
    } else {
      run = [node];
      out.push({ type: 'paragraph', content: run });
    }
  }
  return out;
}

function listTo(node: PmNode): List {
  const ordered = node.type === 'orderedList' || attr<boolean>(node, 'ordered') === true;
  const task = node.type === 'taskList';
  const list: List = {
    type: 'list',
    ordered,
    start: ordered ? (attr<number>(node, 'start') ?? 1) : null,
    spread: attr<boolean>(node, 'spread') ?? false,
    children: (node.content ?? []).map((item): ListItem => ({
      type: 'listItem',
      spread: attr<boolean>(item, 'spread') ?? false,
      checked: task ? attr<boolean>(item, 'checked') === true : null,
      children: blocksToMdast(item.content ?? []) as (BlockContent | DefinitionContent)[],
    })),
  };
  return withStyle(list, {
    bullet: attr(node, 'bullet'),
    delimiter: attr(node, 'delimiter'),
  });
}

function tableTo(node: PmNode): Table {
  return {
    type: 'table',
    align: attr<Table['align']>(node, 'align') ?? [],
    children: (node.content ?? []).map((row): TableRow => ({
      type: 'tableRow',
      children: (row.content ?? []).map((cell): TableCell => ({
        type: 'tableCell',
        // A cell is one line in GFM: join its paragraphs with spaces.
        children: inlineTo(
          (cell.content ?? []).flatMap((block, i) => [
            ...(i > 0 ? [{ type: 'text', text: ' ' }] : []),
            ...(block.content ?? []),
          ]),
        ),
      })),
    })),
  };
}

/**
 * The marks the bridge writes, outermost first; `code` is handled separately.
 * This is an allowlist: any other mark (highlight, underline, ...) is dropped
 * on save until it is added here or kept as `rawInline`.
 */
const MARK_ORDER = ['link', 'bold', 'italic', 'strike'];

function markRank(mark: PmMark): number {
  const rank = MARK_ORDER.indexOf(mark.type);
  return rank === -1 ? MARK_ORDER.length : rank;
}

function markTo(mark: PmMark): PhrasingContent & Parents {
  const marker = mark.attrs?.marker as string | undefined;
  switch (mark.type) {
    case 'link':
      return withStyle<Link>(
        {
          type: 'link',
          url: String(mark.attrs?.href ?? ''),
          title: (mark.attrs?.title as string | null | undefined) ?? null,
          children: [],
        },
        { autolink: mark.attrs?.autolink as string | undefined },
      );
    case 'bold':
      return withStyle({ type: 'strong', children: [] }, { marker });
    case 'italic':
      return withStyle({ type: 'emphasis', children: [] }, { marker });
    default:
      return { type: 'delete', children: [] };
  }
}

/** Rebuild nested phrasing content from text nodes carrying flat marks. */
function inlineTo(nodes: readonly PmNode[]): PhrasingContent[] {
  const root: PhrasingContent[] = [];
  const open: { mark: PmMark; node: PhrasingContent & Parents }[] = [];
  for (const node of nodes) {
    const marks = (node.marks ?? [])
      .filter((mark) => mark.type !== 'code' && markRank(mark) < MARK_ORDER.length)
      .sort((a, b) => markRank(a) - markRank(b));
    let keep = 0;
    while (keep < open.length && keep < marks.length && sameMark(open[keep]!.mark, marks[keep]!)) {
      keep++;
    }
    open.length = keep;
    for (const mark of marks.slice(keep)) {
      const parent = open[open.length - 1]?.node.children ?? root;
      const created = markTo(mark);
      (parent as PhrasingContent[]).push(created);
      open.push({ mark, node: created });
    }
    const parent = (open[open.length - 1]?.node.children ?? root) as PhrasingContent[];
    const code = node.marks?.some((mark) => mark.type === 'code') ?? false;
    switch (node.type) {
      case 'text':
        parent.push(
          code
            ? { type: 'inlineCode', value: node.text ?? '' }
            : { type: 'text', value: node.text ?? '' },
        );
        break;
      case 'hardBreak':
        parent.push(withStyle({ type: 'break' }, { spaces: attr<boolean>(node, 'spaces') }));
        break;
      case 'rawInline':
        parent.push({ type: 'html', value: attr<string>(node, 'markdown') ?? '' });
        break;
      case 'inlineMath':
        parent.push({ type: 'inlineMath', value: attr<string>(node, 'content') ?? '' });
        break;
      case 'footnoteReference': {
        const label = attr<string>(node, 'label') ?? attr<string>(node, 'identifier') ?? '';
        parent.push({
          type: 'footnoteReference',
          identifier: attr<string>(node, 'identifier') ?? label.toLowerCase(),
          label,
        });
        break;
      }
      default:
        parent.push(...inlineTo(node.content ?? []));
    }
  }
  return root;
}
