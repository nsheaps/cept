import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PageComment } from '@cept/core';
import type { ListedComment } from '../editor/extensions/comment.js';
import { CommentsPanel } from './CommentsPanel.js';

const nate = { id: 'github:nsheaps', name: 'Nate' };
const agent = { id: 'agent:jack', name: 'Jack' };

function item(
  id: string,
  kind: ListedComment['kind'],
  extra: Partial<PageComment> = {},
): ListedComment {
  return {
    kind,
    comment: {
      id,
      author: nate,
      created: '2026-10-14T05:00:00Z',
      body: `Body of ${id}`,
      ...(kind === 'page' ? {} : { anchor: { quote: `quote of ${id}` } }),
      ...extra,
    },
  };
}

describe('CommentsPanel', () => {
  it('renders nothing for a page without comments', () => {
    const { container } = render(
      <CommentsPanel comments={[]} lastVisit={null} meId={null} onJump={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('groups comments as on the page, about the whole page, and detached', () => {
    render(
      <CommentsPanel
        comments={[item('c-1', 'anchored'), item('c-2', 'page'), item('c-3', 'detached')]}
        lastVisit={null}
        meId={null}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comments-count').textContent).toBe('3 comments');
    const anchored = screen.getByTestId('comments-anchored');
    expect(within(anchored).getByText('Body of c-1')).toBeTruthy();
    expect(within(anchored).getByText('quote of c-1')).toBeTruthy();
    expect(within(screen.getByTestId('comments-page')).getByText('Body of c-2')).toBeTruthy();
    const detached = screen.getByTestId('comments-detached');
    expect(within(detached).getByText('Body of c-3')).toBeTruthy();
    expect(within(detached).getByText(/text was removed/i)).toBeTruthy();
  });

  it('leaves out a group with no comments', () => {
    render(
      <CommentsPanel
        comments={[item('c-1', 'anchored')]}
        lastVisit={null}
        meId={null}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comments-count').textContent).toBe('1 comment');
    expect(screen.queryByTestId('comments-page')).toBeNull();
    expect(screen.queryByTestId('comments-detached')).toBeNull();
  });

  it('jumps to a comment on the page when its quote is clicked, and only then', () => {
    const onJump = vi.fn();
    render(
      <CommentsPanel
        comments={[item('c-1', 'anchored'), item('c-2', 'page'), item('c-3', 'detached')]}
        lastVisit={null}
        meId={null}
        onJump={onJump}
      />,
    );
    fireEvent.click(screen.getByTestId('comment-jump-c-1'));
    expect(onJump).toHaveBeenCalledWith('c-1');
    expect(screen.queryByTestId('comment-jump-c-2')).toBeNull();
    expect(screen.queryByTestId('comment-jump-c-3')).toBeNull();
  });

  it('names the quote button so it reads as an action', () => {
    render(
      <CommentsPanel
        comments={[item('c-1', 'anchored')]}
        lastVisit={null}
        meId={null}
        onJump={vi.fn()}
      />,
    );
    const quote = screen.getByTestId('comment-jump-c-1');
    expect(quote.getAttribute('aria-label')).toBe(`Jump to “${quote.textContent}”`);
  });

  it('marks comments by others since the last visit as new, and the count in the title', () => {
    render(
      <CommentsPanel
        comments={[
          item('c-old', 'page', { author: agent, created: '2026-10-01T00:00:00Z' }),
          item('c-new', 'page', { author: agent, created: '2026-10-13T00:00:00Z' }),
          item('c-mine', 'page', { created: '2026-10-13T00:00:00Z' }),
        ]}
        lastVisit="2026-10-10T00:00:00Z"
        meId={nate.id}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comments-new-badge').textContent).toBe('1 new');
    expect(screen.getByTestId('comment-new-c-new')).toBeTruthy();
    expect(screen.queryByTestId('comment-new-c-old')).toBeNull();
    expect(screen.queryByTestId('comment-new-c-mine')).toBeNull();
  });

  it('shows no badge on a first visit', () => {
    render(
      <CommentsPanel
        comments={[item('c-1', 'page', { author: agent })]}
        lastVisit={null}
        meId={nate.id}
        onJump={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('comments-new-badge')).toBeNull();
  });

  it('labels agent authors', () => {
    render(
      <CommentsPanel
        comments={[item('c-1', 'page', { author: agent })]}
        lastVisit={null}
        meId={null}
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByTestId('comment-author-c-1').textContent).toBe('Jack (agent)');
  });
});

describe('CommentsPanel threads', () => {
  const bob = { id: 'github:bob', name: 'Bob' };
  const actions = () => ({
    reply: vi.fn(),
    edit: vi.fn(),
    remove: vi.fn(),
    setStatus: vi.fn(),
  });
  const thread = [
    item('c-1', 'anchored'),
    item('c-2', 'page', { author: bob, replyTo: 'c-1' }),
    item('c-3', 'anchored', { status: 'resolved' }),
  ];
  const panel = (a: ReturnType<typeof actions> | null, meId: string | null = nate.id) =>
    render(
      <CommentsPanel comments={thread} lastVisit={null} meId={meId} onJump={vi.fn()} actions={a} />,
    );

  it('shows a reply under the thread it answers, not as a page comment', () => {
    panel(null);
    expect(within(screen.getByTestId('thread-c-1')).getByText('Body of c-2')).toBeTruthy();
    expect(screen.queryByTestId('comments-page')).toBeNull();
    expect(screen.queryByTestId('thread-reply-c-1')).toBeNull();
  });

  it('replies to a thread with the typed name when none is known', () => {
    const a = actions();
    render(
      <CommentsPanel
        comments={thread}
        lastVisit={null}
        meId={null}
        onJump={vi.fn()}
        actions={a}
        askName
      />,
    );
    fireEvent.click(screen.getByTestId('thread-reply-c-1'));
    fireEvent.change(screen.getByTestId('thread-reply-input-c-1'), { target: { value: ' Hi ' } });
    fireEvent.click(screen.getByTestId('thread-reply-send-c-1'));
    expect(a.reply).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('thread-reply-name-c-1'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByTestId('thread-reply-send-c-1'));
    expect(a.reply).toHaveBeenCalledWith('c-1', 'Hi', 'Sam');
    expect(screen.queryByTestId('thread-reply-input-c-1')).toBeNull();
  });

  it('edits and deletes only your own comments', () => {
    const a = actions();
    panel(a);
    expect(screen.queryByTestId('comment-edit-c-2')).toBeNull();
    expect(screen.queryByTestId('comment-delete-c-2')).toBeNull();
    fireEvent.click(screen.getByTestId('comment-edit-c-1'));
    fireEvent.change(screen.getByTestId('comment-edit-input-c-1'), { target: { value: 'New' } });
    fireEvent.click(screen.getByTestId('comment-edit-save-c-1'));
    expect(a.edit).toHaveBeenCalledWith('c-1', 'New');
    fireEvent.click(screen.getByTestId('comment-delete-c-1'));
    expect(a.remove).toHaveBeenCalledWith('c-1');
  });

  it('resolves and reopens a thread, and filters by state', () => {
    const a = actions();
    panel(a);
    fireEvent.click(screen.getByTestId('thread-status-c-1'));
    expect(a.setStatus).toHaveBeenCalledWith('c-1', 'resolved');
    expect(screen.getByTestId('thread-status-c-3').textContent).toBe('Reopen');
    fireEvent.click(screen.getByTestId('thread-status-c-3'));
    expect(a.setStatus).toHaveBeenCalledWith('c-3', 'open');

    fireEvent.click(screen.getByTestId('comments-filter-open'));
    expect(screen.queryByTestId('thread-c-3')).toBeNull();
    expect(screen.getByTestId('thread-c-1')).toBeTruthy();
    fireEvent.click(screen.getByTestId('comments-filter-resolved'));
    expect(screen.getByTestId('thread-c-3')).toBeTruthy();
    expect(screen.queryByTestId('thread-c-1')).toBeNull();
    expect(screen.getByTestId('thread-resolved-c-3')).toBeTruthy();
  });
});
