/**
 * Links between pages (REQ-EDT-018, D-32; phase-1 plan PR 53).
 *
 * Pages link to each other with standard relative Markdown links, the form
 * GitHub and other Markdown tools also follow: `[Setup](../guides/setup.md)`,
 * `[Install](setup.md#install)` or `[Below](#below)`. There is no wiki-link
 * syntax. `extractLinks` finds every link in a page with remark, so links in
 * code spans, code blocks and math are not links, and reference-style links
 * (`[Setup][s]` with `[s]: setup.md`) resolve through their definitions.
 * `resolveLink` turns a link's URL into a page path relative to the space root.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { Definition, Nodes } from 'mdast';
import { frontMatterPrefix } from '../markdown/front-matter.js';
import { parentFolder, splitPath } from '../space/path.js';
import { isPageFile } from '../space/tree.js';

/** A link found in a page. */
export interface ExtractedLink {
  /** The URL as written (for a reference link, its definition's URL). */
  url: string;
  /** The link's plain text. */
  text: string;
  /** Offsets of the whole link in the page text, front matter included. */
  start: number;
  end: number;
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

function plainText(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node) return node.children.map((child) => plainText(child)).join('');
  return '';
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Every link in a page, in document order. Links in the front matter are not
 * read. Images are not links (they are assets, PR 54), and neither is inline
 * HTML such as `<a href>`.
 */
export function extractLinks(markdown: string): ExtractedLink[] {
  const prefix = frontMatterPrefix(markdown);
  const tree = parser.parse(markdown.slice(prefix.length));

  const definitions = new Map<string, Definition>();
  const collect = (node: Nodes): void => {
    if (node.type === 'definition') {
      const key = normalizeLabel(node.label ?? node.identifier);
      // The first definition of a label wins (CommonMark).
      if (!definitions.has(key)) definitions.set(key, node);
    }
    if ('children' in node) node.children.forEach(collect);
  };
  collect(tree);

  const links: ExtractedLink[] = [];
  const visit = (node: Nodes): void => {
    let url: string | undefined;
    if (node.type === 'link') url = node.url;
    else if (node.type === 'linkReference')
      url = definitions.get(normalizeLabel(node.label ?? node.identifier))?.url;
    if (url !== undefined && node.position) {
      links.push({
        url,
        text: plainText(node),
        start: prefix.length + node.position.start.offset!,
        end: prefix.length + node.position.end.offset!,
      });
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  };
  visit(tree);
  return links;
}

/** Where a link points inside the space. */
export interface ResolvedLink {
  /** The target page file, relative to the space root (the linking page itself for `#anchor`). */
  path: string;
  /** The heading anchor after `#`, decoded, or undefined. */
  anchor?: string;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Resolve a link `url` written in the page at `from` (a page file path
 * relative to the space root). Returns null for links that are not to a page
 * in the space: URLs with a scheme (`https:`, `mailto:`), protocol-relative
 * URLs, paths that leave the space root, and targets that are not `.md` or
 * `.markdown` files. A link is always to a file: a folder page is linked by
 * its index file (`guides/index.md`), not by the bare folder (`guides/`),
 * which needs a backend lookup to resolve and is a known limitation. A leading `/` is relative to the space root. The query
 * string is ignored and the path and anchor are percent-decoded.
 */
export function resolveLink(from: string, url: string): ResolvedLink | null {
  const trimmed = url.trim();
  if (trimmed === '' || SCHEME.test(trimmed) || trimmed.startsWith('//')) return null;

  const hash = trimmed.indexOf('#');
  const beforeHash = hash === -1 ? trimmed : trimmed.slice(0, hash);
  const anchorText = hash === -1 ? '' : decode(trimmed.slice(hash + 1));
  const anchor = anchorText === '' ? undefined : anchorText;
  const query = beforeHash.indexOf('?');
  const pathPart = decode(query === -1 ? beforeHash : beforeHash.slice(0, query));

  if (pathPart === '') return anchor === undefined ? null : { path: from, anchor };

  const base = pathPart.startsWith('/') ? [] : splitPath(parentFolder(from) ?? '');
  const segments = [...base];
  for (const segment of splitPath(pathPart)) {
    if (segment !== '..') segments.push(segment);
    else if (segments.length === 0) return null;
    else segments.pop();
  }
  const path = segments.join('/');
  if (!isPageFile(segments.at(-1) ?? '')) return null;
  return anchor === undefined ? { path } : { path, anchor };
}
