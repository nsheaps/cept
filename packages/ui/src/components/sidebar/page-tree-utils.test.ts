import { describe, it, expect } from 'vitest';
import { findAncestorIds, expandToNode, getBreadcrumbs, renameNode, removeNode, moveNode, findNode, addChild } from './page-tree-utils.js';
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

describe('renameNode', () => {
  it('renames a root node', () => {
    const result = renameNode(tree, 'root-1', 'New Name');
    expect(result[0].title).toBe('New Name');
  });

  it('renames a nested node', () => {
    const result = renameNode(tree, 'grandchild-1', 'Updated');
    expect(result[0].children[0].children[0].title).toBe('Updated');
  });

  it('does not change other nodes', () => {
    const result = renameNode(tree, 'root-1', 'New Name');
    expect(result[1].title).toBe('Root 2');
  });
});

describe('removeNode', () => {
  it('removes a root node', () => {
    const { tree: result, removed } = removeNode(tree, 'root-2');
    expect(result).toHaveLength(1);
    expect(removed?.id).toBe('root-2');
  });

  it('removes a nested node', () => {
    const { tree: result, removed } = removeNode(tree, 'grandchild-1');
    expect(removed?.id).toBe('grandchild-1');
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].id).toBe('grandchild-2');
  });

  it('returns null removed for missing node', () => {
    const { tree: result, removed } = removeNode(tree, 'missing');
    expect(removed).toBeNull();
    expect(result).toHaveLength(2);
  });
});

describe('moveNode', () => {
  it('moves a nested node to root', () => {
    const result = moveNode(tree, 'child-1', undefined);
    // child-1 should be at root level now
    expect(result.find((n) => n.id === 'child-1')).toBeDefined();
    // root-1 should no longer have child-1
    const root1 = result.find((n) => n.id === 'root-1');
    expect(root1?.children.find((c) => c.id === 'child-1')).toBeUndefined();
  });

  it('moves a root node under another node', () => {
    const result = moveNode(tree, 'root-2', 'root-1');
    expect(result).toHaveLength(1);
    const root1 = result[0];
    expect(root1.children.find((c) => c.id === 'root-2')).toBeDefined();
  });

  it('returns unchanged tree for missing node', () => {
    const result = moveNode(tree, 'missing', 'root-1');
    expect(result).toHaveLength(2);
  });
});

describe('findNode', () => {
  it('finds a root node', () => {
    expect(findNode(tree, 'root-1')?.title).toBe('Root 1');
  });

  it('finds a nested node', () => {
    expect(findNode(tree, 'grandchild-2')?.title).toBe('Grandchild 2');
  });

  it('returns null for missing node', () => {
    expect(findNode(tree, 'missing')).toBeNull();
  });
});

describe('addChild', () => {
  it('adds a child to a root node', () => {
    const child: PageTreeNode = { id: 'new', title: 'New', children: [] };
    const result = addChild(tree, 'root-2', child);
    expect(result[1].children).toHaveLength(1);
    expect(result[1].children[0].id).toBe('new');
    expect(result[1].isExpanded).toBe(true);
  });

  it('adds a child to a nested node', () => {
    const child: PageTreeNode = { id: 'new', title: 'New', children: [] };
    const result = addChild(tree, 'child-1', child);
    expect(result[0].children[0].children).toHaveLength(3);
  });
});
