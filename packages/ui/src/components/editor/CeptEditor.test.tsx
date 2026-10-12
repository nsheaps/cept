import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { CeptEditor } from './CeptEditor.js';

describe('CeptEditor', () => {
  it('renders the editor container', () => {
    render(<CeptEditor />);
    expect(screen.getByTestId('cept-editor')).toBeTruthy();
  });

  it('renders with initial HTML content', async () => {
    render(<CeptEditor content="Hello world" />);
    await waitFor(() => {
      expect(screen.getByTestId('cept-editor').textContent).toContain('Hello world');
    });
  });

  it('renders heading content', async () => {
    render(<CeptEditor content={'# My Title\n\nBody text\n'} />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.textContent).toContain('My Title');
      expect(editor.textContent).toContain('Body text');
    });
  });

  it('renders bullet list content', async () => {
    render(<CeptEditor content={'- Item 1\n- Item 2\n'} />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.textContent).toContain('Item 1');
      expect(editor.textContent).toContain('Item 2');
    });
  });

  it('renders ordered list content', async () => {
    render(<CeptEditor content={'1. First\n2. Second\n'} />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.textContent).toContain('First');
      expect(editor.textContent).toContain('Second');
    });
  });

  it('renders task list content', async () => {
    render(
      <CeptEditor content='<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Unchecked task</p></li><li data-type="taskItem" data-checked="true"><p>Checked task</p></li></ul>' />,
    );
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.textContent).toContain('Unchecked task');
      expect(editor.textContent).toContain('Checked task');
    });
  });

  it('can be set to non-editable', async () => {
    render(<CeptEditor content="Read only" editable={false} />);
    await waitFor(() => {
      const prosemirror = screen.getByTestId('cept-editor').querySelector('[contenteditable]');
      expect(prosemirror?.getAttribute('contenteditable')).toBe('false');
    });
  });

  it('reports edits as Markdown, keeping the source of untouched blocks', async () => {
    const onUpdate = vi.fn();
    const source = 'Intro with __bold__.\n\n* one\n* two\n\nLast paragraph.\n';
    render(<CeptEditor content={source} onUpdate={onUpdate} />);
    const dom = await waitFor(() => {
      const element = screen.getByTestId('cept-editor').querySelector('.ProseMirror');
      expect(element).not.toBeNull();
      return element as HTMLElement & { editor: Editor };
    });
    const { editor } = dom;
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' More.');
    });
    expect(onUpdate).toHaveBeenLastCalledWith(
      'Intro with __bold__.\n\n* one\n* two\n\nLast paragraph. More.\n',
    );
  });

  it('renders multiple heading levels', async () => {
    render(<CeptEditor content={'# Heading 1\n\n## Heading 2\n\n### Heading 3\n'} />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      const h1 = editor.querySelector('h1');
      const h2 = editor.querySelector('h2');
      const h3 = editor.querySelector('h3');
      expect(h1?.textContent).toBe('Heading 1');
      expect(h2?.textContent).toBe('Heading 2');
      expect(h3?.textContent).toBe('Heading 3');
    });
  });

  it('renders inline formatting', async () => {
    render(<CeptEditor content="**bold** and *italic* and ~~strike~~" />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      expect(editor.querySelector('strong')?.textContent).toBe('bold');
      expect(editor.querySelector('em')?.textContent).toBe('italic');
      expect(editor.querySelector('s')?.textContent).toBe('strike');
    });
  });

  it('renders empty editor with placeholder', async () => {
    render(<CeptEditor placeholder="Start typing..." />);
    await waitFor(() => {
      const editor = screen.getByTestId('cept-editor');
      // Placeholder is applied via CSS ::before pseudo-element with data-placeholder attr
      const emptyParagraph = editor.querySelector('p.is-editor-empty');
      expect(emptyParagraph?.getAttribute('data-placeholder')).toBe('Start typing...');
    });
  });
});
