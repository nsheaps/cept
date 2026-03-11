import { useState, useCallback } from 'react';

export interface AddSpaceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSpace: (name: string) => void;
  onAddRemoteDocs?: () => void;
  hasRemoteDocs?: boolean;
}

type WizardStep = 'choose-type' | 'create-empty' | 'add-remote';

export function AddSpaceWizardModal({
  isOpen,
  onClose,
  onCreateSpace,
  onAddRemoteDocs,
  hasRemoteDocs,
}: AddSpaceWizardModalProps) {
  const [step, setStep] = useState<WizardStep>('choose-type');
  const [newSpaceName, setNewSpaceName] = useState('');

  const resetAndClose = useCallback(() => {
    setStep('choose-type');
    setNewSpaceName('');
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(() => {
    if (newSpaceName.trim()) {
      onCreateSpace(newSpaceName.trim());
      resetAndClose();
    }
  }, [newSpaceName, onCreateSpace, resetAndClose]);

  const handleBack = useCallback(() => {
    if (step === 'create-empty' || step === 'add-remote') {
      setStep('choose-type');
      setNewSpaceName('');
    } else {
      resetAndClose();
    }
  }, [step, resetAndClose]);

  if (!isOpen) return null;

  return (
    <div className="cept-wizard-overlay" data-testid="add-space-wizard-modal">
      <div className="cept-wizard-dialog">
        <div className="cept-wizard-header">
          <button
            className="cept-wizard-back-btn"
            onClick={handleBack}
            data-testid="wizard-back"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4l-4 4 4 4" />
            </svg>
            {step === 'choose-type' ? 'Cancel' : 'Back'}
          </button>
          <h2>
            {step === 'choose-type' && 'New Space'}
            {step === 'create-empty' && 'Create Empty Space'}
            {step === 'add-remote' && 'Add from Remote'}
          </h2>
          <button
            className="cept-wizard-close"
            onClick={resetAndClose}
            data-testid="wizard-close"
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="cept-wizard-content">
          {step === 'choose-type' && (
            <div data-testid="wizard-type-chooser">
              <p className="cept-wizard-desc">
                Choose how you want to create your new space.
              </p>
              <div className="cept-wizard-type-cards">
                <button
                  className="cept-wizard-type-card"
                  onClick={() => setStep('create-empty')}
                  data-testid="wizard-choose-empty"
                >
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="1" width="12" height="14" rx="1" />
                    <path d="M5 5h6M5 8h6M5 11h3" />
                  </svg>
                  <div className="cept-wizard-type-card-text">
                    <span className="cept-wizard-type-card-title">Empty space</span>
                    <span className="cept-wizard-type-card-desc">Create a new blank space with local browser storage</span>
                  </div>
                </button>
                <button
                  className="cept-wizard-type-card"
                  onClick={() => setStep('add-remote')}
                  data-testid="wizard-choose-remote"
                >
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M2 6h12M2 10h12" />
                    <ellipse cx="8" cy="8" rx="3" ry="6.5" />
                  </svg>
                  <div className="cept-wizard-type-card-text">
                    <span className="cept-wizard-type-card-title">Add from remote</span>
                    <span className="cept-wizard-type-card-desc">Add a read-only space from a remote source</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'create-empty' && (
            <div data-testid="wizard-create-form">
              <p className="cept-wizard-desc">
                Stored in your browser using IndexedDB. Your data stays on this device.
              </p>
              <div className="cept-wizard-form-row">
                <label className="cept-wizard-label" htmlFor="wizard-space-name">Space name</label>
                <input
                  id="wizard-space-name"
                  className="cept-wizard-input"
                  placeholder="My new space..."
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSpaceName.trim()) {
                      handleCreate();
                    }
                    if (e.key === 'Escape') {
                      handleBack();
                    }
                  }}
                  autoFocus
                  data-testid="wizard-space-name-input"
                />
              </div>
              <div className="cept-wizard-footer">
                <button
                  className="cept-wizard-cancel-btn"
                  onClick={resetAndClose}
                  data-testid="wizard-cancel"
                >
                  Cancel
                </button>
                <button
                  className="cept-wizard-primary-btn"
                  onClick={handleCreate}
                  disabled={!newSpaceName.trim()}
                  data-testid="wizard-create-confirm"
                >
                  Create Space
                </button>
              </div>
            </div>
          )}

          {step === 'add-remote' && (
            <div data-testid="wizard-remote-chooser">
              <div className="cept-wizard-type-cards">
                {hasRemoteDocs ? (
                  <div className="cept-wizard-type-card cept-wizard-type-card--disabled" data-testid="wizard-remote-docs-added">
                    <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="1" width="12" height="14" rx="1" />
                      <path d="M5 5h6M5 8h6M5 11h3" />
                    </svg>
                    <div className="cept-wizard-type-card-text">
                      <span className="cept-wizard-type-card-title">Cept Docs (main)</span>
                      <span className="cept-wizard-type-card-desc">Already added</span>
                    </div>
                  </div>
                ) : (
                  <button
                    className="cept-wizard-type-card"
                    onClick={() => {
                      onAddRemoteDocs?.();
                      resetAndClose();
                    }}
                    data-testid="wizard-add-remote-docs"
                  >
                    <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="1" width="12" height="14" rx="1" />
                      <path d="M5 5h6M5 8h6M5 11h3" />
                    </svg>
                    <div className="cept-wizard-type-card-text">
                      <span className="cept-wizard-type-card-title">Cept Docs (main)</span>
                      <span className="cept-wizard-type-card-desc">Read-only documentation from the main branch</span>
                    </div>
                  </button>
                )}
              </div>
              <p className="cept-wizard-desc cept-wizard-desc--muted">
                More remote sources coming soon (Git repositories, shared spaces).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
