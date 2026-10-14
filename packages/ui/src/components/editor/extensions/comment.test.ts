import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { formatCommentMarker, readPageComments } from '@cept/core';
import type { PageComment, PmNode } from '@cept/core';
import { listPageComments } from './comment.js';
import { documentExtensions } from '../document-extensions.js';
import { editorBaseline, loadMarkdown, saveMarkdown } from '../markdown-bridge.js';

const author = { id: 'github:nsheaps', name: 'Nate' };

function comment(id: string, quote: string, extra: Partial<PageComment> = {}): PageComment {
  return {
    id,
    author,
    created: '2026-10-14T05:00:00Z',
    body: `About ${quote}`,
    anchor: { quote },
    ...extra,
  };
}

function open(markdown: string) {
  const loaded = loadMarkdown(markdown);
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: documentExtensions(),
    content: loaded.doc,
  });
  const baseline = editorBaseline(loaded.parsed, editor.getJSON() as PmNode);
  const save = () => saveMarkdown(editor.getJSON() as PmNode, baseline);
  const highlighted = () =>
    [...editor.view.dom.querySelectorAll('[data-comment-id].cept-comment-highlight')].map(
      (el) => `${el.getAttribute('data-comment-id')}:${el.textContent}`,
    );
  return { editor, save, highlighted };
}

/** Select the first occurrence of `text` in the document. */
function select(editor: Editor, text: string): void {
  let found: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found === null && node.isText && node.text!.includes(text)) {
      found = pos + node.text!.indexOf(text);
    }
  });
  if (found === null) throw new Error(`"${text}" not in the document`);
  editor.commands.setTextSelection({ from: found, to: found + text.length });
}

describe('comment node', () => {
  const page = `First paragraph.\n\nThe second line.\n\n${formatCommentMarker(comment('c-aaaaaaaaaa', 'second'))}\n\nLast.\n`;

  it('hides the marker, highlights the quote and saves the page unchanged', () => {
    const { editor, save, highlighted } = open(page);
    expect(editor.view.dom.querySelectorAll('.cept-comment-marker')).toHaveLength(1);
    expect(editor.view.dom.querySelector('.cept-raw-block')).toBeNull();
    expect(highlighted()).toEqual(['c-aaaaaaaaaa:second']);
    expect(save()).toBe(page);
    editor.destroy();
  });

  it('keeps the highlight on the quote while the text around it is edited', () => {
    const { editor, save, highlighted } = open(page);
    editor.commands.insertContentAt(1, 'Added words. ');
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' more');
    expect(highlighted()).toEqual(['c-aaaaaaaaaa:second']);
    expect(save()).toContain('"id":"c-aaaaaaaaaa"');
    editor.destroy();
  });

  it('detaches a comment whose text is gone, and still saves it', () => {
    const { editor, save, highlighted } = open(
      page.replace('The second line.', 'Something else entirely.'),
    );
    expect(highlighted()).toEqual([]);
    expect(save()).toContain('"id":"c-aaaaaaaaaa"');
    editor.destroy();
  });

  it('resolves a repeated quote in the block before the marker', () => {
    const text =
      `The word twice here. The word twice here.\n\n` +
      `${formatCommentMarker(comment('c-bbbbbbbbbb', 'twice', { anchor: { quote: 'twice', prefix: 'word ' } }))}\n\n` +
      `Other twice here.\n`;
    const { editor, highlighted } = open(text);
    expect(highlighted()).toEqual(['c-bbbbbbbbbb:twice']);
    editor.destroy();
  });

  it('keeps a marker that does not read as a raw block', () => {
    const bad = '<!-- cept:comment {nope} -->';
    const { editor, save } = open(`Text.\n\n${bad}\n`);
    expect(editor.view.dom.querySelector('.cept-raw-block')?.textContent).toBe(bad);
    expect(save()).toBe(`Text.\n\n${bad}\n`);
    editor.destroy();
  });
});

