import { describe, it, expect } from 'vitest';
import {
  CONFLICT_MARKERS,
  hasConflictMarkers,
  mergeFrontMatter,
  mergeLines,
  mergeText,
} from './text-merge.js';

const lines = (...l: string[]) => l.join('\n');

describe('mergeLines (REQ-WS-026)', () => {
  it('takes the side that changed when the other did not', () => {
    expect(mergeLines('a\nb\n', 'a\nB\n', 'a\nb\n')).toEqual({ clean: true, merged: 'a\nB\n' });
    expect(mergeLines('a\nb\n', 'a\nb\n', 'a\nB\n')).toEqual({ clean: true, merged: 'a\nB\n' });
  });

  it('merges changes to different parts of the file', () => {
    const base = lines('one', 'two', 'three', 'four', 'five', '');
    const mine = lines('ONE', 'two', 'three', 'four', 'five', '');
    const theirs = lines('one', 'two', 'three', 'four', 'FIVE', '');
    expect(mergeLines(base, mine, theirs)).toEqual({
      clean: true,
      merged: lines('ONE', 'two', 'three', 'four', 'FIVE', ''),
    });
  });

  it('merges lines inserted on one side with a change on the other', () => {
    const base = lines('# Title', '', 'para one', '', 'para two', '');
    const mine = lines('# Title', '', 'intro', '', 'para one', '', 'para two', '');
    const theirs = lines('# Title', '', 'para one', '', 'para two, edited', '');
    expect(mergeLines(base, mine, theirs)).toEqual({
      clean: true,
      merged: lines('# Title', '', 'intro', '', 'para one', '', 'para two, edited', ''),
    });
  });

  it('accepts the same change made on both sides', () => {
    expect(mergeLines('a\nb\nc', 'a\nX\nc', 'a\nX\nc')).toEqual({ clean: true, merged: 'a\nX\nc' });
  });

  it('marks a line both sides changed differently as a conflict', () => {
    const result = mergeLines('a\nb\nc', 'a\nmine\nc', 'a\ntheirs\nc');
    expect(result.clean).toBe(false);
    expect(result.merged).toBe(
      lines(
        'a',
        CONFLICT_MARKERS.mine,
        'mine',
        CONFLICT_MARKERS.separator,
        'theirs',
        CONFLICT_MARKERS.theirs,
        'c',
      ),
    );
    expect(hasConflictMarkers(result.merged)).toBe(true);
  });

  it('keeps a deletion on one side when the other did not touch the lines', () => {
    expect(mergeLines('a\nb\nc\nd', 'a\nc\nd', 'a\nb\nc\nD')).toEqual({
      clean: true,
      merged: 'a\nc\nD',
    });
  });
});

describe('mergeFrontMatter (REQ-WS-026)', () => {
  it('merges different keys changed on each side', () => {
    const base = ['title: Plan', 'tags: [a]', 'status: draft'];
    const mine = ['title: The plan', 'tags: [a]', 'status: draft'];
    const theirs = ['title: Plan', 'tags: [a]', 'status: done'];
    expect(mergeFrontMatter(base, mine, theirs)).toEqual({
      clean: true,
      lines: ['title: The plan', 'tags: [a]', 'status: done'],
    });
  });

  it('merges keys added on both sides, even next to each other', () => {
    const base = ['title: Plan'];
    const mine = ['title: Plan', 'owner: me'];
    const theirs = ['title: Plan', 'due: 2026-10-09'];
    expect(mergeFrontMatter(base, mine, theirs)).toEqual({
      clean: true,
      lines: ['title: Plan', 'owner: me', 'due: 2026-10-09'],
    });
  });

  it('keeps a key removed on one side and untouched on the other removed', () => {
    expect(mergeFrontMatter(['a: 1', 'b: 2'], ['a: 1'], ['a: 1', 'b: 2'])).toEqual({
      clean: true,
      lines: ['a: 1'],
    });
  });

  it('moves nested lines with their key', () => {
    const base = ['tags:', '  - a', 'title: Plan'];
    const mine = ['tags:', '  - a', '  - b', 'title: Plan'];
    const theirs = ['tags:', '  - a', 'title: Better plan'];
    expect(mergeFrontMatter(base, mine, theirs)).toEqual({
      clean: true,
      lines: ['tags:', '  - a', '  - b', 'title: Better plan'],
    });
  });

  it('is a conflict when both sides change the same key differently', () => {
    const result = mergeFrontMatter(['title: Plan'], ['title: Mine'], ['title: Theirs']);
    expect(result.clean).toBe(false);
    expect(result.lines).toEqual([
      CONFLICT_MARKERS.mine,
      'title: Mine',
      CONFLICT_MARKERS.separator,
      'title: Theirs',
      CONFLICT_MARKERS.theirs,
    ]);
  });
});

describe('mergeText (REQ-WS-026)', () => {
  const page = (front: string[], body: string) => ['---', ...front, '---', body].join('\n');

  it('merges a page whose front matter and body changed on different sides', () => {
    const base = page(['title: Plan', 'status: draft'], '# Plan\n\nShip it.\n');
    const mine = page(['title: Plan', 'status: done'], '# Plan\n\nShip it.\n');
    const theirs = page(['title: Plan', 'status: draft', 'owner: sam'], '# Plan\n\nShip it now.\n');
    expect(mergeText('notes/plan.md', base, mine, theirs)).toEqual({
      clean: true,
      merged: page(['title: Plan', 'status: done', 'owner: sam'], '# Plan\n\nShip it now.\n'),
    });
  });

  it('merges front matter keys that a line merge would see as one conflict', () => {
    const base = page(['title: Plan'], 'Body\n');
    const mine = page(['title: Plan', 'a: 1'], 'Body\n');
    const theirs = page(['title: Plan', 'b: 2'], 'Body\n');
    expect(mergeLines(base, mine, theirs).clean).toBe(false);
    expect(mergeText('plan.md', base, mine, theirs)).toEqual({
      clean: true,
      merged: page(['title: Plan', 'a: 1', 'b: 2'], 'Body\n'),
    });
  });

  it('adds front matter added on one side to a page without it', () => {
    expect(mergeText('p.md', 'Body\n', '---\ntitle: P\n---\nBody\n', 'Body, edited\n')).toEqual({
      clean: true,
      merged: '---\ntitle: P\n---\nBody, edited\n',
    });
  });

  it('merges other files line by line', () => {
    const result = mergeText('space.cept.yaml', 'name: A\n', 'name: B\n', 'name: C\n');
    expect(result.clean).toBe(false);
  });

  it('treats a file both sides added as a conflict unless they agree', () => {
    expect(mergeText('new.md', null, 'mine\n', 'mine\n')).toEqual({
      clean: true,
      merged: 'mine\n',
    });
    expect(mergeText('new.md', null, 'mine\n', 'theirs\n').clean).toBe(false);
  });
});
