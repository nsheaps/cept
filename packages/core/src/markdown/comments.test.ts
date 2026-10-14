import { describe, expect, it } from 'vitest';
import {
  COMMENT_FORMAT_VERSION,
  formatCommentMarker,
  isCommentMarker,
  parseCommentMarker,
  readPageComments,
} from './comments.js';
import type { PageComment } from './comments.js';

const fixtures = import.meta.glob<string>('./__fixtures__/round-trip/cept-comment*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function fixture(name: string): string {
  const entry = Object.entries(fixtures).find(([path]) => path.endsWith(`/${name}.md`));
  if (!entry) throw new Error(`no fixture ${name}`);
  return entry[1];
}

const base: PageComment = {
  id: 'c-k2x9w4qmt7',
  author: { id: 'github:nsheaps', name: 'Nate Heaps' },
  created: '2026-10-06T21:04:00Z',
  body: 'Should this mention `mise trust` first?',
  anchor: { quote: 'run mise install', prefix: 'First, ', suffix: ' in the repo root' },
};

describe('formatCommentMarker', () => {
  it('writes the REQ-NTN-005 example exactly', () => {
    expect(formatCommentMarker(base)).toBe(
      '<!-- cept:comment {"v":1,"id":"c-k2x9w4qmt7","author":{"id":"github:nsheaps","name":"Nate Heaps"},"created":"2026-10-06T21:04:00Z","anchor":{"quote":"run mise install","prefix":"First, ","suffix":" in the repo root"},"body":"Should this mention `mise trust` first?"} -->',
    );
    expect(COMMENT_FORMAT_VERSION).toBe(1);
  });

  it('writes a page-level comment without an anchor', () => {
    const { anchor: _anchor, ...pageLevel } = base;
    expect(formatCommentMarker(pageLevel)).not.toContain('anchor');
  });

  it('writes one line with no `--` for any body', () => {
    const body = 'a -- b --> c --- d ---> e\n"q" \\   <!-- f --!> g -';
    const marker = formatCommentMarker({ ...base, body });
    expect(marker).not.toContain('\n');
    // The only `--` left are the delimiters of the comment itself.
    expect(marker.slice(4, -3)).not.toContain('--');
    const parsed = parseCommentMarker(marker);
    expect(parsed.ok && parsed.comment.body).toBe(body);
  });

  it('writes the reserved and unknown fields, and never lets extra overwrite a known one', () => {
    const marker = formatCommentMarker({
      ...base,
      edited: '2026-10-07T00:00:00Z',
      replyTo: 'c-other00000',
      status: 'open',
      extra: { future: true, id: 'c-hijack0000' },
    });
    expect(marker).toContain('"edited":"2026-10-07T00:00:00Z"');
    expect(marker).toContain('"replyTo":"c-other00000"');
    expect(marker).toContain('"status":"open"');
    expect(marker).toContain('"future":true');
    expect(marker).not.toContain('hijack');
  });
});

describe('parseCommentMarker', () => {
  it('reads what formatCommentMarker writes, for every field', () => {
    const comment: PageComment = {
      ...base,
      edited: '2026-10-07T00:00:00.500Z',
      replyTo: 'c-other00000',
      status: 'resolved',
      extra: { future: { a: [1, 2] } },
    };
    const parsed = parseCommentMarker(formatCommentMarker(comment));
    expect(parsed).toEqual({ ok: true, comment, warnings: [] });
  });

  it('reads a body with dashes, an arrow, quotes, backslashes and newlines', () => {
    const body = 'x -- y --> z "quoted" back\\slash\nsecond line\r\nthird';
    const parsed = parseCommentMarker(formatCommentMarker({ ...base, body }));
    expect(parsed.ok && parsed.comment.body).toBe(body);
  });

  it('repairs a missing id, created time and version with warnings', () => {
    const text = '<!-- cept:comment {"author":{"id":"agent:jack","name":"Jack"},"body":"Hi"} -->';
    const first = parseCommentMarker(text, { fallbackCreated: '2026-05-05T00:00:00Z' });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.comment.id).toMatch(/^c-[a-z0-9]{10}$/);
    expect(first.comment.created).toBe('2026-05-05T00:00:00Z');
    expect(first.warnings).toHaveLength(3);
    // The repaired id is stable, so reading twice agrees.
    const second = parseCommentMarker(text);
    expect(second.ok && second.comment.id).toBe(first.comment.id);
    expect(second.ok && second.comment.created).toBe('1970-01-01T00:00:00Z');
  });

  it('keeps an id that is not in the c-… format, with a warning', () => {
    const parsed = parseCommentMarker(formatCommentMarker({ ...base, id: 'c-1' }));
    expect(parsed.ok && parsed.comment.id).toBe('c-1');
    expect(parsed.ok && parsed.warnings.join()).toContain('c-1');
  });

  it('ignores bad optional fields with a warning instead of rejecting the comment', () => {
    const text = `<!-- cept:comment ${JSON.stringify({
      v: 1,
      id: 'c-ok00000000',
      author: { id: 'a', name: 'A' },
      created: 'yesterday',
      body: 'b',
      anchor: { quote: 5 },
      edited: 'later',
      replyTo: 3,
      status: 'maybe',
    })} -->`;
    const parsed = parseCommentMarker(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.comment).toEqual({
      id: 'c-ok00000000',
      author: { id: 'a', name: 'A' },
      created: '1970-01-01T00:00:00Z',
      body: 'b',
    });
    expect(parsed.warnings).toHaveLength(5);
  });

  it('reads an empty anchor quote as a page-level comment', () => {
    const text = `<!-- cept:comment ${JSON.stringify({ ...base, v: 1, anchor: { quote: '' } })} -->`;
    const parsed = parseCommentMarker(text);
    expect(parsed.ok && parsed.comment.anchor).toBeUndefined();
    expect(parsed.ok && parsed.warnings).toHaveLength(1);
  });

  it.each([
    ['not valid JSON', '<!-- cept:comment {"id": -->', 'JSON'],
    ['not an object', '<!-- cept:comment [1] -->', 'object'],
    ['no payload', '<!-- cept:comment -->', 'payload'],
    [
      'a newer version',
      '<!-- cept:comment {"v":2,"author":{"id":"a","name":"A"},"body":"b"} -->',
      'version 2',
    ],
    ['no body', '<!-- cept:comment {"v":1,"author":{"id":"a","name":"A"}} -->', 'body'],
    ['no author', '<!-- cept:comment {"v":1,"body":"b"} -->', 'author'],
    [
      'an author without a name',
      '<!-- cept:comment {"v":1,"author":{"id":"a"},"body":"b"} -->',
      'author',
    ],
    ['no closing', '<!-- cept:comment {"v":1', 'complete'],
  ])('rejects %s', (_name, text, reason) => {
    const parsed = parseCommentMarker(text);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.reason).toContain(reason);
  });
});

