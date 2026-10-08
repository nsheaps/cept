import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryBackend } from '@cept/core';
import { AddSpaceWizardModal } from './AddSpaceWizardModal.js';
import { probePlatform, spaceSources } from '../storage/platform.js';

/** A backend that can host a Git clone, like the IndexedDB browser backend. */
class CloneHostBackend extends MemoryBackend {
  getRawFs(): unknown {
    return {};
  }
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onCreateSpace: vi.fn(),
};

describe('AddSpaceWizardModal', () => {
  it('does not render when closed', () => {
    render(<AddSpaceWizardModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('add-space-wizard-modal')).toBeNull();
  });

  it('renders when open', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.getByTestId('add-space-wizard-modal')).toBeDefined();
  });

  it('shows Local and Git by default, and nothing that is not available', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-local')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-git')).toBeDefined();
    expect(screen.queryByTestId('wizard-choose-folder')).toBeNull();
    expect(screen.queryByTestId('wizard-choose-s3')).toBeNull();
  });

  it('does not show back button on type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.queryByTestId('wizard-back')).toBeNull();
  });

  describe('on each platform (REQ-WS-017)', () => {
    // jsdom has no IndexedDB; every browser Cept supports has one.
    beforeEach(() => vi.stubGlobal('indexedDB', {}));
    afterEach(() => vi.unstubAllGlobals());

    const sourcesHere = () => spaceSources(probePlatform(window), new CloneHostBackend());

    it('offers a local folder where File System Access exists', () => {
      vi.stubGlobal('showDirectoryPicker', vi.fn());
      const onOpenFolder = vi.fn();
      const onClose = vi.fn();
      render(
        <AddSpaceWizardModal
          {...defaultProps}
          onClose={onClose}
          sources={sourcesHere()}
          onOpenFolder={onOpenFolder}
        />,
      );
      expect(screen.getByTestId('wizard-choose-local')).toBeDefined();
      expect(screen.getByTestId('wizard-choose-git')).toBeDefined();
      fireEvent.click(screen.getByTestId('wizard-choose-folder'));
      expect(onOpenFolder).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalled();
    });

    it('hides the local folder in a phone PWA without File System Access', () => {
      vi.stubGlobal('showDirectoryPicker', undefined);
      render(
        <AddSpaceWizardModal {...defaultProps} sources={sourcesHere()} onOpenFolder={vi.fn()} />,
      );
      expect(screen.queryByTestId('wizard-choose-folder')).toBeNull();
      expect(screen.getByTestId('wizard-choose-local')).toBeDefined();
      expect(screen.getByTestId('wizard-choose-git')).toBeDefined();
    });

    it('hides the local folder until the app can open one', () => {
      render(
        <AddSpaceWizardModal
          {...defaultProps}
          sources={{ browser: true, folder: true, git: true }}
        />,
      );
      expect(screen.queryByTestId('wizard-choose-folder')).toBeNull();
    });

    it('hides Git where the backend cannot clone', () => {
      render(
        <AddSpaceWizardModal
          {...defaultProps}
          sources={{ browser: true, folder: false, git: false }}
        />,
      );
      expect(screen.queryByTestId('wizard-choose-git')).toBeNull();
      expect(screen.getByTestId('wizard-choose-local')).toBeDefined();
    });

    it('says so when no kind of space is available', () => {
      render(
        <AddSpaceWizardModal
          {...defaultProps}
          sources={{ browser: false, folder: false, git: false }}
        />,
      );
      expect(screen.getByTestId('wizard-no-sources')).toBeDefined();
      expect(screen.queryByTestId('wizard-choose-local')).toBeNull();
    });
  });

  it('shows create form when Local selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    expect(screen.getByTestId('wizard-space-name-input')).toBeDefined();
  });

  it('shows git form when Git selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={vi.fn()} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    expect(screen.getByTestId('wizard-git-form')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-url-input')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-branch-input')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-subpath-input')).toBeDefined();
  });

  it('git form starts with default docs repo values', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    expect((screen.getByTestId('wizard-remote-url-input') as HTMLInputElement).value).toBe(
      'github.com/nsheaps/cept',
    );
    expect((screen.getByTestId('wizard-remote-branch-input') as HTMLInputElement).value).toBe(
      'main',
    );
    expect((screen.getByTestId('wizard-remote-subpath-input') as HTMLInputElement).value).toBe(
      'docs/',
    );
  });

  it('calls onAddRemoteRepo with form values when confirmed', () => {
    const onAddRemoteRepo = vi.fn();
    const onClose = vi.fn();
    render(
      <AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={onAddRemoteRepo} onClose={onClose} />,
    );
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), {
      target: { value: 'github.com/other/repo' },
    });
    fireEvent.change(screen.getByTestId('wizard-remote-branch-input'), {
      target: { value: 'develop' },
    });
    fireEvent.change(screen.getByTestId('wizard-remote-subpath-input'), {
      target: { value: 'content/' },
    });
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-add-remote-confirm'));
    });
    expect(onAddRemoteRepo).toHaveBeenCalledWith({
      url: 'github.com/other/repo',
      branch: 'develop',
      subPath: 'content/',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables add remote button when URL is empty', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), { target: { value: '' } });
    expect(screen.getByTestId('wizard-add-remote-confirm').hasAttribute('disabled')).toBe(true);
  });

  it('calls onCreateSpace when form submitted via button', () => {
    const onCreateSpace = vi.fn();
    const onClose = vi.fn();
    render(
      <AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} onClose={onClose} />,
    );
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Test Space' } });
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-create-confirm'));
    });
    expect(onCreateSpace).toHaveBeenCalledWith('Test Space');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCreateSpace when Enter pressed in input', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Enter Space' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateSpace).toHaveBeenCalledWith('Enter Space');
  });

  it('does not submit empty name', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-create-confirm'));
    });
    expect(onCreateSpace).not.toHaveBeenCalled();
  });

  it('navigates back from create form to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-back'));
    });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('navigates back from git form to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    expect(screen.getByTestId('wizard-git-form')).toBeDefined();
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-back'));
    });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('closes when X button clicked', () => {
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onClose={onClose} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-close'));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('goes back when Escape pressed in name input', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('disables create button when name is empty', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-local'));
    });
    const btn = screen.getByTestId('wizard-create-confirm');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('submits remote form when Enter pressed in subpath input', () => {
    const onAddRemoteRepo = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={onAddRemoteRepo} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    const subpathInput = screen.getByTestId('wizard-remote-subpath-input');
    fireEvent.keyDown(subpathInput, { key: 'Enter' });
    expect(onAddRemoteRepo).toHaveBeenCalledWith({
      url: 'github.com/nsheaps/cept',
      branch: 'main',
      subPath: 'docs/',
    });
  });

  it('resets git form fields on close and reopen', () => {
    const { rerender } = render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), {
      target: { value: 'changed' },
    });
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-close'));
    });
    // Reopen
    rerender(<AddSpaceWizardModal {...defaultProps} />);
    act(() => {
      fireEvent.click(screen.getByTestId('wizard-choose-git'));
    });
    expect((screen.getByTestId('wizard-remote-url-input') as HTMLInputElement).value).toBe(
      'github.com/nsheaps/cept',
    );
  });

  it('calls onClose on overlay click', () => {
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onClose={onClose} />);
    act(() => {
      fireEvent.click(screen.getByTestId('add-space-wizard-modal'));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
