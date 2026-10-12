/**
 * Cept's custom blocks in Markdown files (phase-1 plan PR 48, EDT-005, EDT-024).
 *
 * Toggles, callouts and columns are containers. Cept writes them as an HTML
 * opening tag, the body as Markdown, and the closing tag, each separated by a
 * blank line so GitHub renders the body as Markdown:
 *
 *     <details open>
 *     <summary>Summary</summary>
 *
 *     Body **Markdown**.
 *
 *     </details>
 *
 * remark parses that as sibling nodes (an `html` node per tag group, then the
 * body blocks), so `structuralTokens` recognises tag-only `html` nodes and the
 * bridge regroups the siblings between an opening and a closing tag. A
 * container written on one line in HTML (as the editor used to save it) is a
 * single `html` node; `elementBlock` converts it, body included.
 *
 * Embeds, bookmarks and captioned images are atoms written as one HTML element
 * whose `data-*` attributes hold the node's attributes. Any other HTML is kept
 * verbatim as a `rawBlock`.
 */

import type { Element, ElementContent, Properties, Root as HastRoot } from 'hast';
import type { Html, RootContent } from 'mdast';
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import type { PmNode } from './prosemirror.js';

type Attrs = Record<string, unknown>;

/** Convert mdast blocks that have no source text (positions removed). */
export type ConvertBlocks = (nodes: RootContent[]) => PmNode[];

/** An opening or closing tag of a container, found in a tag-only `html` node. */
export type StructuralToken =
  | { kind: 'open'; tag: string; attrs: Properties; summary?: string; offset: number; text: string }
  | { kind: 'close'; tag: string; offset: number; text: string };

const ATTRIBUTE = String.raw`\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?`;
const TOKEN = new RegExp(
  String.raw`\s*(?:<(div|details)((?:${ATTRIBUTE})*)\s*>(?:\s*<summary>([^<]*)</summary>)?|</(div|details)\s*>)`,
  'iy',
);

/** The properties of an opening tag, parsed as HTML. */
function tagProperties(tag: string, attrs: string): Properties {
  const tree = fromHtml(`<${tag}${attrs}></${tag}>`, { fragment: true });
  const element = tree.children[0];
  return element?.type === 'element' ? element.properties : {};
}

/** The text of an HTML fragment that has no tags, with entities decoded. */
function decodeText(html: string): string {
  const tree = fromHtml(html, { fragment: true });
  return tree.children.map((node) => (node.type === 'text' ? node.value : '')).join('');
}

/**
 * Split an `html` node made only of container tags (`<div ...>`, `</div>`,
 * `<details>` with its `<summary>`, `</details>`) into tokens. Returns null
 * when it holds anything else.
 */
export function structuralTokens(value: string): StructuralToken[] | null {
  const tokens: StructuralToken[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < value.length) {
    const from = TOKEN.lastIndex;
    const match = TOKEN.exec(value);
    if (!match) return /^\s*$/.test(value.slice(from)) && tokens.length > 0 ? tokens : null;
    const text = match[0].trimStart();
    const offset = from + match[0].length - text.length;
    const [, openTag, attrs, summary, closeTag] = match;
    if (openTag) {
      const tag = openTag.toLowerCase();
      tokens.push({
        kind: 'open',
        tag,
        attrs: tagProperties(tag, attrs ?? ''),
        ...(summary !== undefined ? { summary: decodeText(summary) } : {}),
        offset,
        text,
      });
    } else {
      tokens.push({ kind: 'close', tag: closeTag!.toLowerCase(), offset, text });
    }
  }
  return tokens.length > 0 ? tokens : null;
}

/** The node an opening tag starts, or null for a container Cept does not model. */
export function containerOf(token: StructuralToken & { kind: 'open' }): PmNode | null {
  const type = token.attrs.dataType;
  if (token.tag === 'details' && token.summary !== undefined) {
    return { type: 'toggle', attrs: { summary: token.summary, open: token.attrs.open === true } };
  }
  if (token.tag !== 'div') return null;
  if (type === 'callout') return { type: 'callout', attrs: calloutAttrs(token.attrs) };
  if (type === 'columns') return { type: 'columns' };
  if (type === 'column') return { type: 'column' };
  return null;
}

function calloutAttrs(props: Properties): Attrs {
  return {
    icon: String(props.dataIcon ?? '\u{1F4A1}'),
    color: String(props.dataColor ?? 'default'),
  };
}

