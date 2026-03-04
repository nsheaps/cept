import { describe, it, expect } from 'vitest';
import {
  filterMentionItems,
  getDefaultDateSuggestions,
  PageMention,
  PersonMention,
  DateMention,
  type MentionSuggestionItem,
} from './mention.js';

describe('filterMentionItems', () => {
  const items: MentionSuggestionItem[] = [
    { id: '1', label: 'Project Roadmap', type: 'page' },
    { id: '2', label: 'Meeting Notes', type: 'page' },
    { id: '3', label: 'Alice Smith', type: 'person' },
    { id: '4', label: 'Bob Jones', type: 'person' },
  ];

  it('returns all items for empty query', () => {
    expect(filterMentionItems(items, '')).toHaveLength(4);
  });

  it('filters by label substring', () => {
    const result = filterMentionItems(items, 'road');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Project Roadmap');
  });

  it('is case insensitive', () => {
    const result = filterMentionItems(items, 'ALICE');
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Alice Smith');
  });

  it('returns empty for no matches', () => {
    expect(filterMentionItems(items, 'xyz')).toHaveLength(0);
  });
});

describe('getDefaultDateSuggestions', () => {
  it('returns three date options', () => {
    const dates = getDefaultDateSuggestions();
    expect(dates).toHaveLength(3);
  });

  it('has today, tomorrow, and next week', () => {
    const dates = getDefaultDateSuggestions();
    const ids = dates.map((d) => d.id);
    expect(ids).toContain('today');
    expect(ids).toContain('tomorrow');
    expect(ids).toContain('next-week');
  });

  it('all items are date type', () => {
    const dates = getDefaultDateSuggestions();
    for (const d of dates) {
      expect(d.type).toBe('date');
    }
  });

  it('all items have calendar icon', () => {
    const dates = getDefaultDateSuggestions();
    for (const d of dates) {
      expect(d.icon).toBe('\u{1F4C5}');
    }
  });
});

describe('PageMention', () => {
  it('has name pageMention', () => {
    expect(PageMention.name).toBe('pageMention');
  });
});

describe('PersonMention', () => {
  it('has name personMention', () => {
    expect(PersonMention.name).toBe('personMention');
  });
});

describe('DateMention', () => {
  it('has name dateMention', () => {
    expect(DateMention.name).toBe('dateMention');
  });
});