describe('isCommentMarker', () => {
  it('recognises the start of a marker, readable or not', () => {
    expect(isCommentMarker('<!-- cept:comment {} -->')).toBe(true);
    expect(isCommentMarker('<!--cept:comment')).toBe(true);
    expect(isCommentMarker('  <!-- cept:comment {"v":')).toBe(true);
  });

  it('ignores other HTML comments and look-alikes', () => {
    expect(isCommentMarker('<!-- a note -->')).toBe(false);
    expect(isCommentMarker('<!-- cept:commentary -->')).toBe(false);
    expect(isCommentMarker('<!-- cept:block -->')).toBe(false);
  });
});

describe('readPageComments', () => {
  it('finds anchored and page-level comments with their lines', () => {
    const found = readPageComments(fixture('cept-comment'));
    expect(found.problems).toEqual([]);
    expect(found.warnings).toEqual([]);
    expect(found.comments.map((c) => [c.comment.id, c.line, c.comment.anchor?.quote])).toEqual([
      ['c-k2x9w4qmt7', 2, 'commented phrase'],
      ['c-p3q8r1s5t0', 5, undefined],
    ]);
    expect(found.comments[1]!.raw).toBe(fixture('cept-comment').split('\n')[4]);
  });

  it('reads the escapes fixture and ignores the marker inside a code fence', () => {
    const found = readPageComments(fixture('cept-comment-escapes'));
    expect(found.problems).toEqual([]);
    expect(found.comments).toHaveLength(1);
    const { comment, raw } = found.comments[0]!;
    expect(comment.body).toBe('Dashes --, an arrow -->, quotes ", a backslash \\ and\na new line.');
    expect(comment.status).toBe('resolved');
    expect(comment.extra).toEqual({ future: { a: [1, 2] } });
    // Writing it again gives the same bytes.
    expect(formatCommentMarker(comment)).toBe(raw);
  });

  it('reports unreadable markers with their text and line, and still reads the rest', () => {
    const found = readPageComments(fixture('cept-comment-malformed'));
    expect(found.comments).toEqual([]);
    expect(found.problems.map((p) => p.line)).toEqual([3, 5, 7, 9]);
    expect(found.problems.map((p) => p.reason)).toEqual([
      expect.stringContaining('JSON'),
      expect.stringContaining('version 9'),
      expect.stringContaining('body'),
      expect.stringContaining('object'),
    ]);
    expect(found.problems[0]!.raw).toBe(
      '<!-- cept:comment {"v":1,"id":"c-badjson001","author": -->',
    );
  });

  it('repairs a hand-written comment and warns', () => {
    const found = readPageComments(fixture('cept-comment-hand-written'));
    expect(found.problems).toEqual([]);
    expect(found.comments).toHaveLength(1);
    expect(found.comments[0]!.warnings.length).toBeGreaterThan(0);
    expect(found.comments[0]!.comment.author.id).toBe('agent:jack');
  });

  it('counts lines from the top of the file, past front matter', () => {
    const page = `---\ntitle: T\n---\n\nText.\n\n${formatCommentMarker(base)}\n`;
    expect(readPageComments(page).comments[0]!.line).toBe(7);
  });

  it('finds nothing in a page without comments', () => {
    expect(readPageComments('# Title\n\nJust text.\n')).toEqual({
      comments: [],
      problems: [],
      warnings: [],
    });
    expect(readPageComments('')).toEqual({ comments: [], problems: [], warnings: [] });
  });

  it('ignores other HTML comments and markers inside quotes and lists', () => {
    const page = `<!-- a note -->\n\n> ${formatCommentMarker(base)}\n\n- ${formatCommentMarker(base)}\n`;
    expect(readPageComments(page).comments).toEqual([]);
  });

  it('warns when two comments share an id', () => {
    const page = `${formatCommentMarker(base)}\n\n${formatCommentMarker(base)}\n`;
    const found = readPageComments(page);
    expect(found.comments).toHaveLength(2);
    expect(found.warnings).toEqual([expect.stringContaining('c-k2x9w4qmt7')]);
  });

  it('finds a marker directly under a paragraph', () => {
    const page = `Some text.\n${formatCommentMarker(base)}\n`;
    expect(readPageComments(page).comments.map((c) => c.line)).toEqual([2]);
  });

  it('treats an unterminated marker as unreadable, not as a comment', () => {
    const page = 'Text.\n\n<!-- cept:comment {"v":1\n\nStill text.\n';
    const found = readPageComments(page);
    expect(found.comments).toEqual([]);
    expect(found.problems).toHaveLength(1);
    expect(found.problems[0]!.line).toBe(3);
  });
});
