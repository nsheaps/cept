/**
 * DeleteFileDialog — asks before a file that is not a page (an image, an
 * attachment) is deleted from the space (phase-1 plan PR 55b). Deleting is not
 * undoable from the app and links to the file will point at nothing.
 */

export interface DeleteFileDialogProps {
  /** The file's name. */
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteFileDialog({ name, onConfirm, onCancel }: DeleteFileDialogProps) {
  return (
    <div className="cept-wizard-overlay" onClick={onCancel} data-testid="delete-file-dialog">
      <div
        className="cept-wizard-dialog"
        role="dialog"
        aria-labelledby="delete-file-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cept-wizard-header">
          <h2 id="delete-file-title">Delete “{name}”?</h2>
        </div>
        <div className="cept-wizard-content">
          <p className="cept-wizard-desc">
            The file is removed from the space. Links to it will stop working.
          </p>
        </div>
        <div className="cept-wizard-footer">
          <button
            className="cept-wizard-cancel-btn"
            onClick={onCancel}
            data-testid="delete-file-cancel"
          >
            Cancel
          </button>
          <button
            className="cept-wizard-primary-btn"
            onClick={onConfirm}
            data-testid="delete-file-confirm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
