import { describe, expect, it } from 'vitest';
import type { PageTreeNode } from './PageTreeItem.js';
import { withCommentCounts } from './comment-counts.js';

const tree: PageTreeNode[] = [
  { id: 'README.md', title: 'Notes', children: [] },
  {
    id: 'guides/index.md',
    title: 'Guides',
    children: [{ id: 'guides/setup.md', title: 'Setup', children: [] }],
  },
];

describe('withCommentCounts', () => {
  it('puts each page’s count on its node, at any depth', () => {
    const out = withCommentCounts(
      tree,
      new Map([
        ['README.md', 1],
        ['guides/setup.md', 3],
      ]),
    );
    expect(out[0]?.comments).toBe(1);
    expect(out[1]?.comments).toBeUndefined();
    expect(out[1]?.children[0]?.comments).toBe(3);
  });

  it('returns the same tree when there is nothing to show, and does not change the input', () => {
    expect(withCommentCounts(tree, new Map())).toBe(tree);
    withCommentCounts(tree, new Map([['README.md', 2]]));
    expect(tree[0]?.comments).toBeUndefined();
  });

  it('keeps untouched branches as they are', () => {
    const out = withCommentCounts(tree, new Map([['README.md', 1]]));
    expect(out[1]).toBe(tree[1]);
  });
});
