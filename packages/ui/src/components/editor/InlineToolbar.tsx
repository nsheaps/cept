import { BubbleMenu } from '@tiptap/react/menus';
import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/core';

export interface InlineToolbarProps {
  editor: Editor | null;
}

export function InlineToolbar({ editor }: InlineToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor?.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleHighlight = useCallback(() => {
    editor?.chain().focus().toggleHighlight().run();
  }, [editor]);

  const handleLinkSubmit = useCallback(() => {
    if (linkUrl) {
      editor?.chain().focus().setLink({ href: linkUrl }).run();
    } else {
      editor?.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const toggleLinkInput = useCallback(() => {
    if (showLinkInput) {
      setShowLinkInput(false);
      setLinkUrl('');
    } else {
      const existingHref = editor?.getAttributes('link').href as string | undefined;
      setLinkUrl(existingHref ?? '');
      setShowLinkInput(true);
    }
  }, [editor, showLinkInput]);

  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
    >
      <div className="cept-inline-toolbar" data-testid="inline-toolbar">
        {showLinkInput ? (
          <div className="cept-inline-toolbar-link" data-testid="link-input-group">
            <input
              type="url"
              className="cept-inline-toolbar-link-input"
              placeholder="Enter URL..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLinkSubmit();
                }
                if (e.key === 'Escape') {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }
              }}
              data-testid="link-url-input"
              autoFocus
            />
            <button
              className="cept-inline-toolbar-btn"
              onClick={handleLinkSubmit}
              data-testid="link-submit"
              title="Apply link"
            >
              {'\u2713'}
            </button>
            <button
              className="cept-inline-toolbar-btn"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
              }}
              data-testid="link-cancel"
              title="Cancel"
            >
              {'\u2715'}
            </button>
          </div>
        ) : (
          <>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
              onClick={toggleBold}
              data-testid="toolbar-bold"
              title="Bold"
            >
              B
            </button>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
              onClick={toggleItalic}
              data-testid="toolbar-italic"
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
              onClick={toggleUnderline}
              data-testid="toolbar-underline"
              title="Underline"
            >
              <u>U</u>
            </button>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('strike') ? 'is-active' : ''}`}
              onClick={toggleStrike}
              data-testid="toolbar-strike"
              title="Strikethrough"
            >
              <s>S</s>
            </button>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('code') ? 'is-active' : ''}`}
              onClick={toggleCode}
              data-testid="toolbar-code"
              title="Code"
            >
              {'<>'}
            </button>
            <div className="cept-inline-toolbar-divider" />
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
              onClick={toggleHighlight}
              data-testid="toolbar-highlight"
              title="Highlight"
            >
              {'\u{1F58C}'}
            </button>
            <button
              className={`cept-inline-toolbar-btn ${editor.isActive('link') ? 'is-active' : ''}`}
              onClick={toggleLinkInput}
              data-testid="toolbar-link"
              title="Link"
            >
              {'\u{1F517}'}
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
