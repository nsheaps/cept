/**
 * Page front matter (REQ-EDT-026).
 *
 * A page may start with a YAML block between `---` and `---` (or `...`)
 * lines, after an optional byte order mark. Cept reads a fixed set of
 * reserved keys from it and keeps every byte of it otherwise: splitting and
 * joining a page is lossless, and editing one key changes only that key's
 * lines.
 */

import { dump, load } from 'js-yaml';

/** A page split into its leading byte order mark, front matter block and body. */
export interface FrontMatterSplit {
  /** `'﻿'` when the file starts with a byte order mark, else `''`. */
  bom: string;
  /**
   * The front matter block from the opening `---` line through the end of the
   * closing line (including its line ending), or null when there is none.
   */
  block: string | null;
  /** The YAML between the fences, or null when there is no front matter. */
  yaml: string | null;
  /** Everything after the front matter. */
  body: string;
}

const OPEN = /^---[ \t]*(\r?\n)/;
const CLOSE = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/gm;

/** Split a page; `joinFrontMatter(splitFrontMatter(text)) === text` always holds. */
export function splitFrontMatter(text: string): FrontMatterSplit {
  const bom = text.startsWith('﻿') ? '﻿' : '';
  const rest = text.slice(bom.length);
  const open = OPEN.exec(rest);
  if (!open) return { bom, block: null, yaml: null, body: rest };
  CLOSE.lastIndex = open[0].length;
  const close = CLOSE.exec(rest);
  if (!close) return { bom, block: null, yaml: null, body: rest };
  const end = close.index + close[0].length;
  return {
    bom,
    block: rest.slice(0, end),
    yaml: rest.slice(open[0].length, close.index),
    body: rest.slice(end),
  };
}

/** The page text for a split (the inverse of `splitFrontMatter`). */
export function joinFrontMatter(split: FrontMatterSplit): string {
  return split.bom + (split.block ?? '') + split.body;
}

/**
 * The bytes before a page's first block: the byte order mark, the front
 * matter block and the blank lines after it. An editor that shows only the
 * rest (`text.slice(prefix.length)`) can put them back unchanged on save.
 */
export function frontMatterPrefix(text: string): string {
  const split = splitFrontMatter(text);
  const blank = /^(?:[ \t]*\r?\n)*/.exec(split.body)![0];
  return split.bom + (split.block ?? '') + blank;
}

/** Typed page metadata read from the reserved front matter keys. */
export interface PageFrontMatter {
  title?: string;
  icon?: string;
  cover?: string;
  tags: string[];
  aliases: string[];
  description?: string;
  created?: string;
  updated?: string;
  order?: number;
  id?: string;
  /** Problems with the front matter, shown on the page. The file is never rewritten for them. */
  warnings: string[];
}

/** The front matter keys Cept reads (EDT-026). */
export const RESERVED_FRONT_MATTER_KEYS = [
  'title',
  'icon',
  'cover',
  'tags',
  'aliases',
  'description',
  'created',
  'updated',
  'order',
  'id',
] as const;

export type ReservedFrontMatterKey = (typeof RESERVED_FRONT_MATTER_KEYS)[number];

/** Read compatibility aliases, used only when the reserved key is absent. */
const ALIASES: Partial<Record<ReservedFrontMatterKey, readonly string[]>> = {
  created: ['date'],
  updated: ['lastmod', 'modified'],
};

