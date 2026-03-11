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

  it('shows type chooser initially', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-empty')).toBeDefined();
    expect(screen.getByTestId('wizard-choose-remote')).toBeDefined();
  });

  it('shows create form when empty space selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    expect(screen.getByTestId('wizard-space-name-input')).toBeDefined();
  });

  it('shows remote chooser when add from remote selected', () => {
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteDocs={vi.fn()} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-remote')); });
    expect(screen.getByTestId('wizard-remote-chooser')).toBeDefined();
    expect(screen.getByTestId('wizard-add-remote-docs')).toBeDefined();
  });

  it('calls onCreateSpace when form submitted via button', () => {
    const onCreateSpace = vi.fn();
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Test Space' } });
    act(() => { fireEvent.click(screen.getByTestId('wizard-create-confirm')); });
    expect(onCreateSpace).toHaveBeenCalledWith('Test Space');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onCreateSpace when Enter pressed in input', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.change(input, { target: { value: 'Enter Space' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateSpace).toHaveBeenCalledWith('Enter Space');
  });

  it('does not submit empty name', () => {
    const onCreateSpace = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onCreateSpace={onCreateSpace} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    act(() => { fireEvent.click(screen.getByTestId('wizard-create-confirm')); });
    expect(onCreateSpace).not.toHaveBeenCalled();
  });

  it('navigates back from create form to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    expect(screen.getByTestId('wizard-create-form')).toBeDefined();
    act(() => { fireEvent.click(screen.getByTestId('wizard-back')); });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('navigates back from remote chooser to type chooser', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-remote')); });
    expect(screen.getByTestId('wizard-remote-chooser')).toBeDefined();
    act(() => { fireEvent.click(screen.getByTestId('wizard-back')); });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('closes when back clicked on type chooser', () => {
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-back')); });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when X button clicked', () => {
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-close')); });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows already added state for remote docs when hasRemoteDocs is true', () => {
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteDocs={vi.fn()} hasRemoteDocs />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-remote')); });
    expect(screen.getByTestId('wizard-remote-docs-added')).toBeDefined();
  });

  it('calls onAddRemoteDocs and closes when remote docs clicked', () => {
    const onAddRemoteDocs = vi.fn();
    const onClose = vi.fn();
    render(<AddSpaceWizardModal {...defaultProps} onAddRemoteDocs={onAddRemoteDocs} onClose={onClose} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-remote')); });
    act(() => { fireEvent.click(screen.getByTestId('wizard-add-remote-docs')); });
    expect(onAddRemoteDocs).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('goes back when Escape pressed in name input', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    const input = screen.getByTestId('wizard-space-name-input');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('wizard-type-chooser')).toBeDefined();
  });

  it('disables create button when name is empty', () => {
    render(<AddSpaceWizardModal {...defaultProps} />);
    act(() => { fireEvent.click(screen.getByTestId('wizard-choose-empty')); });
    const btn = screen.getByTestId('wizard-create-confirm');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
