/**
 * Three-way text merge for sync (REQ-WS-026).
 *
 * `mergeLines` is a line-based diff3: changes that do not overlap merge on
 * their own, and overlapping ones come back with conflict markers. Pages
 * (`.md`) merge their front matter key by key first (`mergeFrontMatter`), so
 * two people changing different keys never conflict; the same key changed on
 * both sides is a conflict. Block-aware Markdown merging waits for the M3
 * pipeline; until then the body merges line by line.
 */

import { frontMatterKeyBlocks, type FrontMatterKeyBlock } from '../markdown/front-matter.js';

/** The marker lines a conflicting hunk is wrapped in. */
export const CONFLICT_MARKERS = {
  mine: '<<<<<<< mine',
  separator: '=======',
  theirs: '>>>>>>> theirs',
} as const;

const MARKER_LINE = /^(<<<<<<<|=======|>>>>>>>)( |$)/m;

/** Whether `text` still holds a conflict marker line. */
export function hasConflictMarkers(text: string): boolean {
  return MARKER_LINE.test(text);
}

/** The result of a three-way merge. */
export interface TextMergeResult {
  /** Whether every change merged without a conflict. */
  clean: boolean;
  /** The merged text; conflicting hunks are wrapped in `CONFLICT_MARKERS`. */
  merged: string;
}

/** Above this many cells the LCS table is skipped and the changed middle is one hunk. */
const MAX_LCS_CELLS = 16_000_000;

/**
 * For each line of `a`, the index of the line of `b` it is matched with in a
 * longest common subsequence, or -1.
 */
