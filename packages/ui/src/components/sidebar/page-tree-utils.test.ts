import { describe, it, expect } from 'vitest';
import { findAncestorIds, expandToNode, getBreadcrumbs } from './page-tree-utils.js';
import type { PageTreeNode } from './PageTreeItem.js';

const tree: PageTreeNode[] = [
  {
    id: 'root-1',
    title: 'Root 1',
    icon: '\u{1F4C1}',
    isExpanded: false,
    children: [
      {
        id: 'child-1',
        title: 'Child 1',
        children: [
          { id: 'grandchild-1', title: 'Grandchild 1', children: [] },
          { id: 'grandchild-2', title: 'Grandchild 2', children: [] },
        ],
      },
      { id: 'child-2', title: 'Child 2', children: [] },
    ],
  },
  {
    id: 'root-2',
    title: 'Root 2',
    children: [],
  },
];

describe('findAncestorIds', () => {
  it('returns empty array for root-level node', () => {
    expect(findAncestorIds(tree, 'root-1')).toEqual([]);
  });

  it('returns parent ID for direct child', () => {
    expect(findAncestorIds(tree, 'child-1')).toEqual(['root-1']);
  });

  it('returns full ancestor chain for deeply nested node', () => {
    expect(findAncestorIds(tree, 'grandchild-1')).toEqual(['root-1', 'child-1']);
  });

  it('returns null for non-existent node', () => {
    expect(findAncestorIds(tree, 'missing')).toBeNull();
  });

  it('finds node in second root', () => {
    expect(findAncestorIds(tree, 'root-2')).toEqual([]);
  });
});

describe('expandToNode', () => {
  it('expands ancestors to reveal a deeply nested node', () => {
    const result = expandToNode(tree, 'grandchild-1');
    // root-1 should now be expanded
    expect(result[0].isExpanded).toBe(true);
    // child-1 should now be expanded
    expect(result[0].children[0].isExpanded).toBe(true);
    // root-2 should be unchanged
    expect(result[1].isExpanded).toBeUndefined();
  });

  it('returns same tree if node is at root level', () => {
    const result = expandToNode(tree, 'root-2');
    // Nothing should change since no ancestors to expand
    expect(result[0].isExpanded).toBe(false);
  });

  it('returns same tree if node is not found', () => {
    const result = expandToNode(tree, 'missing');
    expect(result[0].isExpanded).toBe(false);
  });

  it('expands only the path to the target, not siblings', () => {
    const result = expandToNode(tree, 'grandchild-1');
    // child-2 should not be affected
    expect(result[0].children[1].isExpanded).toBeUndefined();
  });
});

describe('getBreadcrumbs', () => {
  it('returns single item for root-level node', () => {
    expect(getBreadcrumbs(tree, 'root-1')).toEqual([
      { id: 'root-1', title: 'Root 1', icon: '\u{1F4C1}' },
    ]);
  });

  it('returns full breadcrumb trail for nested node', () => {
    expect(getBreadcrumbs(tree, 'grandchild-1')).toEqual([
      { id: 'root-1', title: 'Root 1', icon: '\u{1F4C1}' },
      { id: 'child-1', title: 'Child 1', icon: undefined },
      { id: 'grandchild-1', title: 'Grandchild 1', icon: undefined },
    ]);
  });

  it('returns null for non-existent node', () => {
    expect(getBreadcrumbs(tree, 'missing')).toBeNull();
  });

  it('returns correct trail for direct child', () => {
    expect(getBreadcrumbs(tree, 'child-2')).toEqual([
      { id: 'root-1', title: 'Root 1', icon: '\u{1F4C1}' },
      { id: 'child-2', title: 'Child 2', icon: undefined },
    ]);
  });
});
