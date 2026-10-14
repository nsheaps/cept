import { beforeEach, describe, expect, it } from 'vitest';
import type { PageComment } from '@cept/core';
import type { ListedComment } from '../editor/extensions/comment.js';
import { countNewComments, lastVisit, markVisited } from './comment-visits.js';

const me = { id: 'github:nsheaps', name: 'Nate' };
const sam = { id: 'github:sam', name: 'Sam' };

function listed(id: string, created: string, author = sam): ListedComment {
  const comment: PageComment = { id, author, created, body: id };
  return { comment, kind: 'page' };
}

describe('countNewComments', () => {
  const comments = [
    listed('c-1', '2026-10-01T10:00:00Z'),
    listed('c-2', '2026-10-03T10:00:00Z'),
    listed('c-3', '2026-10-04T10:00:00Z', me),
  ];

  it('counts other people’s comments created after the last visit', () => {
    expect(countNewComments(comments, '2026-10-02T00:00:00Z', me.id)).toBe(1);
  });

  it('counts nothing on a page never opened here, so a first visit shows no badge', () => {
    expect(countNewComments(comments, null, me.id)).toBe(0);
  });

  it('counts your own comments when you are not identified', () => {
    expect(countNewComments(comments, '2026-10-02T00:00:00Z', null)).toBe(2);
  });

  it('compares instants, not text, so seconds and milliseconds agree', () => {
    const edge = [listed('c-4', '2026-10-02T00:00:00.500Z')];
    expect(countNewComments(edge, '2026-10-02T00:00:00Z', me.id)).toBe(1);
  });
});

describe('page visits on this device', () => {
  beforeEach(() => localStorage.clear());

  it('remembers when a page was last opened, per space', () => {
    expect(lastVisit('space-a', 'notes.md')).toBeNull();
    markVisited('space-a', 'notes.md', '2026-10-14T06:00:00Z');
    expect(lastVisit('space-a', 'notes.md')).toBe('2026-10-14T06:00:00Z');
    expect(lastVisit('space-b', 'notes.md')).toBeNull();
  });

  it('keeps working when storage is unavailable', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(lastVisit('space-a', 'notes.md')).toBeNull();
      expect(() => markVisited('space-a', 'notes.md', '2026-10-14T06:00:00Z')).not.toThrow();
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
