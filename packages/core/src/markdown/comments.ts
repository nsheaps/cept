/**
 * Inline comments in Markdown pages (REQ-NTN-005, REQ-NTN-006; phase-1 plan PR 61).
 *
 * A comment is one HTML comment on a line of its own:
 *
 *     <!-- cept:comment {"v":1,"id":"c-k2x9w4qmt7","author":{...},"created":"...","body":"..."} -->
 *
 * The payload is compact JSON. An HTML comment cannot contain `--`, so every
 * `-` that follows another `-` is written as the JSON escape `-`; a JSON
 * parser reads it back as `-`.
 *
 * `formatCommentMarker` writes one marker, `parseCommentMarker` reads one and
 * `readPageComments` finds every marker in a page. Reading is lenient where a
 * person or an agent may have edited the file by hand (a missing `id` or
 * `created` is repaired, with a warning) and never destructive: a marker that
 * cannot be read is reported with its exact text and line, and the page body
 * still holds it verbatim, so saving the page keeps it.
 */

import type { Html, RootContent } from 'mdast';
import { markdownParser } from './document.js';
import { frontMatterPrefix } from './front-matter.js';

/** The format version this code writes and reads. */
export const COMMENT_FORMAT_VERSION = 1;

/** Who wrote a comment: `{id: "github:nsheaps", name: "Nate Heaps"}`; agents use `agent:<name>`. */
export interface CommentAuthor {
  id: string;
  name: string;
}

/** The commented text and up to 32 characters of context either side. */
export interface CommentAnchor {
  quote: string;
  prefix?: string;
  suffix?: string;
}

/** One comment. Fields Cept does not know are kept in `extra` and written back. */
export interface PageComment {
  /** Unique within the page; written as `c-` and 10 or more lowercase letters and digits. */
  id: string;
  author: CommentAuthor;
  /** ISO 8601 date-time in UTC. */
  created: string;
  /** The comment as a Markdown string. */
  body: string;
  /** Absent for a page-level comment. */
  anchor?: CommentAnchor;
  /** ISO 8601 date-time of the last edit. */
  edited?: string;
  /** Reserved for threading: the `id` of the comment this one answers. */
  replyTo?: string;
  /** Reserved for resolving: set on the first comment of a thread. */
  status?: 'open' | 'resolved';
  /** Unknown payload fields, kept so a rewrite does not lose them. */
  extra?: Record<string, unknown>;
}

/** The result of reading one marker. */
export type ParsedCommentMarker =
  { ok: true; comment: PageComment; warnings: string[] } | { ok: false; reason: string };

/** Options for reading markers. */
export interface ParseCommentOptions {
  /** The `created` value given to a comment that has none; defaults to the Unix epoch. */
  fallbackCreated?: string;
}

const MARKER = /^<!--[ \t]*cept:comment(?:[ \t]+([\s\S]*?))?[ \t]*-->[ \t]*$/;
const MARKER_START = /^<!--[ \t]*cept:comment(?![\w-])/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]00:?00)$/;
const ID_FORMAT = /^c-[a-z0-9]{10,}$/;
const EPOCH = '1970-01-01T00:00:00Z';

const KNOWN_KEYS = new Set([
  'v',
  'id',
  'author',
  'created',
  'edited',
  'anchor',
  'replyTo',
  'status',
  'body',
]);

/** True when `value` starts a `cept:comment` marker, well formed or not. */
export function isCommentMarker(value: string): boolean {
  return MARKER_START.test(value.trimStart());
}

/** Write one comment as a marker line (no line ending). */
export function formatCommentMarker(comment: PageComment): string {
  const payload: Record<string, unknown> = {
    v: COMMENT_FORMAT_VERSION,
    id: comment.id,
    author: { id: comment.author.id, name: comment.author.name },
    created: comment.created,
  };
  if (comment.edited !== undefined) payload.edited = comment.edited;
  if (comment.anchor) {
    const { quote, prefix, suffix } = comment.anchor;
    payload.anchor = {
      quote,
      ...(prefix !== undefined ? { prefix } : {}),
      ...(suffix !== undefined ? { suffix } : {}),
    };
  }
  if (comment.replyTo !== undefined) payload.replyTo = comment.replyTo;
  if (comment.status !== undefined) payload.status = comment.status;
  payload.body = comment.body;
  for (const [key, value] of Object.entries(comment.extra ?? {})) {
    if (!KNOWN_KEYS.has(key)) payload[key] = value;
  }
  // `--` cannot appear in an HTML comment: JSON only has it inside strings.
  const json = JSON.stringify(payload).replace(/(?<=-)-/g, '\\u002d');
  return `<!-- cept:comment ${json} -->`;
}

/**
 * Read one marker (a single `<!-- cept:comment ... -->`). Returns `ok: false`
 * with a reason when it cannot be read; the caller keeps the text as it is.
 */
