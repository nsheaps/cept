import type { PageTreeNode } from './PageTreeItem.js';

/**
 * The tree with each page's open-comment count on it (REQ-NTN-008). A branch
 * with no counts in it is returned as it is, so unchanged rows keep their identity.
 */
export function withCommentCounts(
  nodes: PageTreeNode[],
  counts: ReadonlyMap<string, number>,
): PageTreeNode[] {
  if (counts.size === 0) return nodes;
  let changed = false;
  const out = nodes.map((node) => {
    const children = withCommentCounts(node.children, counts);
    const comments = counts.get(node.id);
    if (children === node.children && comments === undefined) return node;
    changed = true;
    return {
      ...node,
      children,
      ...(comments !== undefined ? { comments } : {}),
    };
  });
  return changed ? out : nodes;
}