// ------------------------------------------------------------ HTML elements

function stripPositions<T>(node: T): T {
  if (node && typeof node === 'object') {
    delete (node as { position?: unknown }).position;
    const children = (node as { children?: unknown[] }).children;
    children?.forEach(stripPositions);
  }
  return node;
}

const isElement = (node: ElementContent): node is Element => node.type === 'element';
const blankText = (node: ElementContent) => node.type === 'text' && node.value.trim() === '';

function hasClass(node: ElementContent, name: string): boolean {
  const classes = isElement(node) ? node.properties.className : undefined;
  return Array.isArray(classes) && classes.includes(name);
}

/**
 * The body of a container as the editor rendered it to HTML: the callout's
 * icon span is dropped and the `cept-*-content` wrapper is unwrapped.
 */
function editorBody(children: ElementContent[]): ElementContent[] {
  return children.flatMap((node) => {
    if (hasClass(node, 'cept-callout-icon')) return [];
    if (hasClass(node, 'cept-callout-content') || hasClass(node, 'cept-toggle-content')) {
      return (node as Element).children;
    }
    return [node];
  });
}

/** Body blocks from HTML children, modelling Cept elements nested in them. */
function blocksFromHtml(children: ElementContent[], convert: ConvertBlocks): PmNode[] {
  const out: PmNode[] = [];
  let run: ElementContent[] = [];
  const flush = () => {
    if (run.some((node) => !blankText(node))) {
      const root: HastRoot = { type: 'root', children: run };
      const mdast = stripPositions(toMdast(root));
      out.push(...convert(mdast.type === 'root' ? mdast.children : []));
    }
    run = [];
  };
  for (const child of children) {
    const block = isElement(child) ? ceptElement(child, convert) : null;
    if (block) {
      flush();
      out.push(block);
    } else {
      run.push(child);
    }
  }
  flush();
  return out.length > 0 ? out : [{ type: 'paragraph' }];
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  return isElement(node) ? node.children.map(textOf).join('') : '';
}

const str = (value: unknown, fallback = ''): string =>
  value === undefined || value === null ? fallback : String(value);

/** A Cept element as an editor node, or null for any other element. */
function ceptElement(element: Element, convert: ConvertBlocks): PmNode | null {
  const props = element.properties;
  const type = props.dataType;
  switch (element.tagName) {
    case 'details': {
      const [first, ...rest] = element.children.filter((node) => !blankText(node));
      if (!first || !isElement(first) || first.tagName !== 'summary') return null;
      return {
        type: 'toggle',
        attrs: { summary: textOf(first), open: props.open === true },
        content: blocksFromHtml(editorBody(rest), convert),
      };
    }
    case 'div':
      if (type === 'callout') {
        return {
          type: 'callout',
          attrs: calloutAttrs(props),
          content: blocksFromHtml(editorBody(element.children), convert),
        };
      }
      if (type === 'columns') {
        const columns = element.children.filter((node) => !blankText(node));
        const ok = columns.length >= 2 && columns.every(isColumn);
        if (!ok) return null;
        return {
          type: 'columns',
          content: (columns as Element[]).map((column) => ({
            type: 'column',
            content: blocksFromHtml(column.children, convert),
          })),
        };
      }
      return null;
    case 'figure':
      if (type === 'embed') {
        return {
          type: 'embed',
          attrs: {
            src: str(props.dataSrc) || null,
            provider: str(props.dataProvider, 'generic'),
            width: str(props.dataWidth, '100%'),
            height: str(props.dataHeight, '400px'),
          },
        };
      }
      if (type === 'image') return imageElement(element);
      return null;
    case 'aside':
      if (type !== 'bookmark') return null;
      return {
        type: 'bookmark',
        attrs: {
          url: str(props.dataUrl) || null,
          title: str(props.dataTitle),
          description: str(props.dataDescription),
          favicon: str(props.dataFavicon),
          image: str(props.dataImage),
        },
      };
    default:
      return null;
  }
}

function isColumn(node: ElementContent): boolean {
  return isElement(node) && node.tagName === 'div' && node.properties.dataType === 'column';
}

