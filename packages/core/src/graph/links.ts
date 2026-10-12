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
import { joinPath, parentFolder, splitPath } from '../space/path.js';
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

/** The destination of a link, image or reference definition, as written in the page. */
export interface Destination {
  /** The URL as written. */
  url: string;
  /** Offsets of the URL in the page text, front matter included (excluding `<>` and the title). */
  start: number;
  end: number;
}

/** The offset of `url` where the destination of `source` begins after `from`, or -1. */
function destinationOffset(source: string, from: number, url: string, opener: string): number {
  for (let at = source.indexOf(opener, from); at !== -1; at = source.indexOf(opener, at + 1)) {
    let pos = at + opener.length;
    while (/\s/.test(source[pos] ?? '')) pos++;
    if (source[pos] === '<') pos++;
    if (source.startsWith(url, pos)) return pos;
  }
  return -1;
}

/**
 * Where the URL of every inline link, inline image and reference definition is
 * written, in document order (PR 55 rewrites these when a page moves). Unlike
 * {@link extractLinks} this includes images, and a reference link is covered by
 * its definition. A destination whose source text differs from its URL (it has
 * escapes or entities) is left out, so a rewrite never edits what it cannot
 * locate exactly.
 */
export function extractDestinations(markdown: string): Destination[] {
  const prefix = frontMatterPrefix(markdown);
  const tree = parser.parse(markdown.slice(prefix.length));
  const out: Destination[] = [];
  const visit = (node: Nodes): void => {
    // Children first: an image inside a link is written before the link's URL.
    if ('children' in node) node.children.forEach(visit);
    if (
      (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
      node.position
    ) {
      const from = node.position.start.offset!;
      const source = markdown.slice(
        prefix.length + from,
        prefix.length + node.position.end.offset!,
      );
      let search = 0;
      if (node.type === 'link' && node.children.length > 0)
        search = (node.children.at(-1)!.position?.end.offset ?? from) - from;
      const at = destinationOffset(
        source,
        search,
        node.url,
        node.type === 'definition' ? ']:' : '](',
      );
      if (at !== -1)
        out.push({
          url: node.url,
          start: prefix.length + from + at,
          end: prefix.length + from + at + node.url.length,
        });
    }
  };
  visit(tree);
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Where a link points inside the space. */
export interface ResolvedLink {
  /** The target page file, relative to the space root (the linking page itself for `#anchor`). */
  path: string;
  /** The heading anchor after `#`, decoded, or undefined. */
  anchor?: string;
}

export const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Resolve `url` written in the file at `from` (a path relative to the space
 * root) to the path it points at, whatever the target is: a page, an image, a
 * folder. Returns null for URLs with a scheme (`https:`, `mailto:`),
 * protocol-relative URLs, paths that leave the space root, and an empty URL. A
 * leading `/` is relative to the space root. The query string is ignored and
 * the path and anchor are percent-decoded.
 */
export function resolvePath(from: string, url: string): ResolvedLink | null {
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
    if (segment === '.') continue;
    if (segment !== '..') segments.push(segment);
    else if (segments.length === 0) return null;
    else segments.pop();
  }
  const path = segments.join('/');
  return anchor === undefined ? { path } : { path, anchor };
}

/**
 * Resolve a link `url` written in the page at `from` to a page file. Like
 * {@link resolvePath}, but also null for targets that are not `.md` or
 * `.markdown` files. A link is always to a file: a folder page is linked by
 * its index file (`guides/index.md`); a link to the bare folder is resolved
 * against the page tree by {@link pageIdForPath}.
 */
export function resolveLink(from: string, url: string): ResolvedLink | null {
  const resolved = resolvePath(from, url);
  if (!resolved) return null;
  return isPageFile(splitPath(resolved.path).at(-1) ?? '') ? resolved : null;
}

/**
 * The file a page's relative links are written against: the file itself for a
 * file page, a stand-in `index.md` inside the folder for a folder page.
 */
export function baseFileOfPage(id: string): string {
  return isPageFile(splitPath(id).at(-1) ?? '') ? id : joinPath(id, 'index.md');
}

const FOLDER_PAGE_FILE = /^(index|readme)\.(md|markdown)$/i;

/**
 * The id of the page a resolved path stands for, or null when there is none:
 * a file page by its file, a folder page by its folder or by its `index.md` /
 * `README.md`. `hasPage` says whether an id exists in the space.
 */
export function pageIdForPath(path: string, hasPage: (id: string) => boolean): string | null {
  if (path !== '' && hasPage(path)) return path;
  const folder = parentFolder(path);
  const name = splitPath(path).at(-1) ?? '';
  if (folder !== null && folder !== '' && FOLDER_PAGE_FILE.test(name) && hasPage(folder))
    return folder;
  return null;
}

/**
 * GitHub's heading slugs for a page's headings, in order: lowercase, punctuation
 * removed, spaces to `-`, and `-1`, `-2` for repeats.
 */
export function headingSlugs(headings: readonly string[]): string[] {
  const used = new Set<string>();
  return headings.map((heading) => {
    const base = heading
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
      .replace(/ /g, '-');
    let slug = base;
    for (let n = 1; used.has(slug); n++) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
}