/** True when YAML holds no content (only blank and comment lines). */
function isBlankYaml(yaml: string): boolean {
  return yaml.split(/\r?\n/).every((line) => /^\s*(#.*)?$/.test(line));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A date or date-time value as an ISO 8601 string, or undefined. */
function toDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString();
    // js-yaml reads `2026-01-02` as midnight UTC; keep it a date.
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  return undefined;
}

/** A list of strings; a single string is a list of one. */
function toStrings(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as string[];
  }
  return undefined;
}

/** Front matter YAML loaded into keys, with the problems found loading it. */
export interface LoadedFrontMatter {
  /** The keys; empty when there is no front matter or it could not be read. */
  data: Record<string, unknown>;
  warnings: string[];
}

/** Load a front matter YAML string (null = no front matter) without throwing. */
export function loadFrontMatter(yaml: string | null): LoadedFrontMatter {
  if (yaml === null || isBlankYaml(yaml)) return { data: {}, warnings: [] };
  let data: unknown;
  try {
    data = load(yaml);
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return { data: {}, warnings: [`Front matter is not valid YAML: ${reason}`] };
  }
  if (data === null || data === undefined) return { data: {}, warnings: [] };
  if (!isRecord(data)) return { data: {}, warnings: ['Front matter is not a set of keys'] };
  return { data, warnings: [] };
}

/**
 * Read the reserved keys from a front matter YAML string (null = no front
 * matter). Pass `loaded` when the YAML was already loaded, to parse it once.
 */
export function readFrontMatter(
  yaml: string | null,
  loaded: LoadedFrontMatter = loadFrontMatter(yaml),
): PageFrontMatter {
  const meta: PageFrontMatter = { tags: [], aliases: [], warnings: [...loaded.warnings] };
  const { data } = loaded;

  const raw = (key: ReservedFrontMatterKey): [string, unknown] | undefined => {
    if (key in data) return [key, data[key]];
    for (const alias of ALIASES[key] ?? []) if (alias in data) return [alias, data[alias]];
    return undefined;
  };
  const wrongType = (key: string, expected: string) =>
    meta.warnings.push(`Front matter \`${key}\` should be ${expected}; it is ignored`);

  for (const key of ['title', 'icon', 'cover', 'description', 'id'] as const) {
    const entry = raw(key);
    if (!entry || entry[1] === null) continue;
    const [name, value] = entry;
    if (typeof value === 'string') meta[key] = value;
    else if (key === 'id' && typeof value === 'number') meta.id = String(value);
    else wrongType(name, 'a string');
  }
  for (const key of ['tags', 'aliases'] as const) {
    const entry = raw(key);
    if (!entry || entry[1] === null) continue;
    const list = toStrings(entry[1]);
    if (list) meta[key] = list;
    else wrongType(entry[0], 'a list of strings');
  }
  for (const key of ['created', 'updated'] as const) {
    const entry = raw(key);
    if (!entry || entry[1] === null) continue;
    const date = toDate(entry[1]);
    if (date) meta[key] = date;
    else wrongType(entry[0], 'a date');
  }
  const order = raw('order');
  if (order && order[1] !== null) {
    if (typeof order[1] === 'number' && Number.isFinite(order[1])) meta.order = order[1];
    else wrongType(order[0], 'a number');
  }
  return meta;
}

/** The text of the first level-1 ATX heading in a Markdown body, outside code fences. */
export function firstHeading(body: string): string | undefined {
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      // A fence closes on the same character, at least as long as it opened.
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^ {0,3}#[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading?.[1]) return heading[1].trim();
  }
  return undefined;
}

/**
 * A page's title: front matter `title`, else its first level-1 heading, else
 * its file name without `.md` (the folder name for `README.md`/`index.md`).
 */
export function pageTitle(meta: Pick<PageFrontMatter, 'title'>, body: string, path = ''): string {
  if (meta.title?.trim()) return meta.title.trim();
  const heading = firstHeading(body);
  if (heading) return heading;
  const parts = path.split('/').filter(Boolean);
  let name = parts.pop() ?? '';
  if (/^(readme|index)\.(md|markdown)$/i.test(name) && parts.length > 0) name = parts.pop()!;
  return name.replace(/\.(md|markdown)$/i, '');
}

/** A top-level key of a front matter block, with the lines that belong to it. */
export interface FrontMatterKeyBlock {
  key: string;
  lines: string[];
}

