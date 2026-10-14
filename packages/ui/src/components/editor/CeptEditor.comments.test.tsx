import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { readPageComments } from '@cept/core';
import type { CommentAuthor } from '@cept/core';
import { CeptEditor, type CommentingContext } from './CeptEditor.js';

const nate: CommentAuthor = { id: 'github:nsheaps', name: 'Nate' };

async function open(
  content: string,
  commenting: CommentingContext | undefined,
  onUpdate?: (markdown: string) => void,
  editable = true,
) {
  const view = render(
    <CeptEditor
      content={content}
      editable={editable}
      {...(commenting ? { commenting } : {})}
      {...(onUpdate ? { onUpdate } : {})}
    />,
  );
  const dom = await waitFor(() => {
    const el = screen
      .getByTestId('cept-editor')
      .querySelector<HTMLElement & { editor?: Editor }>('.tiptap');
    if (!el?.editor) throw new Error('editor not ready');
    return el as HTMLElement & { editor: Editor };
  });
  return { ...view, editor: dom.editor, dom };
}

function select(editor: Editor, text: string) {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at === -1 && node.isText && node.text!.includes(text)) at = pos + node.text!.indexOf(text);
  });
  act(() => {
    editor.commands.setTextSelection({ from: at, to: at + text.length });
  });
}

describe('commenting in CeptEditor', () => {
  it('offers no comment controls without a commenting context', async () => {
    await open('Alpha beta.\n', undefined);
    expect(screen.queryByTestId('comment-on-page')).toBeNull();
  });

  it('offers none on a read-only page', async () => {
    await open('Alpha beta.\n', { author: nate, chooseName: vi.fn() }, undefined, false);
    expect(screen.queryByTestId('comment-on-page')).toBeNull();
  });

  it('comments on the selection with the Ctrl+Alt+M shortcut', async () => {
    const updates: string[] = [];
    const { editor, dom } = await open(
      'Alpha beta.\n\nGamma.\n',
      { author: nate, chooseName: vi.fn() },
      (md) => updates.push(md),
    );
    select(editor, 'beta');
    fireEvent.keyDown(dom, { key: 'm', code: 'KeyM', ctrlKey: true, altKey: true });

    expect(screen.getByTestId('comment-quote').textContent).toBe('beta');
    expect(screen.queryByTestId('comment-name')).toBeNull();
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: 'Nice word' } });
    fireEvent.click(screen.getByTestId('comment-submit'));

    expect(screen.queryByTestId('comment-composer')).toBeNull();
    const { comments } = readPageComments(updates.at(-1)!);
    expect(comments).toHaveLength(1);
    expect(comments[0]!.comment).toMatchObject({
      author: nate,
      body: 'Nice word',
      anchor: { quote: 'beta' },
    });
    expect(dom.querySelector('[data-comment-id].cept-comment-highlight')?.textContent).toBe('beta');
  });

  it('comments on the page when no text is selected', async () => {
    const updates: string[] = [];
    await open('Alpha.\n', { author: nate, chooseName: vi.fn() }, (md) => updates.push(md));
    fireEvent.click(screen.getByTestId('comment-on-page'));
    expect(screen.queryByTestId('comment-quote')).toBeNull();
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: 'About it all' } });
    fireEvent.click(screen.getByTestId('comment-submit'));

    const { comments } = readPageComments(updates.at(-1)!);
    expect(comments[0]!.comment.anchor).toBeUndefined();
    expect(comments[0]!.comment.body).toBe('About it all');
  });

  it('asks for a display name once, and rejects a blank one', async () => {
    const updates: string[] = [];
    const chooseName = vi.fn((name: string): CommentAuthor => ({ id: 'local:abc', name }));
    await open('Alpha.\n', { author: null, chooseName }, (md) => updates.push(md));
    fireEvent.click(screen.getByTestId('comment-on-page'));
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: 'Hello' } });

    const submit = screen.getByTestId<HTMLButtonElement>('comment-submit');
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('comment-name'), { target: { value: '   ' } });
    expect(submit.disabled).toBe(true);
    expect(chooseName).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('comment-name'), { target: { value: ' Sam ' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(chooseName).toHaveBeenCalledWith('Sam');
    expect(readPageComments(updates.at(-1)!).comments[0]!.comment.author).toEqual({
      id: 'local:abc',
      name: 'Sam',
    });
  });

  it('cancels with Escape and writes nothing', async () => {
    const updates: string[] = [];
    await open('Alpha.\n', { author: nate, chooseName: vi.fn() }, (md) => updates.push(md));
    fireEvent.click(screen.getByTestId('comment-on-page'));
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: 'Never mind' } });
    fireEvent.keyDown(screen.getByTestId('comment-composer'), { key: 'Escape' });
    expect(screen.queryByTestId('comment-composer')).toBeNull();
    expect(updates).toEqual([]);
  });

  it('keeps the anchor and author when the saved page is opened again', async () => {
    const updates: string[] = [];
    const first = await open('Alpha beta.\n', { author: nate, chooseName: vi.fn() }, (md) =>
      updates.push(md),
    );
    select(first.editor, 'beta');
    fireEvent.keyDown(first.dom, { key: 'm', code: 'KeyM', metaKey: true, altKey: true });
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: 'Persisted' } });
    fireEvent.click(screen.getByTestId('comment-submit'));
    first.unmount();

    const second = await open(updates.at(-1)!, { author: nate, chooseName: vi.fn() });
    expect(second.dom.querySelector('[data-comment-id].cept-comment-highlight')?.textContent).toBe(
      'beta',
    );
  });
});
