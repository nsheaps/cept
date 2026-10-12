import type { Backlink } from '../storage/folder-space.js';

export interface BacklinksPanelProps {
  /** The pages that link to the open page. */
  backlinks: readonly Backlink[];
  /** Open a linking page. */
  onNavigate: (pageId: string) => void;
}

/** The pages that link to the open page (REQ-EDT-020), shown under its content. */
export function BacklinksPanel({ backlinks, onNavigate }: BacklinksPanelProps) {
  if (backlinks.length === 0) return null;
  return (
    <section className="cept-backlinks" data-testid="backlinks-panel" aria-label="Backlinks">
      <h2 className="cept-backlinks-title" data-testid="backlinks-count">
        {backlinks.length} {backlinks.length === 1 ? 'backlink' : 'backlinks'}
      </h2>
      <ul className="cept-backlinks-list">
        {backlinks.map((backlink) => (
          <li key={backlink.source}>
            <button
              type="button"
              className="cept-backlink"
              onClick={() => onNavigate(backlink.source)}
              data-testid={`backlink-${backlink.source}`}
            >
              <span className="cept-backlink-title">{backlink.title}</span>
              {backlink.snippets.length > 0 && (
                <span className="cept-backlink-snippets">{backlink.snippets.join(' · ')}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
