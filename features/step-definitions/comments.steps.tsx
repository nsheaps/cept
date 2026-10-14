import { useState } from 'react';
import { loadFeature, describeFeature } from '@amiceli/vitest-cucumber';
import type { Editor } from '@tiptap/core';
import { expect } from 'vitest';
import { CeptEditor, CommentsPanel, type CommentActions, type ListedComment } from '@cept/ui';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// jsdom has no layout; ProseMirror asks ranges for rectangles when it scrolls to the caret.
const noRects = { length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] };
Range.prototype.getClientRects ??= () => noRects as unknown as DOMRectList;
Range.prototype.getBoundingClientRect ??= () => new DOMRect();

const feature = await loadFeature('features/comments/comments.feature');

type EditorDom = HTMLElement & { editor: Editor };

const nate = { id: 'github:nsheaps', name: 'Nate' };
const commenting = { author: nate, chooseName: () => nate };

/** The editor and the comments panel, wired the way App wires them. */
function Page({ markdown, onUpdate }: { markdown: string; onUpdate: (md: string) => void }) {
  const [comments, setComments] = useState<ListedComment[]>([]);
  const [actions, setActions] = useState<CommentActions | null>(null);
  return (
    <>
      <CeptEditor
        content={markdown}
        commenting={commenting}
        onUpdate={onUpdate}
        onCommentsChange={setComments}
        onCommentActions={setActions}
      />
      <CommentsPanel
        comments={comments}
        lastVisit={null}
        meId={nate.id}
        onJump={() => undefined}
        actions={actions}
      />
    </>
  );
}

