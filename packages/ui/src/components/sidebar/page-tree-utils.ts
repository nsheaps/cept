import type { PageTreeNode } from './PageTreeItem.js';

/**
 * Find the path of ancestor IDs from root to the node with the given ID.
 * Returns the IDs of all ancestors (NOT including the target node itself).
 */
export function findAncestorIds(nodes: PageTreeNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [];
    }
    if (node.children.length > 0) {
      const childPath = findAncestorIds(node.children, targetId);
      if (childPath !== null) {
        return [node.id, ...childPath];
      }
    }
  }
  return null;
}

/**
 * Expand all ancestor nodes leading to the target node.
 * Returns a new tree with ancestors expanded.
 */
export function expandToNode(nodes: PageTreeNode[], targetId: string): PageTreeNode[] {
  const ancestorIds = findAncestorIds(nodes, targetId);
  if (!ancestorIds || ancestorIds.length === 0) {
    return nodes;
  }
  const idSet = new Set(ancestorIds);
  return expandNodes(nodes, idSet);
}

function expandNodes(nodes: PageTreeNode[], idsToExpand: Set<string>): PageTreeNode[] {
  return nodes.map((node) => {
    if (idsToExpand.has(node.id)) {
      return {
        ...node,
        isExpanded: true,
        children: expandNodes(node.children, idsToExpand),
      };
    }
    if (node.children.length > 0) {
      return { ...node, children: expandNodes(node.children, idsToExpand) };
    }
    return node;
  });
}

/**
 * Get the breadcrumb trail (list of nodes from root to target).
 */
export function getBreadcrumbs(
  nodes: PageTreeNode[],
  targetId: string,
): Array<{ id: string; title: string; icon?: string }> | null {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [{ id: node.id, title: node.title, icon: node.icon }];
    }
    if (node.children.length > 0) {
      const childTrail = getBreadcrumbs(node.children, targetId);
      if (childTrail !== null) {
        return [{ id: node.id, title: node.title, icon: node.icon }, ...childTrail];
      }
    }
  }
  return null;
}
