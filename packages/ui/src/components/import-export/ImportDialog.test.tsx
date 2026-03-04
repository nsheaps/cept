import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportDialog } from './ImportDialog.js';

describe('ImportDialog', () => {
  it('does not render when closed', () => {
    render(
      <ImportDialog
        isOpen={false}
        source="notion"
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('import-dialog')).toBeNull();
  });

  it('renders Notion import dialog', () => {
    render(
      <ImportDialog
        isOpen={true}
        source="notion"
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-dialog')).toBeDefined();
    expect(screen.getByText('Import from Notion')).toBeDefined();
    expect(screen.getByTestId('import-file-input')).toBeDefined();
  });

  it('renders Obsidian import dialog', () => {
    render(
      <ImportDialog
        isOpen={true}
        source="obsidian"
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />,
    );
    expect(screen.getByText('Import from Obsidian')).toBeDefined();
  });

  it('shows idle state with file input', () => {
    render(
      <ImportDialog
        isOpen={true}
        source="notion"
        onClose={vi.fn()}
        onImportComplete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('import-idle')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ImportDialog
        isOpen={true}
        source="notion"
        onClose={onClose}
        onImportComplete={vi.fn()}
      />,
    );
    screen.getByTestId('import-close').click();
    expect(onClose).toHaveBeenCalled();
  });
});