describeFeature(feature, ({ Background, Scenario, AfterEachScenario }) => {
  let editor: Editor;
  /** What the page would be saved as: the last Markdown the editor reported. */
  let markdown = '';

  const open = async (source: string) => {
    markdown = source;
    render(<Page markdown={source} onUpdate={(md) => (markdown = md)} />);
    const dom = await waitFor(() => {
      const el = screen
        .getByTestId('cept-editor')
        .querySelector<HTMLElement & { editor?: Editor }>('.tiptap');
      if (!el?.editor) throw new Error('editor not ready');
      return el as EditorDom;
    });
    editor = dom.editor;
  };

  const reload = async (source = markdown) => {
    cleanup();
    await open(source);
  };

  const select = (text: string) => {
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (at === -1 && node.isText && node.text!.includes(text)) {
        at = pos + node.text!.indexOf(text);
      }
    });
    expect(at).toBeGreaterThan(-1);
    act(() => {
      editor.commands.setTextSelection({ from: at, to: at + text.length });
    });
  };

  const submitComposer = async (body: string) => {
    await screen.findByTestId('comment-composer');
    fireEvent.change(screen.getByTestId('comment-body'), { target: { value: body } });
    fireEvent.click(screen.getByTestId('comment-submit'));
    await screen.findByTestId('comments-panel');
  };

  const commentOn = async (quote: string, body: string) => {
    select(quote);
    fireEvent.keyDown(screen.getByTestId('cept-editor').querySelector('.tiptap')!, {
      key: 'm',
      code: 'KeyM',
      ctrlKey: true,
      altKey: true,
    });
    await submitComposer(body);
  };

  /** The page's first thread and its comment id. */
  const firstThread = async () => {
    const element = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-testid^="thread-"]');
      if (!found) throw new Error('no thread');
      return found;
    });
    return { element, id: element.dataset['testid']!.replace(/^thread-/, '') };
  };

  const listsOnPage = async (body: string, quote: string) => {
    const group = within(await screen.findByTestId('comments-anchored'));
    expect(group.getByText(body)).toBeTruthy();
    expect(group.getByText(quote)).toBeTruthy();
  };

  AfterEachScenario(() => cleanup());

  Background(({ Given }) => {
    Given('I have a page {string} open with commenting as {string}', async (_ctx, text: string) => {
      await open(`${text}\n`);
    });
  });

  Scenario('Comment on selected text', ({ When, Then, And }) => {
    When('I select {string} and comment {string}', (_ctx, quote: string, body: string) =>
      commentOn(quote, body),
    );
    Then(
      'the comments panel should list {string} on the page, quoting {string}',
      (_ctx, body: string, quote: string) => listsOnPage(body, quote),
    );
    And('the page Markdown should contain a comment marker', () => {
      expect(markdown).toContain('<!-- cept:comment ');
    });
  });

  Scenario('Comment on the whole page', ({ When, Then }) => {
    When('I comment on the whole page with {string}', async (_ctx, body: string) => {
      fireEvent.click(screen.getByTestId('comment-on-page'));
      await submitComposer(body);
    });
    Then(
      'the comments panel should list {string} under {string}',
      async (_ctx, body: string, title: string) => {
        const heading = await screen.findByRole('heading', { name: title });
        expect(heading.parentElement!.textContent).toContain(body);
      },
    );
  });

  Scenario('Reply to a thread', ({ Given, When, Then }) => {
    Given('the page has a comment {string} on {string}', (_ctx, body: string, quote: string) =>
      commentOn(quote, body),
    );
    When('I reply {string} to that thread', async (_ctx, body: string) => {
      const { id } = await firstThread();
      fireEvent.click(screen.getByTestId(`thread-reply-${id}`));
      fireEvent.change(await screen.findByTestId(`thread-reply-input-${id}`), {
        target: { value: body },
      });
      fireEvent.click(screen.getByTestId(`thread-reply-send-${id}`));
    });
    Then(
      'the thread should show {string} followed by {string}',
      async (_ctx, first: string, second: string) => {
        const { element } = await firstThread();
        await waitFor(() => expect(element.textContent).toContain(second));
        const text = element.textContent!;
        expect(text.indexOf(first)).toBeGreaterThan(-1);
        expect(text.indexOf(first)).toBeLessThan(text.indexOf(second));
        expect(markdown).toContain('"replyTo"');
      },
    );
  });

  Scenario('Resolve and reopen a thread', ({ Given, When, Then }) => {
    Given('the page has a comment {string} on {string}', (_ctx, body: string, quote: string) =>
      commentOn(quote, body),
    );
    When('I resolve that thread', async () => {
      const { id } = await firstThread();
      fireEvent.click(screen.getByTestId(`thread-status-${id}`));
    });
    Then('the thread should be marked resolved', async () => {
      const { id } = await firstThread();
      expect(await screen.findByTestId(`thread-resolved-${id}`)).toBeTruthy();
      expect(markdown).toContain('"status":"resolved"');
    });
    When('I reopen that thread', async () => {
      const { id } = await firstThread();
      fireEvent.click(screen.getByTestId(`thread-status-${id}`));
    });
    Then('the thread should not be marked resolved', async () => {
      const { id } = await firstThread();
      await waitFor(() => expect(screen.queryByTestId(`thread-resolved-${id}`)).toBeNull());
    });
  });

  Scenario('Comments survive a reload', ({ Given, When, Then }) => {
    Given('the page has a comment {string} on {string}', (_ctx, body: string, quote: string) =>
      commentOn(quote, body),
    );
    When('I reload the page', () => reload());
    Then(
      'the comments panel should list {string} on the page, quoting {string}',
      (_ctx, body: string, quote: string) => listsOnPage(body, quote),
    );
  });

  Scenario('A comment whose text was removed is detached', ({ Given, When, Then }) => {
    Given('the page has a comment {string} on {string}', (_ctx, body: string, quote: string) =>
      commentOn(quote, body),
    );
    When(
      'the text {string} is removed from the page and the page is reloaded',
      (_ctx, text: string) => {
        // Edit the prose only: the marker line also quotes the text.
        const edited = markdown
          .split('\n')
          .map((line) => (line.startsWith('<!--') ? line : line.replace(`${text} `, '')))
          .join('\n');
        expect(edited).not.toBe(markdown);
        return reload(edited);
      },
    );
    Then(
      'the comments panel should list {string} under {string}',
      async (_ctx, body: string, title: string) => {
        const heading = await screen.findByRole('heading', { name: title });
        expect(heading.parentElement!.textContent).toContain(body);
      },
    );
  });
});
