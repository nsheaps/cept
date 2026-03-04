import { Mention } from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';

export type MentionType = 'page' | 'person' | 'date';

export interface MentionSuggestionItem {
  id: string;
  label: string;
  type: MentionType;
  icon?: string;
}

export function filterMentionItems(
  items: MentionSuggestionItem[],
  query: string,
): MentionSuggestionItem[] {
  const q = query.toLowerCase();
  return items.filter((item) => item.label.toLowerCase().includes(q));
}

export function getDefaultDateSuggestions(): MentionSuggestionItem[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const format = (d: Date) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return [
    { id: 'today', label: `Today (${format(today)})`, type: 'date', icon: '\u{1F4C5}' },
    { id: 'tomorrow', label: `Tomorrow (${format(tomorrow)})`, type: 'date', icon: '\u{1F4C5}' },
    { id: 'next-week', label: `Next week (${format(nextWeek)})`, type: 'date', icon: '\u{1F4C5}' },
  ];
}

export const PageMention = Mention.extend({ name: 'pageMention' }).configure({
  HTMLAttributes: {
    class: 'cept-mention cept-mention-page',
    'data-mention-type': 'page',
  },
  suggestion: {
    char: '@',
    items: ({ query }: { query: string }) =>
      filterMentionItems([], query),
  } as Partial<SuggestionOptions>,
});

export const PersonMention = Mention.extend({ name: 'personMention' }).configure({
  HTMLAttributes: {
    class: 'cept-mention cept-mention-person',
    'data-mention-type': 'person',
  },
  suggestion: {
    char: '@',
    items: ({ query }: { query: string }) =>
      filterMentionItems([], query),
  } as Partial<SuggestionOptions>,
});

export const DateMention = Mention.extend({ name: 'dateMention' }).configure({
  HTMLAttributes: {
    class: 'cept-mention cept-mention-date',
    'data-mention-type': 'date',
  },
  renderText: ({ node }) => {
    return `@${(node.attrs as { label?: string }).label ?? (node.attrs as { id: string }).id}`;
  },
  suggestion: {
    char: '@',
    items: ({ query }: { query: string }) =>
      filterMentionItems(getDefaultDateSuggestions(), query),
  } as Partial<SuggestionOptions>,
});