export function parseCommentMarker(
  marker: string,
  options: ParseCommentOptions = {},
): ParsedCommentMarker {
  const match = MARKER.exec(marker.trim());
  if (!match) return { ok: false, reason: 'not a complete cept:comment marker' };
  const text = match[1];
  if (text === undefined || text === '') return { ok: false, reason: 'the marker has no payload' };

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'the payload is not valid JSON' };
  }
  if (!isRecord(payload)) return { ok: false, reason: 'the payload is not a JSON object' };

  const version = payload.v;
  if (version === undefined) {
    // Hand-written markers may leave it out; treat them as version 1.
  } else if (version !== COMMENT_FORMAT_VERSION) {
    return { ok: false, reason: `unsupported comment format version ${JSON.stringify(version)}` };
  }

  if (typeof payload.body !== 'string') return { ok: false, reason: 'the body is missing' };
  const author = readAuthor(payload.author);
  if (!author) return { ok: false, reason: 'the author is missing or has no id and name' };

  const warnings: string[] = [];
  if (version === undefined) warnings.push('the format version is missing; read as 1');

  let id: string;
  if (typeof payload.id === 'string' && payload.id !== '') {
    id = payload.id;
    if (!ID_FORMAT.test(id))
      warnings.push(`the id "${id}" does not look like c-<10 letters or digits>`);
  } else {
    id = deriveId(text);
    warnings.push(`the id is missing; using ${id}`);
  }

  const fallback = options.fallbackCreated ?? EPOCH;
  let created: string;
  if (typeof payload.created === 'string' && ISO_UTC.test(payload.created)) {
    created = payload.created;
  } else {
    created = fallback;
    warnings.push(
      payload.created === undefined
        ? 'the created time is missing'
        : 'the created time is not an ISO 8601 UTC date-time',
    );
  }

  const comment: PageComment = { id, author, created, body: payload.body };

  if (payload.anchor !== undefined) {
    const anchor = readAnchor(payload.anchor);
    if (anchor === 'invalid') warnings.push('the anchor is not {quote, prefix?, suffix?}; ignored');
    else if (anchor) comment.anchor = anchor;
    else warnings.push('the anchor has an empty quote; read as a page-level comment');
  }
  if (payload.edited !== undefined) {
    if (typeof payload.edited === 'string' && ISO_UTC.test(payload.edited)) {
      comment.edited = payload.edited;
    } else {
      warnings.push('the edited time is not an ISO 8601 UTC date-time; ignored');
    }
  }
  if (payload.replyTo !== undefined) {
    if (typeof payload.replyTo === 'string' && payload.replyTo !== '') {
      comment.replyTo = payload.replyTo;
    } else {
      warnings.push('replyTo is not a comment id; ignored');
    }
  }
  if (payload.status !== undefined) {
    if (payload.status === 'open' || payload.status === 'resolved') comment.status = payload.status;
    else warnings.push('status is not "open" or "resolved"; ignored');
  }

  const extra = Object.fromEntries(Object.entries(payload).filter(([key]) => !KNOWN_KEYS.has(key)));
  if (Object.keys(extra).length > 0) comment.extra = extra;

  return { ok: true, comment, warnings };
}

/** A marker in a page that could not be read. */
export interface CommentProblem {
  /** 1-based line of the marker in the file. */
  line: number;
  /** The marker text, exactly as it is in the file. */
  raw: string;
  reason: string;
}

/** A comment found in a page, with where it is. */
export interface FoundComment {
  comment: PageComment;
  /** 1-based line of the marker in the file. */
  line: number;
  /** The marker text, exactly as it is in the file. */
  raw: string;
  warnings: string[];
}

/** Everything `readPageComments` finds. */
export interface PageComments {
  /** Readable comments, in document order. */
  comments: FoundComment[];
  /** Markers that could not be read; they stay in the file untouched. */
  problems: CommentProblem[];
  /** Page-level warnings, such as a repeated id. */
  warnings: string[];
}

/**
 * Find every comment marker in a page. Only top-level HTML blocks count, so a
 * marker shown inside a code fence, a quote or a list is not a comment.
 */
export function readPageComments(
  markdown: string,
  options: ParseCommentOptions = {},
): PageComments {
  const prefix = frontMatterPrefix(markdown);
  const body = markdown.slice(prefix.length);
  const firstLine = lineCount(prefix) + 1;
  const result: PageComments = { comments: [], problems: [], warnings: [] };

  for (const node of markdownParser.parse(body).children as RootContent[]) {
    if (node.type !== 'html' || !isCommentMarker((node as Html).value)) continue;
    const start = node.position?.start;
    if (!start) continue;
    const raw = (node as Html).value;
    const line = firstLine + start.line - 1;
    const parsed = parseCommentMarker(raw, options);
    if (parsed.ok) {
      result.comments.push({ comment: parsed.comment, line, raw, warnings: parsed.warnings });
    } else {
      result.problems.push({ line, raw, reason: parsed.reason });
    }
  }

  const seen = new Set<string>();
  for (const { comment } of result.comments) {
    if (seen.has(comment.id)) {
      result.warnings.push(`the id "${comment.id}" is used by more than one comment`);
    }
    seen.add(comment.id);
  }
  return result;
}

// ----------------------------------------------------------------- helpers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readAuthor(value: unknown): CommentAuthor | null {
  if (!isRecord(value)) return null;
  const { id, name } = value;
  return typeof id === 'string' && id !== '' && typeof name === 'string' ? { id, name } : null;
}

/** The anchor, `null` for an empty quote (a page-level comment), or `'invalid'`. */
function readAnchor(value: unknown): CommentAnchor | null | 'invalid' {
  if (!isRecord(value) || typeof value.quote !== 'string') return 'invalid';
  const { quote, prefix, suffix } = value;
  if (
    (prefix !== undefined && typeof prefix !== 'string') ||
    (suffix !== undefined && typeof suffix !== 'string')
  ) {
    return 'invalid';
  }
  if (quote === '') return null;
  return {
    quote,
    ...(prefix !== undefined ? { prefix } : {}),
    ...(suffix !== undefined ? { suffix } : {}),
  };
}

/** A stable id for a marker that has none: the same text always gives the same id. */
function deriveId(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `c-${hash.toString(36).padStart(10, '0')}`;
}

function lineCount(text: string): number {
  return (text.match(/\n/g) ?? []).length;
}