describe('addComment', () => {
  it('adds a marker after the block holding the selection', () => {
    const { editor, save, highlighted } = open('Alpha beta.\n\nGamma delta.\n');
    select(editor, 'beta');
    editor.commands.addComment({ author, body: 'Nice', created: '2026-10-14T06:00:00Z' });
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toMatch(/^c-[a-z0-9]{10}:beta$/);

    const { comments } = readPageComments(save());
    expect(comments).toHaveLength(1);
    expect(comments[0]!.comment).toMatchObject({
      author,
      body: 'Nice',
      created: '2026-10-14T06:00:00Z',
      anchor: { quote: 'beta', prefix: 'Alpha ', suffix: '.\nGamma delta.' },
    });
    // After the first paragraph, before the second.
    expect(save()).toMatch(/^Alpha beta\.\n\n<!-- cept:comment .* -->\n\nGamma delta\.\n$/);
    editor.destroy();
  });

  it('adds a page-level comment at the end when nothing is selected', () => {
    const { editor, save, highlighted } = open('Alpha.\n\nBeta.\n');
    editor.commands.setTextSelection(3);
    editor.commands.addComment({ author, body: 'Whole page' });
    expect(highlighted()).toEqual([]);
    const { comments } = readPageComments(save());
    expect(comments[0]!.comment.anchor).toBeUndefined();
    expect(save()).toMatch(/Beta\.\n\n<!-- cept:comment .* -->\n$/);
    editor.destroy();
  });

  it('puts a second comment on the same block after the first', () => {
    const { editor, save } = open('Alpha beta gamma.\n');
    select(editor, 'beta');
    editor.commands.addComment({ author, body: 'one' });
    select(editor, 'gamma');
    editor.commands.addComment({ author, body: 'two' });
    expect(readPageComments(save()).comments.map((c) => c.comment.body)).toEqual(['one', 'two']);
    editor.destroy();
  });

  it('anchors a selection that spans blocks', () => {
    const { editor, save, highlighted } = open('Alpha one.\n\nBeta two.\n');
    editor.commands.setTextSelection({ from: 7, to: 21 });
    editor.commands.addComment({ author, body: 'span' });
    const { comments } = readPageComments(save());
    expect(comments[0]!.comment.anchor?.quote).toBe('one.\nBeta two');
    expect(highlighted().length).toBeGreaterThan(0);
    editor.destroy();
  });

  it('keeps a line break inside a paragraph in the quote', () => {
    const { editor, save } = open('Alpha one  \nbeta two.\n');
    editor.commands.setTextSelection({ from: 7, to: 16 });
    editor.commands.addComment({ author, body: 'break' });
    expect(readPageComments(save()).comments[0]!.comment.anchor?.quote).toContain('\n');
    editor.destroy();
  });
});

describe('listPageComments', () => {
  const pageLevel = comment('c-bbbbbbbbbb', 'x', { anchor: undefined, body: 'About it all' });
  const gone = comment('c-cccccccccc', 'vanished text');
  const markdown = [
    'First paragraph.',
    'The second line.',
    formatCommentMarker(comment('c-aaaaaaaaaa', 'second')),
    formatCommentMarker(gone),
    formatCommentMarker(pageLevel),
  ].join('\n\n');

  it('lists the comments in page order, as anchored, detached or page-level', () => {
    const { editor } = open(`${markdown}\n`);
    expect(listPageComments(editor.state.doc).map((c) => [c.comment.id, c.kind])).toEqual([
      ['c-aaaaaaaaaa', 'anchored'],
      ['c-cccccccccc', 'detached'],
      ['c-bbbbbbbbbb', 'page'],
    ]);
    editor.destroy();
  });

  it('follows an edit that removes the quoted text', () => {
    const { editor } = open(`${markdown}\n`);
    editor.commands.setTextSelection({ from: 23, to: 29 });
    editor.commands.deleteSelection();
    expect(listPageComments(editor.state.doc)[0]).toMatchObject({
      comment: { id: 'c-aaaaaaaaaa' },
      kind: 'detached',
    });
    editor.destroy();
  });
});

