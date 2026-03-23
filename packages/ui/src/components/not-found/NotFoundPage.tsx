/**
 * NotFoundPage — Displayed when a URL can't be resolved to a page or space.
 *
 * Shows a clear 404 message with the path that was attempted,
 * and provides navigation options (home, docs, back).
 */

export interface NotFoundPageProps {
  /** The URL path that couldn't be found */
  path?: string;
  /** Additional error message or context */
  message?: string;
  /** Navigate to the home/landing page */
  onGoHome: () => void;
  /** Navigate to the docs space */
  onGoToDocs: () => void;
}

export function NotFoundPage({ path, message, onGoHome, onGoToDocs }: NotFoundPageProps) {
  return (
    <div className="cept-not-found" data-testid="not-found-page">
      <div className="cept-not-found-content">
        <h1 className="cept-not-found-code">404</h1>
        <h2 className="cept-not-found-title">Page not found</h2>
        {path && (
          <p className="cept-not-found-path" data-testid="not-found-path">
            Could not find: <code>{path}</code>
          </p>
        )}
        {message && (
          <p className="cept-not-found-message" data-testid="not-found-message">
            {message}
          </p>
        )}
        <div className="cept-not-found-actions">
          <button
            className="cept-not-found-btn cept-not-found-btn--primary"
            onClick={onGoHome}
            data-testid="not-found-go-home"
          >
            Go to Home
          </button>
          <button
            className="cept-not-found-btn"
            onClick={onGoToDocs}
            data-testid="not-found-go-docs"
          >
            View Docs
          </button>
          <button
            className="cept-not-found-btn"
            onClick={() => window.history.back()}
            data-testid="not-found-go-back"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
