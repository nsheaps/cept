/**
 * The "Discovered on GitHub" part of Settings > Spaces (REQ-WS-023): spaces in
 * the signed-in account's repositories that are not on this device yet, each
 * with Open and Pin, and spaces on this device whose repository can no longer
 * be read. Listing a space clones nothing; Open and Pin do.
 */

import type { LostSpace, RemoteSpace } from '@cept/core';
import { discoveredSpaceId } from './discovered-spaces.js';
import type { DiscoveredSpacesState } from './discovered-spaces.js';

export interface DiscoveredSpacesSectionProps {
  discovered: DiscoveredSpacesState;
  /** Ids of the spaces already on this device. */
  addedSpaceIds: ReadonlySet<string>;
  /** Clone the space, add it and switch to it. */
  onOpen?: (space: RemoteSpace) => void;
  /** Clone the space and add it without switching to it. */
  onPin?: (space: RemoteSpace) => void;
}

const LOST_REASON: Record<LostSpace['reason'], string> = {
  access: 'This account can no longer read the repository.',
  removed: 'The space was removed from the repository.',
  excluded: 'The repository is now archived or a fork, so it is no longer searched.',
};

function location(space: RemoteSpace): string {
  return space.path ? `${space.repo}/${space.path}` : space.repo;
}

function formatChecked(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

export function DiscoveredSpacesSection({
  discovered,
  addedSpaceIds,
  onOpen,
  onPin,
}: DiscoveredSpacesSectionProps) {
  const { status, snapshot, error } = discovered;
  const notAdded = (snapshot?.spaces ?? []).filter((s) => !addedSpaceIds.has(discoveredSpaceId(s)));
  // Only spaces on this device are worth flagging; the copy here is kept.
  const lostHere = (snapshot?.lost ?? []).filter((l) =>
    addedSpaceIds.has(discoveredSpaceId(l.space)),
  );
  const skipped = (snapshot?.warnings ?? []).filter((w) => w.kind !== 'rate-limited');
  const running = status === 'running';

  return (
    <div data-testid="discovered-spaces">
      <div className="cept-settings-section-divider" />
      <div className="cept-settings-discovered-header">
        <h3 className="cept-settings-section-title">Discovered on GitHub</h3>
        <button
          className="cept-settings-action-btn"
          onClick={discovered.refresh}
          disabled={running}
          data-testid="discovered-refresh"
        >
          {running ? 'Looking…' : 'Look again'}
        </button>
      </div>
      <p className="cept-settings-toggle-desc">
        Spaces in the repositories your token can read. Nothing is downloaded until you open or pin
        one.
      </p>

      {running && !snapshot && (
        <p className="cept-settings-toggle-desc" data-testid="discovered-running">
          Looking for spaces in your repositories…
        </p>
      )}

      {error && (
        <p className="cept-settings-github-error" role="alert" data-testid="discovered-error">
          Could not look for spaces: {error}
        </p>
      )}

      {snapshot && !snapshot.complete && (
        <p className="cept-settings-toggle-desc" data-testid="discovered-incomplete">
          GitHub&apos;s rate limit ran out before every repository was checked. Look again later to
          find the rest.
        </p>
      )}

      {snapshot && notAdded.length === 0 && (
        <p className="cept-settings-empty" data-testid="discovered-empty">
          {snapshot.spaces.length === 0
            ? 'No spaces found in your repositories.'
            : 'Every space found is already on this device.'}
        </p>
      )}

      {notAdded.length > 0 && (
        <div className="cept-settings-space-list" data-testid="discovered-list">
          {notAdded.map((space) => {
            const id = discoveredSpaceId(space);
            const blocked = space.errors.length > 0;
            return (
              <div
                key={id}
                className="cept-settings-space-row"
                data-testid={`discovered-space-${id}`}
              >
                <div className="cept-settings-space-info-block">
                  <div className="cept-settings-space-info">
                    <span className="cept-settings-space-name">
                      {space.name}
                      {space.private && (
                        <span className="cept-settings-space-badge"> (private)</span>
                      )}
                    </span>
                    <span className="cept-settings-space-meta">
                      {location(space)} &middot; {space.branch}
                    </span>
                    {blocked && (
                      <span
                        className="cept-settings-github-error"
                        data-testid={`discovered-errors-${id}`}
                      >
                        {space.errors.join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="cept-settings-space-actions">
                  <button
                    className="cept-settings-action-btn"
                    onClick={() => onOpen?.(space)}
                    disabled={blocked || !onOpen}
                    title="Download this space and switch to it"
                    data-testid={`discovered-open-${id}`}
                  >
                    Open
                  </button>
                  <button
                    className="cept-settings-action-btn"
                    onClick={() => onPin?.(space)}
                    disabled={blocked || !onPin}
                    title="Download this space and add it to your spaces"
                    data-testid={`discovered-pin-${id}`}
                  >
                    Pin
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lostHere.length > 0 && (
        <div data-testid="discovered-lost">
          <p className="cept-settings-toggle-name">No longer found on GitHub</p>
          <ul className="cept-settings-discovered-notes">
            {lostHere.map((l) => (
              <li
                key={discoveredSpaceId(l.space)}
                data-testid={`discovered-lost-${discoveredSpaceId(l.space)}`}
              >
                <strong>{l.space.name}</strong> ({location(l.space)}): {LOST_REASON[l.reason]} The
                copy on this device is kept.
              </li>
            ))}
          </ul>
        </div>
      )}

      {skipped.length > 0 && (
        <details data-testid="discovered-warnings">
          <summary className="cept-settings-toggle-desc">
            {skipped.length === 1 ? '1 note' : `${skipped.length} notes`} from the last look
          </summary>
          <ul className="cept-settings-discovered-notes">
            {skipped.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      {snapshot?.checkedAt && (
        <p className="cept-settings-toggle-desc" data-testid="discovered-checked">
          Last looked {formatChecked(snapshot.checkedAt)}
        </p>
      )}
    </div>
  );
}
