import { useState } from 'react';
import type { ListedComment } from '../editor/extensions/comment.js';
import type { CommentActions } from '../editor/CeptEditor.js';
import { isNewComment } from './comment-visits.js';

export interface CommentsPanelProps {
  /** The page's comments in document order. */
  comments: readonly ListedComment[];
  /** When the page was last opened on this device; comments after it are new. */
  lastVisit: string | null;
  /** The signed-in author's id, so your own comments do not count as new. */
  meId: string | null;
  /** Scroll the page to a comment's highlighted text. */
  onJump: (commentId: string) => void;
  /** Reply, edit, delete and resolve; without it the panel only lists. */
  actions?: CommentActions | null;
  /** Replying needs a display name because no account or saved name exists yet. */
  askName?: boolean;
}

const GROUPS = [
  { kind: 'anchored', title: 'On the page' },
  { kind: 'page', title: 'About the whole page' },
  { kind: 'detached', title: 'Detached' },
] as const;

type Filter = 'all' | 'open' | 'resolved';

function when(created: string): string {
  const at = new Date(created);
  return Number.isNaN(at.getTime()) ? created : at.toLocaleString();
}

/** A thread: its first comment and the replies to it, in page order. */
interface Thread {
  root: ListedComment;
  replies: ListedComment[];
}

function threadsOf(comments: readonly ListedComment[]): Thread[] {
  const byId = new Map(comments.map((entry) => [entry.comment.id, entry]));
  const rootIdOf = (id: string): string => {
    let current = id;
    for (let hops = 0; hops < comments.length; hops++) {
      const parent = byId.get(current)?.comment.replyTo;
      if (!parent || !byId.has(parent)) return current;
      current = parent;
    }
    return current;
  };
  const threads = new Map<string, Thread>();
  for (const entry of comments) {
    const parent = entry.comment.replyTo;
    // A reply whose first comment is gone stands as a comment of its own.
    if (!parent || !byId.has(parent)) threads.set(entry.comment.id, { root: entry, replies: [] });
  }
  for (const entry of comments) {
    const parent = entry.comment.replyTo;
    if (parent && byId.has(parent)) threads.get(rootIdOf(parent))?.replies.push(entry);
  }
  return [...threads.values()];
}

/**
 * The comments of the open page, shown under its content (REQ-NTN-008): those on
 * text, those about the whole page, and those whose text has been removed, as
 * threads that can be answered, edited, deleted and resolved.
 */
