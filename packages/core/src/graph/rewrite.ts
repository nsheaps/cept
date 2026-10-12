/**
 * Keep links working when pages move (REQ-EDT-018, D-32; phase-1 plan PR 55).
 *
 * Moving or renaming a page changes two things about links: links *to* it must
 * point at its new path, and the relative links *in* it (to other pages and to
 * images) must be rewritten against its new folder. `planLinkRewrites` works
 * both out from the page texts before anything moves, so the caller can show
 * the plan, write it, move the files, and undo the writes if the move fails.
 */

import { joinPath, parentFolder, splitPath } from '../space/path.js';
import { isPageFile, type Moved } from '../space/tree.js';
import { extractDestinations, resolvePath, SCHEME } from './links.js';

/**
 * Where a path (a file or a folder, relative to the space root) lives after
 * `moved`. A move reported for a page file whose new id is not a page file is a
 * file page turning into a folder page (`a/b.md` to `a/b`): the file is now
 * `a/b/index.md`.
 */
export function mapPath(path: string, moved: readonly Moved[]): string {
  let current = path;
  for (const { from, to } of moved) {
    const folderPage =
      isPageFile(splitPath(from).at(-1) ?? '') && !isPageFile(splitPath(to).at(-1) ?? '');
    if (current === from) current = folderPage ? joinPath(to, 'index.md') : to;
    else if (current.startsWith(`${from}/`)) current = to + current.slice(from.length);
  }
  return current;
}

/** The relative path from the folder `fromFolder` to `target` (both relative to the space root). */
function relativePath(fromFolder: string, target: string): string {
  const base = splitPath(fromFolder);
  const goal = splitPath(target);
  let common = 0;
  while (common < base.length && common < goal.length - 1 && base[common] === goal[common])
    common++;
  const up = base.slice(common).map(() => '..');
  const down = goal.slice(common);
  return [...up, ...down].join('/') || '.';
}

/** Escape the characters that end or confuse a Markdown link destination. */
function encodeSegment(segment: string): string {
  return segment.replace(/[ %()<>[\]]/g, (c) => encodeURIComponent(c));
}

/**
 * `text`, the page at `file` before the move, rewritten for the move: each
 * relative URL in it that resolves inside the space is pointed at the target's
 * new path, written from the page's new path `newFile`. Absolute (`/x.md`) URLs
 * stay absolute. The query and the anchor are kept as written. Returns the new
 * text and how many URLs changed.
 */
export function rewriteLinks(
  text: string,
  file: string,
  newFile: string,
  moved: readonly Moved[],
): { text: string; count: number } {
  let out = '';
  let last = 0;
  let count = 0;
  for (const { url, start, end } of extractDestinations(text)) {
    const trimmed = url.trim();
    if (
      trimmed === '' ||
      trimmed.startsWith('#') ||
      SCHEME.test(trimmed) ||
      trimmed.startsWith('//')
    )
      continue;
    const resolved = resolvePath(file, url);
    if (!resolved) continue;
    const target = mapPath(resolved.path, moved);
    if (target === resolved.path && newFile === file) continue;
    const q = url.search(/[?#]/);
    const suffix = q === -1 ? '' : url.slice(q);
    const path = trimmed.startsWith('/')
      ? `/${target}`
      : relativePath(parentFolder(newFile) ?? '', target);
    const next = path.split('/').map(encodeSegment).join('/') + suffix;
    if (next === url) continue;
    out += text.slice(last, start) + next;
    last = end;
    count++;
  }
  return { text: out + text.slice(last), count };
}

/** One page the move changes. */
export interface LinkRewrite {
  /** The page file before the move, relative to the space root. */
  file: string;
  /** The page file after the move. */
  newFile: string;
  /** The rewritten text. */
  text: string;
  /** How many URLs in it change. */
  count: number;
}

/**
 * The rewrites `moved` needs across a space. `files` maps every page file
 * (before the move) to its text. Pages with nothing to rewrite are left out.
 */
export function planLinkRewrites(
  files: ReadonlyMap<string, string>,
  moved: readonly Moved[],
): LinkRewrite[] {
  const plan: LinkRewrite[] = [];
  for (const [file, original] of files) {
    const newFile = mapPath(file, moved);
    const { text, count } = rewriteLinks(original, file, newFile, moved);
    if (count > 0) plan.push({ file, newFile, text, count });
  }
  return plan;
}
