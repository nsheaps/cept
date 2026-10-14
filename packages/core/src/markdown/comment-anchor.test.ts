import { describe, expect, it } from 'vitest';
import {
  ANCHOR_CONTEXT_LENGTH,
  createAnchor,
  githubAuthor,
  localAuthor,
  newCommentId,
  resolveAnchor,
} from './comment-anchor.js';

const text = 'First, run mise install in the repo root. Then run mise install again.';

describe('createAnchor', () => {
  it('keeps the quote with context either side', () => {
    const from = text.indexOf('run mise install');
    expect(createAnchor(text, from, from + 'run mise install'.length)).toEqual({
      quote: 'run mise install',
      prefix: 'First, ',
      suffix: ' in the repo root. Then run mise',
    });
  });

  it('keeps at most 32 characters of context', () => {
    const long = `${'a'.repeat(50)}QUOTE${'b'.repeat(50)}`;
    const anchor = createAnchor(long, 50, 55);
    expect(anchor.prefix).toBe('a'.repeat(ANCHOR_CONTEXT_LENGTH));
    expect(anchor.suffix).toBe('b'.repeat(ANCHOR_CONTEXT_LENGTH));
  });

  it('leaves out context that is empty', () => {
    expect(createAnchor('quote', 0, 5)).toEqual({ quote: 'quote' });
  });
});

describe('resolveAnchor', () => {
  it('finds a quote exactly', () => {
    const anchor = createAnchor(text, 7, 23);
    expect(resolveAnchor(text, anchor)).toEqual({ from: 7, to: 23, exact: true });
  });

  it('uses the context to choose between repeats', () => {
    const second = text.lastIndexOf('run mise install');
    const anchor = createAnchor(text, second, second + 16);
    expect(resolveAnchor(text, anchor)).toEqual({ from: second, to: second + 16, exact: true });
    const first = text.indexOf('run mise install');
    const firstAnchor = createAnchor(text, first, first + 16);
    expect(resolveAnchor(text, firstAnchor)?.from).toBe(first);
  });

  it('still finds the quote after text around it changed', () => {
    const anchor = createAnchor(text, 7, 23);
    const edited = `Intro added.\n\n${text}`;
    expect(resolveAnchor(edited, anchor)?.from).toBe(edited.indexOf('run mise install'));
  });

  it('follows the context when a repeat is inserted before the original', () => {
    const second = text.lastIndexOf('run mise install');
    const anchor = createAnchor(text, second, second + 16);
    const edited = `Also run mise install here. ${text}`;
    expect(resolveAnchor(edited, anchor)?.from).toBe(edited.lastIndexOf('run mise install'));
  });

  it('ignores case and white space changes', () => {
    const anchor = { quote: 'Run  mise\ninstall' };
    const match = resolveAnchor('First, run mise install now.', anchor);
    expect(match).toEqual({ from: 7, to: 23, exact: false });
  });

  it('accepts a close match when the quoted text was edited', () => {
    const anchor = { quote: 'the quick brown fox jumps over' };
    const match = resolveAnchor('so the quick brown fax jumps over it', anchor);
    expect(match).toEqual({ from: 3, to: 33, exact: false });
  });

  it('returns null when the quote is gone', () => {
    expect(resolveAnchor(text, { quote: 'completely different words here' })).toBeNull();
  });

  it('does not match short quotes approximately', () => {
    expect(resolveAnchor('abcdefg', { quote: 'abcxefg' })).toBeNull();
  });

  it('returns null for an empty quote or an empty text', () => {
    expect(resolveAnchor(text, { quote: '' })).toBeNull();
    expect(resolveAnchor('', { quote: 'something long enough' })).toBeNull();
  });

  it('maps a loose match back to the original offsets', () => {
    const spaced = 'a   b\n\nTHE  QUICK  fox c';
    const match = resolveAnchor(spaced, { quote: 'the quick fox' });
    expect(match && spaced.slice(match.from, match.to)).toBe('THE  QUICK  fox');
  });
});

describe('newCommentId', () => {
  it('is c- and ten lowercase letters or digits', () => {
    expect(newCommentId()).toMatch(/^c-[a-z0-9]{10}$/);
  });

  it('uses the random source it is given', () => {
    expect(newCommentId(() => new Uint8Array(10))).toBe('c-aaaaaaaaaa');
    expect(newCommentId(() => new Uint8Array(10).fill(35))).toBe('c-9999999999');
  });

  it('differs between calls', () => {
    expect(newCommentId()).not.toBe(newCommentId());
  });
});

describe('authors', () => {
  it('uses the GitHub name, or the login when there is none', () => {
    expect(githubAuthor('nsheaps', ' Nate Heaps ')).toEqual({
      id: 'github:nsheaps',
      name: 'Nate Heaps',
    });
    expect(githubAuthor('nsheaps', null)).toEqual({ id: 'github:nsheaps', name: 'nsheaps' });
    expect(githubAuthor('nsheaps', '  ')).toEqual({ id: 'github:nsheaps', name: 'nsheaps' });
  });

  it('gives a device-local author a random local id', () => {
    const author = localAuthor('  Me ');
    expect(author.name).toBe('Me');
    expect(author.id).toMatch(/^local:[a-z0-9]{10}$/);
  });
});
