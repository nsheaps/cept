import { useState } from 'react';

export interface CommentComposerProps {
  /** The quoted text the comment is about; empty for a comment on the whole page. */
  quote: string;
  /** Ask for a display name first (nobody is signed in and none is saved on this device). */
  askName: boolean;
  /** Where to put the popover, in viewport coordinates. */
  position: { top: number; left: number };
  onSubmit: (input: { body: string; name: string }) => void;
  onCancel: () => void;
}

/** The popover for writing a comment (REQ-NTN-002). */
export function CommentComposer({
  quote,
  askName,
  position,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const bodyOk = body.trim() !== '';
  const nameOk = !askName || name.trim() !== '';

  const submit = () => {
    if (bodyOk && nameOk) onSubmit({ body: body.trim(), name: name.trim() });
  };

  return (
    <div
      className="cept-comment-composer"
      data-testid="comment-composer"
      role="dialog"
      aria-label={quote ? 'Comment on selection' : 'Comment on page'}
      style={{ top: position.top, left: position.left }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
    >
      {quote && (
        <blockquote className="cept-comment-composer-quote" data-testid="comment-quote">
          {quote.length > 120 ? `${quote.slice(0, 120)}…` : quote}
        </blockquote>
      )}
      {askName && (
        <label className="cept-comment-composer-field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shown next to your comments"
            data-testid="comment-name"
          />
        </label>
      )}
      <textarea
        className="cept-comment-composer-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={'Add a comment…'}
        rows={3}
        data-testid="comment-body"
        aria-label="Comment"
        autoFocus
      />
      <div className="cept-comment-composer-actions">
        <button type="button" onClick={onCancel} data-testid="comment-cancel">
          Cancel
        </button>
        <button
          type="button"
          className="cept-comment-composer-submit"
          onClick={submit}
          disabled={!bodyOk || !nameOk}
          data-testid="comment-submit"
        >
          Comment
        </button>
      </div>
    </div>
  );
}