function matchLines(a: readonly string[], b: readonly string[]): Int32Array {
  const match = new Int32Array(a.length).fill(-1);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    match[start] = start;
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
    match[endA] = endB;
  }
  const n = endA - start;
  const m = endB - start;
  if (n === 0 || m === 0 || (n + 1) * (m + 1) > MAX_LCS_CELLS) return match;

  // lengths[i][j]: the LCS length of a[start+i..endA) and b[start+j..endB).
  const width = m + 1;
  const lengths = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lengths[i * width + j] =
        a[start + i] === b[start + j]
          ? lengths[(i + 1) * width + j + 1]! + 1
          : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      match[start + i] = start + j;
      i++;
      j++;
    } else if (lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return match;
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Merge the lines of one changed region; null when both sides changed it differently. */
function mergeRegion(
  base: readonly string[],
  mine: readonly string[],
  theirs: readonly string[],
): readonly string[] | null {
  if (sameLines(mine, theirs)) return mine;
  if (sameLines(mine, base)) return theirs;
  if (sameLines(theirs, base)) return mine;
  return null;
}

/** Three-way merge of line arrays (diff3). */
function mergeLineArrays(
  base: readonly string[],
  mine: readonly string[],
  theirs: readonly string[],
): { clean: boolean; lines: string[] } {
  const toMine = matchLines(base, mine);
  const toTheirs = matchLines(base, theirs);
  const out: string[] = [];
  let clean = true;
  let b = 0;
  let m = 0;
  let t = 0;

  const emitRegion = (bEnd: number, mEnd: number, tEnd: number) => {
    const region = [base.slice(b, bEnd), mine.slice(m, mEnd), theirs.slice(t, tEnd)] as const;
    if (region.every((lines) => lines.length === 0)) return;
    const merged = mergeRegion(...region);
    if (merged) {
      out.push(...merged);
      return;
    }
    clean = false;
    out.push(CONFLICT_MARKERS.mine, ...region[1], CONFLICT_MARKERS.separator, ...region[2]);
    out.push(CONFLICT_MARKERS.theirs);
  };

  for (;;) {
    // The next base line kept by both sides is where a stable run starts.
    let p = b;
    while (p < base.length && !(toMine[p]! >= m && toTheirs[p]! >= t)) p++;
    if (p === base.length) {
      emitRegion(base.length, mine.length, theirs.length);
      break;
    }
    const pm = toMine[p]!;
    const pt = toTheirs[p]!;
    emitRegion(p, pm, pt);
    let q = p;
    while (q < base.length && toMine[q] === pm + (q - p) && toTheirs[q] === pt + (q - p)) {
      out.push(base[q]!);
      q++;
    }
    b = q;
    m = pm + (q - p);
    t = pt + (q - p);
  }
  return { clean, lines: out };
}

/** Line-based three-way merge (diff3) of `mine` and `theirs` against `base`. */
export function mergeLines(base: string, mine: string, theirs: string): TextMergeResult {
  if (mine === theirs) return { clean: true, merged: mine };
  if (mine === base) return { clean: true, merged: theirs };
  if (theirs === base) return { clean: true, merged: mine };
  const result = mergeLineArrays(base.split('\n'), mine.split('\n'), theirs.split('\n'));
  return { clean: result.clean, merged: result.lines.join('\n') };
}

/** A page split into its front matter lines (null without front matter) and the rest. */
interface PageParts {
  frontMatter: string[] | null;
  /** The text after the closing `---` line (the whole text without front matter). */
  body: string;
}

function splitPage(text: string): PageParts {
  const open = /^---\r?\n/.exec(text);
  if (!open) return { frontMatter: null, body: text };
  const start = open[0].length;
  const close = /\r?\n---(\r?\n|$)/g;
  close.lastIndex = start - 1;
  const found = close.exec(text);
  if (!found) return { frontMatter: null, body: text };
  return {
    frontMatter: found.index > start - 1 ? text.slice(start, found.index).split(/\r?\n/) : [],
    body: text.slice(found.index + found[0].length),
  };
}

/** A page from its parts; the closing `---` always ends its line, with `eol`. */
function joinPage(frontMatter: string[], body: string, eol: string): string {
  return ['---', ...frontMatter, '---', ''].join(eol) + body;
}

/** Merge front matter key by key; the same key changed on both sides is a conflict. */
export function mergeFrontMatter(
  base: readonly string[],
  mine: readonly string[],
  theirs: readonly string[],
): { clean: boolean; lines: string[] } {
  const parsed = [
    frontMatterKeyBlocks(base),
    frontMatterKeyBlocks(mine),
    frontMatterKeyBlocks(theirs),
  ] as const;
  if (parsed.some((blocks) => blocks === null)) return mergeLineArrays(base, mine, theirs);
  const [baseBlocks, mineBlocks, theirBlocks] = parsed as unknown as [
    FrontMatterKeyBlock[],
    FrontMatterKeyBlock[],
    FrontMatterKeyBlock[],
  ];
  const text = (blocks: FrontMatterKeyBlock[], key: string) =>
    blocks.find((block) => block.key === key)?.lines.join('\n');

  // Keys in my order, then keys only they have, in theirs.
  const keys = mineBlocks.map((block) => block.key);
  for (const block of theirBlocks) if (!keys.includes(block.key)) keys.push(block.key);

  const out: string[] = [];
  let clean = true;
  for (const key of keys) {
    const b = text(baseBlocks, key);
    const m = text(mineBlocks, key);
    const t = text(theirBlocks, key);
    const merged = m === t ? m : m === b ? t : t === b ? m : null;
    if (merged === null) {
      clean = false;
      out.push(CONFLICT_MARKERS.mine);
      if (m !== undefined) out.push(m);
      out.push(CONFLICT_MARKERS.separator);
      if (t !== undefined) out.push(t);
      out.push(CONFLICT_MARKERS.theirs);
    } else if (merged !== undefined) {
      out.push(merged);
    }
  }
  return { clean, lines: out.length > 0 ? out.join('\n').split('\n') : [] };
}

/** Whether a path is a Markdown page, whose front matter merges key by key. */
export function isPagePath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

/**
 * Merge a file's three versions. Pages merge their front matter key by key
 * and their body line by line; other files merge line by line. `base` is
 * null when both sides added the file.
 */
export function mergeText(
  path: string,
  base: string | null,
  mine: string,
  theirs: string,
): TextMergeResult {
  const ancestor = base ?? '';
  if (!isPagePath(path)) return mergeLines(ancestor, mine, theirs);
  const [b, m, t] = [splitPage(ancestor), splitPage(mine), splitPage(theirs)];
  if (m.frontMatter === null && t.frontMatter === null) return mergeLines(ancestor, mine, theirs);
  const front = mergeFrontMatter(b.frontMatter ?? [], m.frontMatter ?? [], t.frontMatter ?? []);
  const body = mergeLines(b.body, m.body, t.body);
  return {
    clean: front.clean && body.clean,
    // Keep my line endings for the front matter fences.
    merged: joinPage(
      front.lines,
      body.merged,
      (m.frontMatter ? mine : theirs).includes('\r\n') ? '\r\n' : '\n',
    ),
  };
}
