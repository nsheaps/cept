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
