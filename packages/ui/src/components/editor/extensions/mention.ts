/**
 * `@` mentions of pages and dates (REQ-EDT-004; phase-1 plan PR 58).
 *
 * A mention is not a node of its own: that would need a Markdown encoding no
 * other tool understands. Choosing a page inserts its title as a standard link
 * to the page file, written relative to the page being edited, so the file
 * stays portable and the link feeds backlinks, search and move-rewriting like
 * any other. Choosing a date inserts it as plain text in ISO 8601
 * (`YYYY-MM-DD`). `@person` is not offered.
 */

import { Extension, type Editor } from '@tiptap/core';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { baseFileOfPage, linkPathBetween } from '@cept/core';
import type { SlashCommandItem } from './slash-command.js';

/** A page of the space that an `@` mention can link to. */
export interface MentionPage {
  /** The page id: its file or folder path relative to the space root. */
  id: string;
  title: string;
  icon?: string;
}

/** What the mention menu needs from the app; read afresh on every keystroke. */
export interface MentionSource {
  /** The id of the page being edited. */
  pageId: string;
  /** The pages that can be linked to. */
  pages: readonly MentionPage[];
}

const MAX_PAGES = 8;

/** A date as `YYYY-MM-DD`, in local time. */
export function formatMentionDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The URL of a link from the page `fromId` to the page `toId`. */
export function pageMentionHref(fromId: string, toId: string): string {
  return linkPathBetween(baseFileOfPage(fromId), baseFileOfPage(toId));
}

/** The `@` menu's items for `query`: pages whose title contains it, then the dates that match. */
export function mentionItems(
  source: MentionSource | undefined,
  query: string,
  now: Date = new Date(),
): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  const items: SlashCommandItem[] = [];

  if (source) {
    const matching = source.pages
      .filter((p) => p.id !== source.pageId && p.title.toLowerCase().includes(q))
      .slice(0, MAX_PAGES);
    for (const page of matching) {
      items.push({
        title: page.title,
        description: page.id,
        icon: page.icon ?? '\u{1F4C4}',
        category: 'Pages',
        command: ({ editor, range }) => {
          insertAfterMention(editor, range, {
            type: 'text',
            text: page.title,
            marks: [{ type: 'link', attrs: { href: pageMentionHref(source.pageId, page.id) } }],
          });
        },
      });
    }
  }

  const day = (offset: number): Date => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d;
  };
  const dates: Array<[string, number]> = [
    ['Today', 0],
    ['Tomorrow', 1],
    ['Next week', 7],
  ];
  for (const [label, offset] of dates) {
    const text = formatMentionDate(day(offset));
    if (!label.toLowerCase().includes(q) && !text.includes(q)) continue;
    items.push({
      title: label,
      description: text,
      icon: '\u{1F4C5}',
      category: 'Dates',
      command: ({ editor, range }) => {
        insertAfterMention(editor, range, { type: 'text', text });
      },
    });
  }
  return items;
}

function insertAfterMention(
  editor: Editor,
  range: { from: number; to: number },
  content: { type: 'text'; text: string; marks?: Array<{ type: string; attrs: object }> },
): void {
  // The trailing space is unmarked so typing continues outside the link.
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([content, { type: 'text', text: ' ' }])
    .run();
}

export const mentionPluginKey = new PluginKey('mention');

export interface MentionOptions {
  /** The mentionable pages of the space, or undefined where only dates are offered. */
  source: () => MentionSource | undefined;
  suggestion: Partial<SuggestionOptions>;
}

export const Mention = Extension.create<MentionOptions>({
  name: 'mention',

  addOptions() {
    return {
      source: () => undefined,
      suggestion: {
        char: '@',
        pluginKey: mentionPluginKey,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        items: ({ query }: { query: string }) => mentionItems(this.options.source(), query),
        ...this.options.suggestion,
      }),
    ];
  },
});