export function CommentsPanel({
  comments,
  lastVisit,
  meId,
  onJump,
  actions = null,
  askName = false,
}: CommentsPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  if (comments.length === 0) return null;

  const fresh = new Set(
    comments
      .filter((entry) => isNewComment(entry, lastVisit, meId))
      .map(({ comment }) => comment.id),
  );
  const threads = threadsOf(comments);
  const resolvedCount = threads.filter((t) => t.root.comment.status === 'resolved').length;
  const shown = threads.filter((t) => {
    const resolved = t.root.comment.status === 'resolved';
    return filter === 'all' || (filter === 'resolved' ? resolved : !resolved);
  });

  const close = () => {
    setReplyingTo(null);
    setEditing(null);
    setDraft('');
  };

  const renderComment = ({ comment }: ListedComment, kind: string, isRoot: boolean) => (
    <li key={comment.id} className="cept-comment-item" data-testid={`comment-${comment.id}`}>
      <div className="cept-comment-meta">
        <span className="cept-comment-author" data-testid={`comment-author-${comment.id}`}>
          {comment.author.id.startsWith('agent:')
            ? `${comment.author.name} (agent)`
            : comment.author.name}
        </span>
        <time dateTime={comment.created}>{when(comment.created)}</time>
        {comment.edited && (
          <span className="cept-comment-edited" title={`Edited ${when(comment.edited)}`}>
            (edited)
          </span>
        )}
        {fresh.has(comment.id) && (
          <span className="cept-comment-new" data-testid={`comment-new-${comment.id}`}>
            New
          </span>
        )}
      </div>
      {isRoot &&
        comment.anchor &&
        (kind === 'anchored' ? (
          <button
            type="button"
            className="cept-comment-quote"
            onClick={() => onJump(comment.id)}
            data-testid={`comment-jump-${comment.id}`}
            aria-label={`Jump to “${comment.anchor.quote}”`}
          >
            {comment.anchor.quote}
          </button>
        ) : (
          <blockquote className="cept-comment-quote">{comment.anchor.quote}</blockquote>
        ))}
      {isRoot && kind === 'detached' && (
        <p className="cept-comment-detached-note">The commented text was removed from the page.</p>
      )}
      {editing === comment.id ? (
        <form
          className="cept-comment-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) actions?.edit(comment.id, draft.trim());
            close();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Edit comment"
            data-testid={`comment-edit-input-${comment.id}`}
            autoFocus
          />
          <button type="submit" data-testid={`comment-edit-save-${comment.id}`}>
            Save
          </button>
          <button type="button" onClick={close}>
            Cancel
          </button>
        </form>
      ) : (
        <p className="cept-comment-body">{comment.body}</p>
      )}
      {actions && editing !== comment.id && (
        <div className="cept-comment-actions">
          {comment.author.id === meId && (
            <>
              <button
                type="button"
                data-testid={`comment-edit-${comment.id}`}
                onClick={() => {
                  close();
                  setEditing(comment.id);
                  setDraft(comment.body);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                data-testid={`comment-delete-${comment.id}`}
                aria-label={isRoot ? 'Delete thread' : 'Delete reply'}
                onClick={() => actions.remove(comment.id)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );

  return (
    <section className="cept-comments" data-testid="comments-panel" aria-label="Comments">
      <h2 className="cept-comments-title">
        <span data-testid="comments-count">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
        {fresh.size > 0 && (
          <span className="cept-comments-new-badge" data-testid="comments-new-badge">
            {fresh.size} new
          </span>
        )}
      </h2>
      {resolvedCount > 0 && (
        <div className="cept-comments-filter" role="group" aria-label="Show comments">
          {(['all', 'open', 'resolved'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              data-testid={`comments-filter-${value}`}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'open' ? 'Open' : `Resolved (${resolvedCount})`}
            </button>
          ))}
        </div>
      )}
      {GROUPS.map(({ kind, title }) => {
        const group = shown.filter((thread) => thread.root.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} data-testid={`comments-${kind}`}>
            <h3 className="cept-comments-group">{title}</h3>
            <ul className="cept-comments-list">
              {group.map((thread) => {
                const rootId = thread.root.comment.id;
                const resolved = thread.root.comment.status === 'resolved';
                return (
                  <li key={rootId} className="cept-comment-thread" data-testid={`thread-${rootId}`}>
                    <ul className="cept-comments-list">
                      {renderComment(thread.root, kind, true)}
                      {thread.replies.map((reply) => renderComment(reply, kind, false))}
                    </ul>
                    {resolved && (
                      <span
                        className="cept-comment-resolved"
                        data-testid={`thread-resolved-${rootId}`}
                      >
                        Resolved
                      </span>
                    )}
                    {actions && (
                      <div className="cept-comment-actions">
                        <button
                          type="button"
                          data-testid={`thread-reply-${rootId}`}
                          onClick={() => {
                            close();
                            setReplyingTo(rootId);
                          }}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          data-testid={`thread-status-${rootId}`}
                          onClick={() => actions.setStatus(rootId, resolved ? 'open' : 'resolved')}
                        >
                          {resolved ? 'Reopen' : 'Resolve'}
                        </button>
                      </div>
                    )}
                    {actions && replyingTo === rootId && (
                      <form
                        className="cept-comment-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (!draft.trim() || (askName && !name.trim())) return;
                          actions.reply(rootId, draft.trim(), name);
                          close();
                        }}
                      >
                        {askName && (
                          <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Your name"
                            aria-label="Your name"
                            data-testid={`thread-reply-name-${rootId}`}
                          />
                        )}
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          aria-label="Reply"
                          data-testid={`thread-reply-input-${rootId}`}
                          autoFocus
                        />
                        <button type="submit" data-testid={`thread-reply-send-${rootId}`}>
                          Reply
                        </button>
                        <button type="button" onClick={close}>
                          Cancel
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
