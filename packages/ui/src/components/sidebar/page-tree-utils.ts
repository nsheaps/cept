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
 * Rename a node in the tree.
 */
export function renameNode(nodes: PageTreeNode[], id: string, title: string): PageTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, title };
    }
    if (node.children.length > 0) {
      return { ...node, children: renameNode(node.children, id, title) };
    }
    return node;
  });
}

/**
 * Remove a node from the tree. Returns the updated tree and the removed node (if found).
 */
export function removeNode(
  nodes: PageTreeNode[],
  id: string,
): { tree: PageTreeNode[]; removed: PageTreeNode | null } {
  const filtered: PageTreeNode[] = [];
  let removed: PageTreeNode | null = null;

  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
    } else if (node.children.length > 0) {
      const result = removeNode(node.children, id);
      if (result.removed) {
        removed = result.removed;
        filtered.push({ ...node, children: result.tree });
      } else {
        filtered.push(node);
      }
    } else {
      filtered.push(node);
    }
  }
  return { tree: filtered, removed };
}

/**
 * Move a node to a new parent (or to root if parentId is undefined).
 * Returns the updated tree.
 */
export function moveNode(
  nodes: PageTreeNode[],
  nodeId: string,
  newParentId: string | undefined,
): PageTreeNode[] {
  const { tree, removed } = removeNode(nodes, nodeId);
  if (!removed) return nodes;

  if (!newParentId) {
    return [...tree, removed];
  }
  return addChild(tree, newParentId, removed);
}

/**
 * Add a child node under a parent.
 */
export function addChild(
  nodes: PageTreeNode[],
  parentId: string,
  child: PageTreeNode,
): PageTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...node.children, child], isExpanded: true };
    }
    if (node.children.length > 0) {
      return { ...node, children: addChild(node.children, parentId, child) };
    }
    return node;
  });
}

/**
 * Find a node by ID.
 */
export function findNode(nodes: PageTreeNode[], id: string): PageTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
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

/**
 * Set (or, with `undefined`, clear) a node's icon or cover. Nodes along the
 * way are copied only when something below them changed.
 */
export function setNodeMeta(
  nodes: PageTreeNode[],
  id: string,
  key: 'icon' | 'cover',
  value: string | undefined,
): PageTreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === id) {
      if (node[key] === value) return node;
      changed = true;
      const { [key]: _old, ...rest } = node;
      return value === undefined ? rest : { ...rest, [key]: value };
    }
    if (node.children.length > 0) {
      const children = setNodeMeta(node.children, id, key, value);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

/**
 * The pages that share a parent with `id` (itself included), in display order,
 * or `null`. Files that are not pages are left out: they have no place in the order.
 */
export function siblingsOf(nodes: PageTreeNode[], id: string): PageTreeNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return nodes.filter((n) => !n.foreign);
    const found = siblingsOf(node.children, id);
    if (found) return found;
  }
  return null;
}

/** A place `id` could be moved to: a page (it nests under it) or, with `id` '', the space root. */
export interface MoveTarget {
  id: string;
  title: string;
  depth: number;
}

function findWithParent(
  nodes: PageTreeNode[],
  id: string,
  parent: PageTreeNode | null = null,
): { node: PageTreeNode; parent: PageTreeNode | null } | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parent };
    const found = findWithParent(node.children, id, node);
    if (found) return found;
  }
  return null;
}

/**
 * Whether `id` may be moved into `targetId` ('' is the space root): the target
 * is a page (not a file), is not `id` or inside it, and is not where `id` already is.
 */
export function canMoveInto(nodes: PageTreeNode[], id: string, targetId: string): boolean {
  const found = findWithParent(nodes, id);
  if (!found) return false;
  if ((found.parent?.id ?? '') === targetId) return false;
  if (targetId === '') return true;
  if (targetId === id) return false;
  const target = findWithParent(nodes, targetId)?.node;
  return !!target && !target.foreign && !findWithParent(found.node.children, targetId);
}

/** Every page `id` could be moved into, in tree order with its depth; the root is offered separately. */
export function moveTargets(nodes: PageTreeNode[], id: string): MoveTarget[] {
  const source = findWithParent(nodes, id);
  if (!source) return [];
  const parentId = source.parent?.id;
  const walk = (level: PageTreeNode[], depth: number): MoveTarget[] =>
    level.flatMap((node) => {
      // A page cannot move into itself or anything under it: stop at the source.
      if (node.id === id) return [];
      return [
        ...(node.foreign || node.id === parentId
          ? []
          : [{ id: node.id, title: node.title, depth }]),
        ...(node.foreign ? [] : walk(node.children, depth + 1)),
      ];
    });
  return walk(nodes, 0);
}