function imageElement(element: Element): PmNode {
  const props = element.properties;
  const img = element.children.find((node) => isElement(node) && node.tagName === 'img');
  const caption = element.children.find((node) => isElement(node) && node.tagName === 'figcaption');
  const imgProps = img && isElement(img) ? img.properties : {};
  const width = str(props.dataWidth);
  return {
    type: 'imageBlock',
    attrs: {
      src: str(imgProps.src ?? props.dataSrc),
      alt: str(imgProps.alt ?? props.dataAlt),
      title: null,
      ...(caption ? { caption: textOf(caption) } : {}),
      ...(width ? { width } : {}),
    },
  };
}

/**
 * The editor node for an `html` node that is exactly one Cept element (a
 * container written on one line, an embed, a bookmark, a captioned image), or
 * null for any other HTML.
 */
export function elementBlock(html: string, convert: ConvertBlocks): PmNode | null {
  const tree = fromHtml(html, { fragment: true });
  const elements = tree.children.filter((node) => !(node.type === 'text' && !node.value.trim()));
  const [element] = elements;
  if (elements.length !== 1 || element?.type !== 'element') return null;
  // The parser closes unclosed tags; only a complete element is one block.
  if (!new RegExp(`</${element.tagName}\\s*>\\s*$`, 'i').test(html)) return null;
  return ceptElement(element, convert);
}

// ------------------------------------------------------------ editor -> Markdown

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function attributes(entries: [string, unknown][]): string {
  return entries
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value]) => ` ${name}="${escapeAttr(String(value))}"`)
    .join('');
}

const html = (value: string): Html => ({ type: 'html', value });
const attr = (node: PmNode, key: string): unknown => node.attrs?.[key];

/**
 * Write a Cept block as Markdown (HTML tags around Markdown bodies), or null
 * for a node that is not one. `convert` writes body blocks.
 */
export function htmlBlockTo(
  node: PmNode,
  convert: (nodes: readonly PmNode[]) => RootContent[],
): RootContent[] | null {
  const body = () => convert(node.content ?? []);
  switch (node.type) {
    case 'toggle':
      return [
        html(
          `<details${attr(node, 'open') === true ? ' open' : ''}>\n<summary>${escapeText(
            str(attr(node, 'summary')),
          )}</summary>`,
        ),
        ...body(),
        html('</details>'),
      ];
    case 'callout':
      return [
        html(
          `<div${attributes([
            ['data-type', 'callout'],
            ['data-icon', attr(node, 'icon') ?? '\u{1F4A1}'],
            ['data-color', attr(node, 'color') ?? 'default'],
          ])}>`,
        ),
        ...body(),
        html('</div>'),
      ];
    case 'columns':
      return [
        html('<div data-type="columns">'),
        ...(node.content ?? []).flatMap((column) => [
          html('<div data-type="column">'),
          ...convert(column.content ?? []),
          html('</div>'),
        ]),
        html('</div>'),
      ];
    case 'embed': {
      const src = str(attr(node, 'src'));
      return [
        html(
          `<figure${attributes([
            ['data-type', 'embed'],
            ['data-provider', attr(node, 'provider') ?? 'generic'],
            ['data-src', src],
            ['data-width', attr(node, 'width') ?? '100%'],
            ['data-height', attr(node, 'height') ?? '400px'],
          ])}><a href="${escapeAttr(src)}">${escapeText(src)}</a></figure>`,
        ),
      ];
    }
    case 'bookmark': {
      const url = str(attr(node, 'url'));
      const title = str(attr(node, 'title'));
      return [
        html(
          `<aside${attributes([
            ['data-type', 'bookmark'],
            ['data-url', url],
            ['data-title', title],
            ['data-description', attr(node, 'description') ?? ''],
            ['data-favicon', attr(node, 'favicon') ?? ''],
            ['data-image', attr(node, 'image') ?? ''],
          ])}><a href="${escapeAttr(url)}">${escapeText(title || url)}</a></aside>`,
        ),
      ];
    }
    case 'imageBlock': {
      const caption = attr(node, 'caption');
      const width = attr(node, 'width');
      if (!caption && !width) return null;
      const img = `<img${attributes([
        ['src', str(attr(node, 'src'))],
        ['alt', str(attr(node, 'alt'))],
      ])}>`;
      const figcaption = caption ? `<figcaption>${escapeText(str(caption))}</figcaption>` : '';
      return [
        html(
          `<figure${attributes([
            ['data-type', 'image'],
            ['data-width', width || null],
          ])}>${img}${figcaption}</figure>`,
        ),
      ];
    }
    default:
      return null;
  }
}
