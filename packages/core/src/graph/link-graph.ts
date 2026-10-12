/**
 * Build the link graph of a space (REQ-EDT-018, REQ-EDT-020, D-32, D-41;
 * phase-1 plan PR 53).
 *
 * One pass over the pages extracts their links (`links.ts`) and gives:
 *
 * - **references**: every link from one page to another, with its text and
 *   offsets. Backlinks (PR 56) and inbound-link rewriting (PR 55) read these.
 * - **graph**: one node per page and one `link` edge per linked pair, plus an
 *   `unresolved` node for each dead link target.
 *
 * Hidden paths never appear (D-41): pages hidden by default (dotfiles, `.git/`,
 * `.cept/`) or by an `ignore:` list are not read, and a link to one is dropped
 * rather than shown as dead. Links to a heading in the same page are not
 * edges.
 */

import type { StorageBackend } from '../storage/backend.js';
import { readFrontMatter, splitFrontMatter, pageTitle } from '../markdown/front-matter.js';
import { isDefaultHidden } from '../space/config.js';
import { joinPath, splitPath, toBackendPath } from '../space/path.js';
import { readSpaceTree, readPageText, type PageNode } from '../space/tree.js';
import { extractLinks, resolveLink } from './links.js';
import type { GraphData, GraphLink, GraphNode } from './model.js';

/** A page to index. */
export interface LinkGraphPage {
  /** The page id (see `space/tree.ts`): `a/b.md` for a file page, `a` for a folder page. */
  id: string;
  /** The file holding the page, relative to the space root (`a/index.md` for folder page `a`). */
  file: string;
  /** The page text, front matter included. */
  markdown: string;
  /** The display title; defaults to `pageTitle` of the text. */
  title?: string;
}

/** One link from a page to another page. */
export interface PageReference {
  /** The linking page's id. */
  source: string;
  /** The linked page's id, or for a dead link the target file path. */
  target: string;
  /** The heading anchor, if the link has one. */
  anchor?: string;
  /** The URL as written. */
  url: string;
  /** The link text. */
  text: string;
  /** Offsets of the link in the source page's text. */
  start: number;
  end: number;
  /** True when the target page does not exist. */
  unresolved?: boolean;
}

export interface LinkGraph {
  graph: GraphData;
  references: PageReference[];
}

export interface LinkGraphOptions {
  /**
   * Whether a path (relative to the space root) is hidden. Links to hidden
   * paths are dropped. Defaults to {@link isDefaultHidden}; `readLinkGraph`
   * also hides files the space's `ignore:` lists leave out.
   */
  isHidden?: (path: string) => boolean;
}

function titleOf(page: LinkGraphPage): string {
  if (page.title !== undefined) return page.title;
  const split = splitFrontMatter(page.markdown);
  return pageTitle(readFrontMatter(split.yaml), split.body, page.file);
}

function groupOf(id: string): string | undefined {
  const segments = splitPath(id);
  return segments.length > 1 ? segments[0] : undefined;
}

/** Build the link graph of a set of pages (the visible pages of one space). */
export function buildLinkGraph(
  pages: readonly LinkGraphPage[],
  options: LinkGraphOptions = {},
): LinkGraph {
  const isHidden = options.isHidden ?? isDefaultHidden;
  const idByFile = new Map(pages.map((page) => [page.file, page.id]));

  const nodes: GraphNode[] = pages.map((page) => {
    const group = groupOf(page.id);
    return { id: page.id, title: titleOf(page), ...(group ? { group } : {}) };
  });
  const unresolved = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const linked = new Set<string>();
  const references: PageReference[] = [];

  for (const page of pages) {
    for (const link of extractLinks(page.markdown)) {
      const resolved = resolveLink(page.file, link.url);
      if (!resolved || resolved.path === page.file) continue;
      const existing = idByFile.get(resolved.path);
      if (existing === undefined && isHidden(resolved.path)) continue;
      const target = existing ?? resolved.path;
      references.push({
        source: page.id,
        target,
        ...(resolved.anchor !== undefined ? { anchor: resolved.anchor } : {}),
        url: link.url,
        text: link.text,
        start: link.start,
        end: link.end,
        ...(existing === undefined ? { unresolved: true } : {}),
      });
      if (existing === undefined && !unresolved.has(target)) {
        const title = splitPath(target)
          .at(-1)!
          .replace(/\.(md|markdown)$/i, '');
        unresolved.set(target, { id: target, title, unresolved: true });
      }
      const key = `${page.id}\u0000${target}`;
      if (target !== page.id && !linked.has(key)) {
        linked.add(key);
        links.push({ source: page.id, target, type: 'link' });
      }
    }
  }

  return { graph: { nodes: [...nodes, ...unresolved.values()], links }, references };
}

/** The ids of the pages that link to `id`, in first-seen order. */
export function backlinksOf(graph: LinkGraph, id: string): string[] {
  const sources: string[] = [];
  for (const ref of graph.references)
    if (ref.target === id && ref.source !== id && !sources.includes(ref.source))
      sources.push(ref.source);
  return sources;
}

/**
 * Read a space and build its link graph. Pages are the space tree's visible
 * pages; a link target that is not one of them but exists on disk is hidden
 * (ignored, a dotfile or inside a nested space) and its links are dropped,
 * while a target that does not exist is a dead link.
 */
export async function readLinkGraph(
  backend: Pick<StorageBackend, 'listDirectory' | 'readFile' | 'exists'>,
  root = '',
): Promise<LinkGraph> {
  const tree = await readSpaceTree(backend, root);
  const pages: LinkGraphPage[] = [];
  const stack: PageNode[] = [tree.root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    stack.push(...node.children);
    const markdown = await readPageText(backend, root, node);
    if (node.file !== null && markdown !== null)
      pages.push({ id: node.id, file: node.file, markdown });
  }
  pages.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const files = new Set(pages.map((page) => page.file));
  const hidden = new Set<string>();
  for (const page of pages)
    for (const link of extractLinks(page.markdown)) {
      const resolved = resolveLink(page.file, link.url);
      if (!resolved || files.has(resolved.path) || hidden.has(resolved.path)) continue;
      if (await backend.exists(toBackendPath(joinPath(root, resolved.path))))
        hidden.add(resolved.path);
    }

  return buildLinkGraph(pages, {
    isHidden: (path) => isDefaultHidden(path) || hidden.has(path),
  });
}
