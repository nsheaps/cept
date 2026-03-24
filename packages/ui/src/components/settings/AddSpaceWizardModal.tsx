import { useState, useCallback } from 'react';

export interface RemoteSpaceConfig {
  url: string;
  branch: string;
  subPath: string;
}

export interface AddSpaceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSpace: (name: string) => void;
  onAddRemoteRepo?: (config: RemoteSpaceConfig) => void;
}

type WizardStep = 'choose-type' | 'create-local' | 'add-git';

export function AddSpaceWizardModal({
  isOpen,
  onClose,
  onCreateSpace,
  onAddRemoteRepo,
}: AddSpaceWizardModalProps) {
  const [step, setStep] = useState<WizardStep>('choose-type');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('github.com/nsheaps/cept');
  const [remoteBranch, setRemoteBranch] = useState('main');
  const [remoteSubPath, setRemoteSubPath] = useState('docs/');

  const resetAndClose = useCallback(() => {
    setStep('choose-type');
    setNewSpaceName('');
    setRemoteUrl('github.com/nsheaps/cept');
    setRemoteBranch('main');
    setRemoteSubPath('docs/');
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(() => {
    if (newSpaceName.trim()) {
      onCreateSpace(newSpaceName.trim());
      resetAndClose();
    }
  }, [newSpaceName, onCreateSpace, resetAndClose]);

  const handleAddRemote = useCallback(() => {
    if (remoteUrl.trim()) {
      onAddRemoteRepo?.({
        url: remoteUrl.trim(),
        branch: remoteBranch.trim() || 'main',
        subPath: remoteSubPath.trim(),
      });
      resetAndClose();
    }
  }, [remoteUrl, remoteBranch, remoteSubPath, onAddRemoteRepo, resetAndClose]);

  const handleBack = useCallback(() => {
    if (step === 'create-local' || step === 'add-git') {
      setStep('choose-type');
      setNewSpaceName('');
    } else {
      resetAndClose();
    }
  }, [step, resetAndClose]);

  if (!isOpen) return null;

  return (
    <div className="cept-wizard-overlay" onClick={resetAndClose} data-testid="add-space-wizard-modal">
      <div className="cept-wizard-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cept-wizard-header">
          {step !== 'choose-type' && (
            <button
              className="cept-wizard-back-btn"
              onClick={handleBack}
              data-testid="wizard-back"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 4l-4 4 4 4" />
              </svg>
              Back
            </button>
          )}
          <h2>
            {step === 'choose-type' && 'New Space'}
            {step === 'create-local' && 'Create Local Space'}
            {step === 'add-git' && 'Add from Git'}
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
                Choose the type of space you want to create.
              </p>
              <div className="cept-wizard-type-grid">
                <button
                  className="cept-wizard-type-card"
                  onClick={() => setStep('create-local')}
                  data-testid="wizard-choose-local"
                >
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="1" width="12" height="14" rx="1" />
                    <path d="M5 5h6M5 8h6M5 11h3" />
                  </svg>
                  <div className="cept-wizard-type-card-text">
                    <span className="cept-wizard-type-card-title">Local</span>
                    <span className="cept-wizard-type-card-desc">Can sync to a remote source later</span>
                  </div>
                </button>
                <button
                  className="cept-wizard-type-card"
                  onClick={() => setStep('add-git')}
                  data-testid="wizard-choose-git"
                >
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="8" r="6.5" />
                    <path d="M2 6h12M2 10h12" />
                    <ellipse cx="8" cy="8" rx="3" ry="6.5" />
                  </svg>
                  <div className="cept-wizard-type-card-text">
                    <span className="cept-wizard-type-card-title">Git</span>
                    <span className="cept-wizard-type-card-desc">Add a space from a remote repository</span>
                  </div>
                </button>
                <div
                  className="cept-wizard-type-card cept-wizard-type-card--disabled"
                  data-testid="wizard-choose-s3"
                >
                  <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" />
                    <path d="M2 5l6 3 6-3M8 8v6" />
                  </svg>
                  <div className="cept-wizard-type-card-text">
                    <span className="cept-wizard-type-card-title">S3</span>
                    <span className="cept-wizard-type-card-desc">Coming soon</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'create-local' && (
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

          {step === 'add-git' && (
            <div data-testid="wizard-git-form">
              <p className="cept-wizard-desc">
                Add a read-only space from a Git repository.
              </p>
              <div className="cept-wizard-form-row">
                <label className="cept-wizard-label" htmlFor="wizard-remote-url">Repository URL</label>
                <input
                  id="wizard-remote-url"
                  className="cept-wizard-input"
                  placeholder="github.com/user/repo"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  autoFocus
                  data-testid="wizard-remote-url-input"
                />
              </div>
              <div className="cept-wizard-form-row-inline">
                <div className="cept-wizard-form-row cept-wizard-form-row--flex">
                  <label className="cept-wizard-label" htmlFor="wizard-remote-branch">Branch</label>
                  <input
                    id="wizard-remote-branch"
                    className="cept-wizard-input"
                    placeholder="main"
                    value={remoteBranch}
                    onChange={(e) => setRemoteBranch(e.target.value)}
                    data-testid="wizard-remote-branch-input"
                  />
                </div>
                <div className="cept-wizard-form-row cept-wizard-form-row--flex">
                  <label className="cept-wizard-label" htmlFor="wizard-remote-subpath">Sub-path (optional)</label>
                  <input
                    id="wizard-remote-subpath"
                    className="cept-wizard-input"
                    placeholder="docs/"
                    value={remoteSubPath}
                    onChange={(e) => setRemoteSubPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && remoteUrl.trim()) {
                        handleAddRemote();
                      }
                      if (e.key === 'Escape') {
                        handleBack();
                      }
                    }}
                    data-testid="wizard-remote-subpath-input"
                  />
                </div>
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
                  onClick={handleAddRemote}
                  disabled={!remoteUrl.trim()}
                  data-testid="wizard-add-remote-confirm"
                >
                  Add Space
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
