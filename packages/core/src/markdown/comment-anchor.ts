/**
 * Comment anchors (REQ-NTN-002) and the small helpers a new comment needs
 * (ids and authors, REQ-NTN-005, REQ-NTN-007; phase-1 plan PR 62).
 *
 * An anchor is a text-quote selector: the commented text and up to 32
 * characters of context either side. It holds no editor positions, so it
 * survives edits made anywhere, including outside Cept. `createAnchor` builds
 * one from a selection of a text; `resolveAnchor` finds it again, accepting a
 * close match when the quoted text itself was edited and returning null (the
 * comment is detached) when there is none.
 */

import type { CommentAnchor, CommentAuthor } from './comments.js';

/** How much text is kept before and after the quote. */
export const ANCHOR_CONTEXT_LENGTH = 32;

/** Where an anchor was found in a text. */
export interface AnchorMatch {
  /** Offset of the first character of the match. */
  from: number;
  /** Offset after the last character of the match. */
  to: number;
  /** True when the text equals the quote; false for a close match. */
  exact: boolean;
}

/** The anchor for `text.slice(from, to)`, with its surrounding context. */
export function createAnchor(text: string, from: number, to: number): CommentAnchor {
  const quote = text.slice(from, to);
  const prefix = text.slice(Math.max(0, from - ANCHOR_CONTEXT_LENGTH), from);
  const suffix = text.slice(to, to + ANCHOR_CONTEXT_LENGTH);
  return {
    quote,
    ...(prefix !== '' ? { prefix } : {}),
    ...(suffix !== '' ? { suffix } : {}),
  };
}

/** Quotes longer than this are matched exactly only; approximate search costs length x text. */
const MAX_FUZZY_QUOTE = 200;
/** Quotes shorter than this are matched exactly only; a short quote matches almost anything approximately. */
const MIN_FUZZY_QUOTE = 8;
/** The share of the quote that may differ in a close match. */
const FUZZY_TOLERANCE = 0.2;

/**
 * Find an anchor in a text. Order of preference: an exact match (the one whose
 * context agrees most when the quote repeats), a match that differs only in
 * case and white space, then a close match. Returns null when there is none.
 */
export function resolveAnchor(text: string, anchor: CommentAnchor): AnchorMatch | null {
  const { quote } = anchor;
  if (quote === '') return null;

  const exact = occurrences(text, quote);
  if (exact.length > 0) return best(text, anchor, exact, quote.length, true);

  const loose = looseMatches(text, quote);
  if (loose.length > 0) {
    const chosen = bestByContext(text, anchor, loose);
    return { from: chosen.from, to: chosen.to, exact: false };
  }

  return fuzzyMatch(text, quote);
}

function occurrences(text: string, quote: string): number[] {
  const found: number[] = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) found.push(at);
  return found;
}

function best(
  text: string,
  anchor: CommentAnchor,
  starts: number[],
  length: number,
  exact: boolean,
): AnchorMatch {
  const chosen = bestByContext(
    text,
    anchor,
    starts.map((from) => ({ from, to: from + length })),
  );
  return { from: chosen.from, to: chosen.to, exact };
}

/** The candidate whose surrounding text agrees most with the anchor's context; the first on a tie. */
function bestByContext(
  text: string,
  anchor: CommentAnchor,
  candidates: { from: number; to: number }[],
): { from: number; to: number } {
  let chosen = candidates[0]!;
  let top = -1;
  for (const candidate of candidates) {
    const score =
      commonSuffix(text.slice(0, candidate.from), anchor.prefix ?? '') +
      commonPrefix(text.slice(candidate.to), anchor.suffix ?? '');
    if (score > top) {
      top = score;
      chosen = candidate;
    }
  }
  return chosen;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/** Matches of the quote that ignore case and treat any run of white space as one space. */
function looseMatches(text: string, quote: string): { from: number; to: number }[] {
  const normalizedQuote = quote.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalizedQuote === '') return [];
  // Map each normalized character back to its offset in the text.
  let normalized = '';
  const offsets: number[] = [];
  let inSpace = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (/\s/.test(char)) {
      if (inSpace) continue;
      inSpace = true;
      normalized += ' ';
    } else {
      inSpace = false;
      normalized += char.toLowerCase();
    }
    offsets.push(i);
  }
  const found: { from: number; to: number }[] = [];
  for (
    let at = normalized.indexOf(normalizedQuote);
    at !== -1;
    at = normalized.indexOf(normalizedQuote, at + 1)
  ) {
    const last = offsets[at + normalizedQuote.length - 1]!;
    found.push({ from: offsets[at]!, to: last + 1 });
  }
  return found;
}

/**
 * The substring of `text` closest to `quote` by edit distance (Sellers'
 * algorithm), provided it differs by at most 20% of the quote's length.
 */
function fuzzyMatch(text: string, quote: string): AnchorMatch | null {
  const m = quote.length;
  if (m < MIN_FUZZY_QUOTE || m > MAX_FUZZY_QUOTE || text.length === 0) return null;
  const limit = Math.floor(m * FUZZY_TOLERANCE);

  // D[i][j]: the fewest edits to turn quote[0..i) into a substring of text ending at j.
  let distance = Array.from({ length: m + 1 }, (_, i) => i);
  let start = new Array<number>(m + 1).fill(0);
  let found: AnchorMatch | null = null;
  let foundDistance = Infinity;

  for (let j = 1; j <= text.length; j++) {
    const nextDistance = new Array<number>(m + 1);
    const nextStart = new Array<number>(m + 1);
    nextDistance[0] = 0;
    nextStart[0] = j;
    for (let i = 1; i <= m; i++) {
      const cost = quote[i - 1] === text[j - 1] ? 0 : 1;
      let d = distance[i - 1]! + cost;
      let s = start[i - 1]!;
      if (distance[i]! + 1 < d) {
        d = distance[i]! + 1;
        s = start[i]!;
      }
      if (nextDistance[i - 1]! + 1 < d) {
        d = nextDistance[i - 1]! + 1;
        s = nextStart[i - 1]!;
      }
      nextDistance[i] = d;
      nextStart[i] = s;
    }
    if (nextDistance[m]! <= limit && nextDistance[m]! < foundDistance) {
      foundDistance = nextDistance[m]!;
      found = { from: nextStart[m]!, to: j, exact: false };
    }
    distance = nextDistance;
    start = nextStart;
  }
  return found && found.to > found.from ? found : null;
}

// ------------------------------------------------------------ ids and authors

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A comment id: `c-` and 10 lowercase letters and digits. */
export function newCommentId(random: (length: number) => Uint8Array = randomBytes): string {
  const bytes = random(10);
  let id = 'c-';
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

/** The author for a user signed in with GitHub: the login, and the profile name or else the login. */
export function githubAuthor(login: string, name?: string | null): CommentAuthor {
  return { id: `github:${login}`, name: name?.trim() ? name.trim() : login };
}

/** The author for a device-local identity: a random id kept in the device's settings. */
export function localAuthor(
  name: string,
  random: (length: number) => Uint8Array = randomBytes,
): CommentAuthor {
  return { id: `local:${newCommentId(random).slice(2)}`, name: name.trim() };
}
