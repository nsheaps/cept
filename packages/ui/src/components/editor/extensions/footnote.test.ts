import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { parseMarkdownDocument, serializeMarkdownDocument } from '@cept/core';
import type { PmNode } from '@cept/core';
import { documentExtensions } from '../document-extensions.js';
import { footnoteNumbers } from './footnote.js';

const markdown = [
  'First[^b] then[^a] and[^b] again.',
  '',
  '[^a]: Note A.',
  '',
  '[^b]: Note B.',
  '',
].join('\n');

function editorFor(source: string) {
  const element = document.createElement('div');
  document.body.append(element);
  const parsed = parseMarkdownDocument(source);
  const editor = new Editor({ element, extensions: documentExtensions(), content: parsed.doc });
  return { editor, parsed };
}

describe('footnoteNumbers', () => {
  it('numbers identifiers by their first reference', () => {
    const { editor } = editorFor(markdown);
    expect([...footnoteNumbers(editor.state.doc)]).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
    editor.destroy();
  });
});

describe('footnote rendering', () => {
  it('numbers references and counts each use', () => {
    const { editor } = editorFor(markdown);
    const refs = [...editor.view.dom.querySelectorAll<HTMLElement>('.cept-footnote-ref')];
    expect(
      refs.map((ref) => [
        ref.dataset.identifier,
        ref.dataset.footnoteNumber,
        ref.dataset.footnoteUse,
      ]),
    ).toEqual([
      ['b', '1', '1'],
      ['a', '2', '1'],
      ['b', '1', '2'],
    ]);
    editor.destroy();
  });

  it('numbers definitions and links back to every reference', () => {
    const { editor } = editorFor(markdown);
    const defs = [...editor.view.dom.querySelectorAll<HTMLElement>('.cept-footnote-def')];
    expect(defs.map((def) => def.dataset.footnoteNumber)).toEqual(['2', '1']);
    const backrefs = (def: HTMLElement) =>
      [...def.querySelectorAll<HTMLElement>('.cept-footnote-backref')].map((a) => a.textContent);
    expect(backrefs(defs[0]!)).toEqual(['↩']);
    expect(backrefs(defs[1]!)).toEqual(['↩1', '↩2']);
    editor.destroy();
  });

  it('leaves an unreferenced definition unnumbered', () => {
    const { editor } = editorFor('Text.\n\n[^x]: Unused.\n');
    const def = editor.view.dom.querySelector<HTMLElement>('.cept-footnote-def');
    expect(def?.dataset.footnoteNumber).toBe('');
    expect(def?.querySelector('.cept-footnote-backref')).toBeNull();
    editor.destroy();
  });

  it('renumbers when a reference is removed', () => {
    const { editor } = editorFor(markdown);
    let first = -1;
    editor.state.doc.descendants((node, pos) => {
      if (first < 0 && node.type.name === 'footnoteReference') first = pos;
    });
    editor.commands.deleteRange({ from: first, to: first + 1 });
    expect([...footnoteNumbers(editor.state.doc)]).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
    const refs = [...editor.view.dom.querySelectorAll<HTMLElement>('.cept-footnote-ref')];
    expect(refs.map((ref) => ref.dataset.footnoteNumber)).toEqual(['1', '2']);
    editor.destroy();
  });
});

describe('footnote navigation', () => {
  it('jumps from a reference to its definition and back', () => {
    const { editor } = editorFor(markdown);
    const scrolled: string[] = [];
    const record = function (this: HTMLElement) {
      scrolled.push(this.className + ':' + (this.dataset.identifier ?? ''));
    };
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = record;
    try {
      const ref = editor.view.dom.querySelector<HTMLElement>(
        '.cept-footnote-ref[data-identifier="a"]',
      )!;
      ref.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const backref = editor.view.dom.querySelector<HTMLElement>(
        '[data-footnote-backref="b"][data-footnote-use="2"]',
      )!;
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      backref.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(scrolled).toEqual([
        expect.stringMatching(/cept-footnote-def.*:a$/),
        expect.stringMatching(/cept-footnote-ref.*:b$/),
      ]);
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
      editor.destroy();
    }
  });
});

describe('footnote editing', () => {
  it('saves an edited definition once for every reference', () => {
    const { editor, parsed } = editorFor(markdown);
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'text' && node.text === 'Note B.') at = pos;
    });
    editor.commands.insertContentAt({ from: at, to: at + 'Note B.'.length }, 'Shared note.');
    const saved = serializeMarkdownDocument(editor.getJSON() as PmNode, parsed);
    expect(saved).toBe(markdown.replace('Note B.', 'Shared note.'));
    editor.destroy();
  });
});
