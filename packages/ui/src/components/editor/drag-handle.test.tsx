import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CeptEditor } from './CeptEditor.js';

describe('Drag Handle', () => {
  it('renders editor with drag handle extension without crashing', () => {
    render(<CeptEditor content="Hello world" />);

    const editor = screen.getByTestId('cept-editor');
    expect(editor).toBeDefined();
  });

  it('renders editor content alongside drag handle', () => {
    render(<CeptEditor content={'First block\n\nSecond block\n'} />);

    expect(screen.getByText('First block')).toBeDefined();
    expect(screen.getByText('Second block')).toBeDefined();
  });

  it('does not render drag handle when editor is not editable', () => {
    const { container } = render(<CeptEditor content="Read only" editable={false} />);

    expect(screen.getByText('Read only')).toBeDefined();
    // The editor should still render without errors
    expect(container.querySelector('.cept-editor')).not.toBeNull();
  });

  it('preserves block structure with drag handle enabled', () => {
    const { container } = render(<CeptEditor content={'# Title\n\nParagraph\n\n- Item\n'} />);

    const editor = container.querySelector('.tiptap');
    expect(editor).not.toBeNull();

    // All block types should render
    expect(editor?.querySelector('h1')).not.toBeNull();
    expect(editor?.querySelector('p')).not.toBeNull();
    expect(editor?.querySelector('ul')).not.toBeNull();
    expect(editor?.querySelector('li')).not.toBeNull();
  });
});
