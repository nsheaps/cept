import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineToolbar } from './InlineToolbar.js';

// Mock the BubbleMenu since it requires a real editor view
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bubble-menu-wrapper">{children}</div>
  ),
}));

function createMockEditor(activeMarks: string[] = []) {
  return {
    chain: vi.fn().mockReturnThis(),
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleUnderline: vi.fn().mockReturnThis(),
    toggleStrike: vi.fn().mockReturnThis(),
    toggleCode: vi.fn().mockReturnThis(),
    toggleHighlight: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    unsetLink: vi.fn().mockReturnThis(),
    run: vi.fn(),
    isActive: vi.fn((mark: string) => activeMarks.includes(mark)),
    getAttributes: vi.fn().mockReturnValue({}),
  };
}

describe('InlineToolbar', () => {
  it('renders nothing when editor is null', () => {
    const { container } = render(<InlineToolbar editor={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders all formatting buttons', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    expect(screen.getByTestId('toolbar-bold')).toBeDefined();
    expect(screen.getByTestId('toolbar-italic')).toBeDefined();
    expect(screen.getByTestId('toolbar-underline')).toBeDefined();
    expect(screen.getByTestId('toolbar-strike')).toBeDefined();
    expect(screen.getByTestId('toolbar-code')).toBeDefined();
    expect(screen.getByTestId('toolbar-highlight')).toBeDefined();
    expect(screen.getByTestId('toolbar-link')).toBeDefined();
  });

  it('calls toggleBold when bold button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-bold'));
    expect(editor.chain).toHaveBeenCalled();
    expect(editor.toggleBold).toHaveBeenCalled();
    expect(editor.run).toHaveBeenCalled();
  });

  it('calls toggleItalic when italic button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-italic'));
    expect(editor.toggleItalic).toHaveBeenCalled();
  });

  it('calls toggleUnderline when underline button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-underline'));
    expect(editor.toggleUnderline).toHaveBeenCalled();
  });

  it('calls toggleStrike when strike button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-strike'));
    expect(editor.toggleStrike).toHaveBeenCalled();
  });

  it('calls toggleCode when code button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-code'));
    expect(editor.toggleCode).toHaveBeenCalled();
  });

  it('calls toggleHighlight when highlight button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-highlight'));
    expect(editor.toggleHighlight).toHaveBeenCalled();
  });

  it('shows active state for active marks', () => {
    const editor = createMockEditor(['bold', 'italic']);
    render(<InlineToolbar editor={editor as never} />);

    const boldBtn = screen.getByTestId('toolbar-bold');
    const italicBtn = screen.getByTestId('toolbar-italic');
    const underlineBtn = screen.getByTestId('toolbar-underline');

    expect(boldBtn.className).toContain('is-active');
    expect(italicBtn.className).toContain('is-active');
    expect(underlineBtn.className).not.toContain('is-active');
  });

  it('shows link input when link button clicked', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-link'));

    expect(screen.getByTestId('link-input-group')).toBeDefined();
    expect(screen.getByTestId('link-url-input')).toBeDefined();
  });

  it('submits link on Enter', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-link'));

    const input = screen.getByTestId('link-url-input');
    fireEvent.change(input, { target: { value: 'https://example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editor.setLink).toHaveBeenCalledWith({ href: 'https://example.com' });
  });

  it('cancels link input on cancel button', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    fireEvent.click(screen.getByTestId('toolbar-link'));
    expect(screen.getByTestId('link-input-group')).toBeDefined();

    fireEvent.click(screen.getByTestId('link-cancel'));

    // Should go back to regular toolbar
    expect(screen.getByTestId('toolbar-bold')).toBeDefined();
    expect(screen.queryByTestId('link-input-group')).toBeNull();
  });

  it('has correct test id', () => {
    const editor = createMockEditor();
    render(<InlineToolbar editor={editor as never} />);

    expect(screen.getByTestId('inline-toolbar')).toBeDefined();
  });
});
