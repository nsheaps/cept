import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AddSpaceWizardModal } from './AddSpaceWizardModal.js';

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

  it('shows type chooser with Local, Git, and S3 options', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-local')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-git')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-s3')).toBeDefined();
  });

  it('does not show back button on type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.queryByTestId('wizard-back')).toBeNull();
  });

  it('S3 option is disabled', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    const s3 = screen.getByTestId('wizard-choose-s3');
    // S3 is a div, not a button — no click handler
    expect(s3.tagName).toBe('DIV');
  });

  it('shows create form when Local selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    expect(screen.getByTestId('wizard-space-name-input')).toBeDefined();
  });

  it('shows git form when Git selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={vi.fn()} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    expect(screen.getByTestId('wizard-git-form')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-url-input')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-branch-input')).toBeDefined();
    expect(screen.getByTestId('wizard-remote-subpath-input')).toBeDefined();
  });

  it('git form starts with default docs repo values', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    expect((screen.getByTestId('wizard-remote-url-input') as HTMLInputElement).value).toBe('github.com/nsheaps/cept');
    expect((screen.getByTestId('wizard-remote-branch-input') as HTMLInputElement).value).toBe('main');
    expect((screen.getByTestId('wizard-remote-subpath-input') as HTMLInputElement).value).toBe('docs/');
  });

  it('calls onAddRemoteRepo with form values when confirmed', () => {
    const onAddRemoteRepo = vi.fn();
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={onAddRemoteRepo} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), { target: { value: 'github.com/other/repo' } });
    fireEvent.change(screen.getByTestId('wizard-remote-branch-input'), { target: { value: 'develop' } });
    fireEvent.change(screen.getByTestId('wizard-remote-subpath-input'), { target: { value: 'content/' } });
    act(() => { fireEvent.click(screen.getByTestId('wizard-add-remote-confirm')); });
    expect(onAddRemoteRepo).toHaveBeenCalledWith({
      url: 'github.com/other/repo',
      branch: 'develop',
      subPath: 'content/',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables add remote button when URL is empty', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), { target: { value: '' } });
    expect(screen.getByTestId('wizard-add-remote-confirm').hasAttribute('disabled')).toBe(true);
  });

  it('calls onCreateSpace when form submitted via button', () => {
    const onCreateSpace = vi.fn();
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Test Space' } });
    act(() => { fireEvent.click(screen.getByTestId('wizard-create-confirm')); });
    expect(onCreateSpace).toHaveBeenCalledWith('Test Space');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCreateSpace when Enter pressed in input', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Enter Space' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateSpace).toHaveBeenCalledWith('Enter Space');
  });

  it('does not submit empty name', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    act(() => { fireEvent.click(screen.getByTestId('wizard-create-confirm')); });
    expect(onCreateSpace).not.toHaveBeenCalled();
  });

  it('navigates back from create form to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    act(() => { fireEvent.click(screen.getByTestId('wizard-back')); });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('navigates back from git form to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    expect(screen.getByTestId('wizard-git-form')).toBeDefined();
    act(() => { fireEvent.click(screen.getByTestId('wizard-back')); });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('closes when X button clicked', () => {
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-close')); });
    expect(onClose).toHaveBeenCalled();
  });

  it('goes back when Escape pressed in name input', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('disables create button when name is empty', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-local')); });
    const btn = screen.getByTestId('wizard-create-confirm');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('submits remote form when Enter pressed in subpath input', () => {
    const onAddRemoteRepo = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteRepo={onAddRemoteRepo} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
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
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    fireEvent.change(screen.getByTestId('wizard-remote-url-input'), { target: { value: 'changed' } });
    act(() => { fireEvent.click(screen.getByTestId('wizard-close')); });
    // Reopen
    rerender(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-git')); });
    expect((screen.getByTestId('wizard-remote-url-input') as HTMLInputElement).value).toBe('github.com/nsheaps/cept');
  });
});
