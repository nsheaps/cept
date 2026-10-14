import { describe, expect, it } from 'vitest';
import { claimComments, commentNode, commentOf, releaseComments } from './comment-nodes.js';
import { formatCommentMarker } from './comments.js';
import type { PageComment } from './comments.js';
import { parseMarkdownDocument, serializeMarkdownDocument } from './document.js';

const comment: PageComment = {
  id: 'c-k2x9w4qmt7',
  author: { id: 'github:nsheaps', name: 'Nate' },
  created: '2026-10-14T05:00:00Z',
  body: 'Check this -- later',
  anchor: { quote: 'second', prefix: 'The ', suffix: ' line' },
};

const marker = formatCommentMarker(comment);
const page = `First.\n\nThe second line\n\n${marker}\n\nLast.\n`;

describe('claimComments / releaseComments', () => {
  it('turns a readable marker into a comment node', () => {
    const { doc } = parseMarkdownDocument(page);
    const claimed = claimComments(doc);
    const node = claimed.content!.find((n) => n.type === 'comment')!;
    expect(commentOf(node)).toEqual(comment);
    expect(claimed.content!.some((n) => n.type === 'rawBlock')).toBe(false);
  });

  it('saves an unchanged page byte for byte', () => {
    const parsed = parseMarkdownDocument(page);
    const released = releaseComments(claimComments(parsed.doc));
    expect(released).toEqual(parsed.doc);
    expect(serializeMarkdownDocument(released, parsed)).toBe(page);
  });

  it('keeps a hand-written marker as written when the comment is unchanged', () => {
    const handWritten = '<!--   cept:comment {"author":{"id":"a:x","name":"X"},"body":"hi"}   -->';
    const text = `Text.\n\n${handWritten}\n`;
    const parsed = parseMarkdownDocument(text);
    const released = releaseComments(claimComments(parsed.doc));
    expect(serializeMarkdownDocument(released, parsed)).toBe(text);
  });

  it('writes a changed comment with the formatter', () => {
    const parsed = parseMarkdownDocument(page);
    const claimed = claimComments(parsed.doc);
    const edited = {
      ...claimed,
      content: claimed.content!.map((n) =>
        n.type === 'comment'
          ? commentNode(
              { ...comment, body: 'Changed', edited: '2026-10-14T06:00:00Z' },
              String(n.attrs?.markdown),
            )
          : n,
      ),
    };
    const out = serializeMarkdownDocument(releaseComments(edited), parsed);
    expect(out).toContain('"body":"Changed"');
    expect(out).not.toContain('Check this');
  });

  it('writes a new comment node (no loaded text)', () => {
    const parsed = parseMarkdownDocument('Only.\n');
    const doc = {
      ...parsed.doc,
      content: [...parsed.doc.content!, commentNode(comment)],
    };
    const out = serializeMarkdownDocument(releaseComments(doc), parsed);
    expect(out).toContain(marker);
  });

  it('leaves an unreadable marker as a raw block', () => {
    const bad = '<!-- cept:comment {not json} -->';
    const parsed = parseMarkdownDocument(`Text.\n\n${bad}\n`);
    const claimed = claimComments(parsed.doc);
    expect(claimed).toBe(parsed.doc);
    expect(serializeMarkdownDocument(releaseComments(claimed), parsed)).toBe(`Text.\n\n${bad}\n`);
  });

  it('does not claim a marker inside a code fence', () => {
    const text = `\`\`\`\n${marker}\n\`\`\`\n`;
    const parsed = parseMarkdownDocument(text);
    expect(claimComments(parsed.doc)).toBe(parsed.doc);
  });
});
