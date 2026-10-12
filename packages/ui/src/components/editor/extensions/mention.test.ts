import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { backlinksOf, buildLinkGraph, type PmNode } from '@cept/core';
import { documentExtensions } from '../document-extensions.js';
import { editorBaseline, loadMarkdown, saveMarkdown } from '../markdown-bridge.js';
import {
  Mention,
  formatMentionDate,
  mentionItems,
  pageMentionHref,
  type MentionSource,
} from './mention.js';

const source: MentionSource = {
  pageId: 'notes/today.md',
  pages: [
    { id: 'notes/today.md', title: 'Today' },
    { id: 'notes/ideas.md', title: 'Ideas' },
    { id: 'guides/Getting Started.md', title: 'Getting Started', icon: '🚀' },
    { id: 'projects', title: 'Projects' },
  ],
};
const now = new Date(2026, 9, 12, 9, 30);

describe('formatMentionDate', () => {
  it('is ISO 8601 in local time with zero padding', () => {
    expect(formatMentionDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatMentionDate(now)).toBe('2026-10-12');
  });
});

describe('pageMentionHref', () => {
  it('is relative to the page being edited', () => {
    expect(pageMentionHref('notes/today.md', 'notes/ideas.md')).toBe('ideas.md');
    expect(pageMentionHref('notes/today.md', 'guides/Getting Started.md')).toBe(
      '../guides/Getting%20Started.md',
    );
  });

  it('links to a folder page by its index file', () => {
    expect(pageMentionHref('notes/today.md', 'projects')).toBe('../projects/index.md');
  });

  it('links from a folder page through its index file', () => {
    expect(pageMentionHref('projects', 'notes/ideas.md')).toBe('../notes/ideas.md');
  });
});

describe('mentionItems', () => {
  it('lists pages (not the current one) then dates', () => {
    const items = mentionItems(source, '', now);
    expect(items.map((i) => i.title)).toEqual([
      'Ideas',
      'Getting Started',
      'Projects',
      'Today',
      'Tomorrow',
      'Next week',
    ]);
    expect(items.map((i) => i.category)).toEqual([
      'Pages',
      'Pages',
      'Pages',
      'Dates',
      'Dates',
      'Dates',
    ]);
    expect(items.find((i) => i.title === 'Tomorrow')?.description).toBe('2026-10-13');
    expect(items.find((i) => i.title === 'Next week')?.description).toBe('2026-10-19');
  });

  it('filters pages by title, case-insensitively', () => {
    expect(mentionItems(source, 'START', now).map((i) => i.title)).toEqual(['Getting Started']);
  });

  it('matches dates by label or by their text', () => {
    expect(mentionItems(source, 'tom', now).map((i) => i.title)).toEqual(['Tomorrow']);
    expect(mentionItems(source, '2026-10-19', now).map((i) => i.title)).toEqual(['Next week']);
  });

  it('offers only dates where the space has no pages to link', () => {
    expect(mentionItems(undefined, '', now).map((i) => i.category)).toEqual([
      'Dates',
      'Dates',
      'Dates',
    ]);
  });

  it('never offers a person', () => {
    const everything = mentionItems(source, '', now);
    expect(everything.some((i) => /person|people/i.test(`${i.category} ${i.title}`))).toBe(false);
    expect(mentionItems(source, 'person', now)).toEqual([]);
  });
});

describe('inserting a mention', () => {
  function editorWith(markdown: string) {
    const loaded = loadMarkdown(markdown);
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [...documentExtensions(), Mention.configure({ source: () => source })],
      content: loaded.doc,
    });
    const baseline = editorBaseline(loaded.parsed, editor.getJSON() as PmNode);
    const save = (): string => saveMarkdown(editor.getJSON() as PmNode, baseline);
    return { editor, save };
  }

  function choose(editor: Editor, title: string, query: string): void {
    // The query has been typed after an "@"; the menu replaces both with the item.
    const end = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(end); // the caret is after what was typed
    const range = { from: end - query.length - 1, to: end };
    const item = mentionItems(source, query, now).find((i) => i.title === title);
    if (!item) throw new Error(`no item ${title}`);
    item.command({ editor, range });
    // Typing on, as a user does: a space left at the end of a line would be saved as `&#x20;`.
    editor.commands.insertContent('now');
  }

  it('turns a page mention into a standard relative Markdown link', () => {
    const { editor, save } = editorWith('See @gett\n');
    choose(editor, 'Getting Started', 'gett');
    expect(save()).toBe('See [Getting Started](../guides/Getting%20Started.md) now\n');
    editor.destroy();
  });

  it('turns a date mention into plain text', () => {
    const { editor, save } = editorWith('Due @tom\n');
    choose(editor, 'Tomorrow', 'tom');
    expect(save()).toBe('Due 2026-10-13 now\n');
    editor.destroy();
  });

  it('feeds backlinks like any other link', () => {
    const { editor, save } = editorWith('See @ide\n');
    choose(editor, 'Ideas', 'ide');
    const graph = buildLinkGraph([
      { id: 'notes/today.md', file: 'notes/today.md', markdown: save() },
      { id: 'notes/ideas.md', file: 'notes/ideas.md', markdown: '# Ideas\n' },
    ]);
    expect(backlinksOf(graph, 'notes/ideas.md')).toEqual(['notes/today.md']);
    editor.destroy();
  });

  it('reloads a saved mention as the same link', () => {
    const { editor, save } = editorWith('See @ide\n');
    choose(editor, 'Ideas', 'ide');
    const markdown = save();
    editor.destroy();
    const again = editorWith(markdown);
    expect(again.save()).toBe(markdown);
    again.editor.destroy();
  });
});
