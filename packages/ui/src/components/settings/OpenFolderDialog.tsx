/**
 * OpenFolderDialog — shown when a picked folder is not itself a space
 * (REQ-WS-012, REQ-WS-019). It lists the spaces found in its subfolders, and
 * offers to make the folder a space, which writes its `space.cept.yaml`. That
 * file is the only thing Cept adds, and only when the user picks that option.
 */

import type { FolderSpaceChoice } from '../storage/folder-open.js';

export interface OpenFolderDialogProps {
  /** The picked folder's name. */
  folderName: string;
  /** Spaces found in its subfolders. */
  spaces: FolderSpaceChoice[];
  onOpenSpace: (space: FolderSpaceChoice) => void;
  /** Make the picked folder a space by adding its marker file. */
  onMakeSpace: () => void;
  onCancel: () => void;
}

export function OpenFolderDialog({
  folderName,
  spaces,
  onOpenSpace,
  onMakeSpace,
  onCancel,
}: OpenFolderDialogProps) {
  return (
    <div className="cept-wizard-overlay" onClick={onCancel} data-testid="open-folder-dialog">
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="open-folder-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="open-folder-title">Open “{folderName}”</h2>
        </div>
        <div className="cept-wizard-content">
          <div>
            {spaces.length > 0 ? (
              <>
                <p className="cept-wizard-desc">
                  This folder is not a space, but these folders in it are. Choose one to open.
                </p>
                <div className="cept-wizard-type-grid" data-testid="open-folder-spaces">
                  {spaces.map((space) => (
                    <button
                      key={space.path}
                      className="cept-wizard-type-card"
                      onClick={() => onOpenSpace(space)}
                      disabled={space.error !== undefined}
                      title={space.error}
                      data-testid={`open-folder-space-${space.path}`}
                    >
                      <div className="cept-wizard-type-card-text">
                        <span className="cept-wizard-type-card-title">{space.name}</span>
                        <span className="cept-wizard-type-card-desc">
                          {space.error ?? `${folderName}/${space.path}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="cept-wizard-desc">This folder is not a Cept space yet.</p>
            )}
            <p className="cept-wizard-desc">
              To use “{folderName}” itself as a space, Cept adds one file to it,{' '}
              <code>space.cept.yaml</code>. Nothing else in the folder is changed.
            </p>
            <div className="cept-wizard-footer">
              <button
                className="cept-wizard-cancel-btn"
                onClick={onCancel}
                data-testid="open-folder-cancel"
              >
                Cancel
              </button>
              <button
                className="cept-wizard-primary-btn"
                onClick={onMakeSpace}
                data-testid="open-folder-make-space"
              >
                Make “{folderName}” a space
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
