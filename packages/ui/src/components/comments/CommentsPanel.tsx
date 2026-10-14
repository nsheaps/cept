import type { ListedComment } from '../editor/extensions/comment.js';
import { countNewComments } from './comment-visits.js';

export interface CommentsPanelProps {
  /** The page's comments in document order. */
  comments: readonly ListedComment[];
  /** When the page was last opened on this device; comments after it are new. */
  lastVisit: string | null;
  /** The signed-in author's id, so your own comments do not count as new. */
  meId: string | null;
  /** Scroll the page to a comment's highlighted text. */
  onJump: (commentId: string) => void;
}

const GROUPS = [
  { kind: 'anchored', title: 'On the page' },
  { kind: 'page', title: 'About the whole page' },
  { kind: 'detached', title: 'Detached' },
] as const;

function when(created: string): string {
  const at = new Date(created);
  return Number.isNaN(at.getTime()) ? created : at.toLocaleString();
}

/**
 * The comments of the open page, shown under its content (REQ-NTN-008): those on
 * text, those about the whole page, and those whose text has been removed.
 */
export function CommentsPanel({ comments, lastVisit, meId, onJump }: CommentsPanelProps) {
  if (comments.length === 0) return null;
  const fresh = new Set(
    comments
      .filter((entry) => countNewComments([entry], lastVisit, meId) > 0)
      .map(({ comment }) => comment.id),
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
      {GROUPS.map(({ kind, title }) => {
        const group = comments.filter((entry) => entry.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} data-testid={`comments-${kind}`}>
            <h3 className="cept-comments-group">{title}</h3>
            <ul className="cept-comments-list">
              {group.map(({ comment }) => (
                <li key={comment.id} className="cept-comment-item">
                  <div className="cept-comment-meta">
                    <span
                      className="cept-comment-author"
                      data-testid={`comment-author-${comment.id}`}
                    >
                      {comment.author.id.startsWith('agent:')
                        ? `${comment.author.name} (agent)`
                        : comment.author.name}
                    </span>
                    <time dateTime={comment.created}>{when(comment.created)}</time>
                    {fresh.has(comment.id) && (
                      <span className="cept-comment-new" data-testid={`comment-new-${comment.id}`}>
                        New
                      </span>
                    )}
                  </div>
                  {comment.anchor &&
                    (kind === 'anchored' ? (
                      <button
                        type="button"
                        className="cept-comment-quote"
                        onClick={() => onJump(comment.id)}
                        data-testid={`comment-jump-${comment.id}`}
                      >
                        {comment.anchor.quote}
                      </button>
                    ) : (
                      <blockquote className="cept-comment-quote">{comment.anchor.quote}</blockquote>
                    ))}
                  {kind === 'detached' && (
                    <p className="cept-comment-detached-note">
                      The commented text was removed from the page.
                    </p>
                  )}
                  <p className="cept-comment-body">{comment.body}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
