import { describe, it, expect } from 'vitest';
import { readPageMeta, setPageMeta } from './page-meta.js';

describe('setPageMeta', () => {
  it('adds an icon to a page without front matter, leaving the body alone', () => {
    expect(setPageMeta('# Hello\n', 'icon', '🚀')).toBe('---\nicon: 🚀\n---\n# Hello\n');
  });

  it('updates only the icon key and keeps every other line byte for byte', () => {
    const text = [
      '---',
      '# kept comment',
      'title:   "Spaced   title"',
      'icon: 📄',
      'tags: [a,   b]',
      'cover: https://example.com/c.jpg',
      '---',
      '',
      'Body  text',
      '',
    ].join('\n');
    const next = setPageMeta(text, 'icon', '🚀');
    expect(next).toBe(text.replace('icon: 📄', 'icon: 🚀'));
  });

  it('sets and removes the cover without touching the icon', () => {
    const text = '---\nicon: 🚀\n---\nBody\n';
    const withCover = setPageMeta(text, 'cover', 'https://example.com/a.png');
    expect(withCover).toBe('---\nicon: 🚀\ncover: https://example.com/a.png\n---\nBody\n');
    expect(setPageMeta(withCover, 'cover', undefined)).toBe(text);
  });

  it('does not rewrite front matter that is not valid YAML', () => {
    const text = '---\ntitle: [unclosed\n---\nBody\n';
    expect(setPageMeta(text, 'icon', '🚀')).toBe(text);
  });
});

describe('readPageMeta', () => {
  it('reads the icon and cover', () => {
    expect(readPageMeta('---\nicon: 🚀\ncover: https://example.com/a.png\n---\nBody\n')).toEqual({
      icon: '🚀',
      cover: 'https://example.com/a.png',
    });
  });

  it('is empty for a page without front matter', () => {
    expect(readPageMeta('Body\n')).toEqual({});
  });
});
