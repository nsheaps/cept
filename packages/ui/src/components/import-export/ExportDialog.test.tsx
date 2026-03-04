import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportDialog } from './ExportDialog.js';
import type { PageContent } from '@cept/core';

const testPage: PageContent = {
  title: 'Test Page',
  markdown: '# Test\n\nSome content',
  path: '/pages/test.md',
};

describe('ExportDialog', () => {
  it('does not render when closed', () => {
    render(
      <ExportDialog isOpen={false} onClose={vi.fn()} page={testPage} />,
    );
    expect(screen.queryByTestId('export-dialog')).toBeNull();
  });

  it('does not render when page is null', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={null} />,
    );
    expect(screen.queryByTestId('export-dialog')).toBeNull();
  });

  it('renders export options', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );
    expect(screen.getByTestId('export-dialog')).toBeDefined();
    expect(screen.getByText('Export Page')).toBeDefined();
    expect(screen.getByTestId('export-format')).toBeDefined();
    expect(screen.getByTestId('export-button')).toBeDefined();
  });

  it('shows page title', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );
    expect(screen.getByText('Test Page')).toBeDefined();
  });

  it('has format selector with markdown, html, pdf options', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );
    const select = screen.getByTestId('export-format') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe('markdown');
    expect(select.options[1].value).toBe('html');
    expect(select.options[2].value).toBe('pdf');
  });

  it('shows front matter checkbox for markdown format', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );
    expect(screen.getByTestId('export-frontmatter')).toBeDefined();
  });

  it('hides front matter checkbox for html format', () => {
    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );
    fireEvent.change(screen.getByTestId('export-format'), { target: { value: 'html' } });
    expect(screen.queryByTestId('export-frontmatter')).toBeNull();
  });

  it('exports and shows done state', () => {
    // Mock URL.createObjectURL and createElement for download
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();

    const clickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = originalCreateElement('a');
        el.click = clickMock;
        return el;
      }
      return originalCreateElement(tag);
    });

    render(
      <ExportDialog isOpen={true} onClose={vi.fn()} page={testPage} />,
    );

    fireEvent.click(screen.getByTestId('export-button'));
    expect(screen.getByTestId('export-done')).toBeDefined();
    expect(clickMock).toHaveBeenCalled();

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ExportDialog isOpen={true} onClose={onClose} page={testPage} />,
    );
    screen.getByTestId('export-close').click();
    expect(onClose).toHaveBeenCalled();
  });
});
