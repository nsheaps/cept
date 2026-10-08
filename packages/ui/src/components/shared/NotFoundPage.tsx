export interface NotFoundPageProps {
  /** The path that was asked for. */
  path: string;
  /** Leave the page and go back to the space. */
  onGoHome: () => void;
}

/** Shown when a URL names a page or space that does not exist. */
export function NotFoundPage({ path, onGoHome }: NotFoundPageProps) {
  return (
    <div className="cept-space-error" data-testid="not-found">
      <svg
        width="32"
        height="32"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="7" cy="7" r="5" />
        <path d="M11 11l4 4" />
      </svg>
      <h2>Page not found</h2>
      <p>
        Nothing here matches <code data-testid="not-found-path">{path}</code>. The page may have
        been moved, renamed or deleted, or the link may be wrong.
      </p>
      <div className="cept-space-error-actions">
        <button className="cept-space-error-btn" onClick={onGoHome} data-testid="not-found-home">
          Back to my pages
        </button>
      </div>
    </div>
  );
}