describe('comment threads', () => {
  const root = comment('c-aaaaaaaaaa', 'second');
  const markdown = [
    'First paragraph.',
    'The second line.',
    formatCommentMarker(root),
    'Last.',
  ].join('\n\n');
  const bob = { id: 'github:bob', name: 'Bob' };

  const ids = (editor: Editor) => listPageComments(editor.state.doc).map((c) => c.comment.id);
  const saved = (save: () => string) => readPageComments(save()).comments.map((c) => c.comment);

  it('adds a reply after the thread and saves it with replyTo', () => {
    const { editor, save } = open(`${markdown}\n`);
    expect(
      editor.commands.replyToComment('c-aaaaaaaaaa', {
        author: bob,
        body: 'Agreed',
        created: '2026-10-14T06:00:00Z',
      }),
    ).toBe(true);
    const [first, reply] = saved(save);
    expect(first!.id).toBe('c-aaaaaaaaaa');
    expect(reply).toMatchObject({ body: 'Agreed', author: bob, replyTo: 'c-aaaaaaaaaa' });
    // A reply to a reply joins the same thread, after the earlier reply.
    editor.commands.replyToComment(reply!.id, { author, body: 'Thanks' });
    const all = saved(save);
    expect(all.map((c) => [c.body, c.replyTo])).toEqual([
      ['About second', undefined],
      ['Agreed', 'c-aaaaaaaaaa'],
      ['Thanks', 'c-aaaaaaaaaa'],
    ]);
    editor.destroy();
  });

  it('edits the body and records when', () => {
    const { editor, save } = open(`${markdown}\n`);
    editor.commands.editComment('c-aaaaaaaaaa', 'Changed', '2026-10-14T07:00:00Z');
    expect(saved(save)[0]).toMatchObject({ body: 'Changed', edited: '2026-10-14T07:00:00Z' });
    editor.destroy();
  });

  it('resolves and reopens a thread from any of its comments', () => {
    const { editor, save } = open(`${markdown}\n`);
    editor.commands.replyToComment('c-aaaaaaaaaa', { author: bob, body: 'Hi' });
    const reply = saved(save)[1]!;
    editor.commands.setCommentStatus(reply.id, 'resolved');
    expect(saved(save)[0]!.status).toBe('resolved');
    expect(saved(save)[1]!.status).toBeUndefined();
    editor.commands.setCommentStatus('c-aaaaaaaaaa', 'open');
    expect(saved(save)[0]!.status).toBe('open');
    editor.destroy();
  });

  it('deleting the first comment deletes its replies; deleting a reply keeps the rest', () => {
    const { editor, save } = open(`${markdown}\n`);
    editor.commands.replyToComment('c-aaaaaaaaaa', { author: bob, body: 'One' });
    editor.commands.replyToComment('c-aaaaaaaaaa', { author: bob, body: 'Two' });
    const [, one] = saved(save);
    editor.commands.deleteComment(one!.id);
    expect(saved(save).map((c) => c.body)).toEqual(['About second', 'Two']);
    editor.commands.deleteComment('c-aaaaaaaaaa');
    expect(ids(editor)).toEqual([]);
    expect(save()).not.toContain('cept:comment');
    editor.destroy();
  });

  it('refuses an unknown id', () => {
    const { editor } = open(`${markdown}\n`);
    expect(editor.commands.editComment('c-zzzzzzzzzz', 'x')).toBe(false);
    expect(editor.commands.deleteComment('c-zzzzzzzzzz')).toBe(false);
    expect(editor.commands.setCommentStatus('c-zzzzzzzzzz', 'resolved')).toBe(false);
    expect(editor.commands.replyToComment('c-zzzzzzzzzz', { author: bob, body: 'x' })).toBe(false);
    editor.destroy();
  });
});