const TOP_LEVEL_KEY = /^([^\s#'"-][^:]*|'[^']*'|"[^"]*"):(\s|$)/;

/**
 * Split front matter lines into blocks, one per top-level key. Indented lines
 * and `- ` list items continue the key above. Comment and blank lines go with
 * the key after them; anything after the last key stays with it. Returns null
 * when a key appears twice.
 */
export function frontMatterKeyBlocks(lines: readonly string[]): FrontMatterKeyBlock[] | null {
  const blocks: FrontMatterKeyBlock[] = [];
  let pending: string[] = [];
  for (const line of lines) {
    const key = TOP_LEVEL_KEY.exec(line)?.[1]?.trim();
    if (key !== undefined) {
      if (blocks.some((block) => block.key === key)) return null;
      blocks.push({ key, lines: [...pending, line] });
      pending = [];
    } else if (blocks.length > 0 && /^(\s|-(\s|$))/.test(line) && line.trim() !== '') {
      blocks[blocks.length - 1]!.lines.push(...pending, line);
      pending = [];
    } else {
      pending.push(line);
    }
  }
  if (pending.length > 0) {
    if (blocks.length > 0) blocks[blocks.length - 1]!.lines.push(...pending);
    else blocks.push({ key: '', lines: pending });
  }
  return blocks;
}

function unquote(key: string): string {
  return /^(['"]).*\1$/.test(key) ? key.slice(1, -1) : key;
}

/** The YAML lines for one key, without a trailing line ending. */
function keyLines(key: string, value: unknown): string[] {
  return dump({ [key]: value }, { lineWidth: -1 })
    .replace(/\n$/, '')
    .split('\n');
}

/**
 * Set (or, with `undefined`, remove) one front matter key with a minimal edit.
 * Only that key's lines change; a new key is appended at the end of the block;
 * a page without front matter gets a block holding only that key. Front
 * matter that is not valid YAML, or that repeats a key, is never rewritten:
 * the text comes back unchanged.
 */
export function setFrontMatterKey(text: string, key: string, value: unknown): string {
  const split = splitFrontMatter(text);
  const eol = /\r\n/.test(split.block ?? text) ? '\r\n' : '\n';

  if (split.block === null || split.yaml === null) {
    if (value === undefined) return text;
    const block = ['---', ...keyLines(key, value), '---', ''].join(eol);
    return split.bom + block + split.body;
  }

  if (!isBlankYaml(split.yaml)) {
    try {
      load(split.yaml);
    } catch {
      return text;
    }
  }
  const yamlLines = split.yaml === '' ? [] : split.yaml.replace(/\r?\n$/, '').split(/\r?\n/);
  const blocks = frontMatterKeyBlocks(yamlLines);
  if (blocks === null) return text;

  const index = blocks.findIndex((block) => unquote(block.key) === key);
  if (index === -1) {
    if (value === undefined) return text;
    blocks.push({ key, lines: keyLines(key, value) });
  } else {
    const current = blocks[index]!;
    const keyLine = current.lines.findIndex((line) => TOP_LEVEL_KEY.test(line));
    // Keep the comments and blank lines above the key.
    const leading = current.lines.slice(0, keyLine);
    current.lines = value === undefined ? leading : [...leading, ...keyLines(key, value)];
  }

  const yaml = blocks.flatMap((block) => block.lines);
  const open = OPEN.exec(split.block)![0];
  const closeLine = split.block.slice(split.block.length - closingLength(split.block));
  const body = yaml.length > 0 ? yaml.join(eol) + eol : '';
  return split.bom + open + body + closeLine + split.body;
}

/** The length of the closing fence line (with its line ending) at the end of a block. */
function closingLength(block: string): number {
  const match = /(?:^|\n)((?:---|\.\.\.)[ \t]*(?:\r?\n)?)$/.exec(block);
  return match?.[1]?.length ?? 0;
}
