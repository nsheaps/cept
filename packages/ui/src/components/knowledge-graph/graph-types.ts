import type { GraphData, GraphLink, GraphNode } from '@cept/core';

export type { GraphData, GraphLink, GraphNode } from '@cept/core';

/** A node with the layout state the force simulation adds to it. */
export type LaidOutNode = GraphNode & {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
};

export interface GraphViewOptions {
  mode: 'global' | 'local';
  focusNodeId?: string;
  depth?: number;
  colorGroups?: Record<string, string>;
  showLabels?: boolean;
}

export function buildGraphData(
  pages: Array<{
    id: string;
    title: string;
    icon?: string;
    parent?: string;
    links?: string[];
    group?: string;
  }>,
): GraphData {
  const nodes: GraphNode[] = pages.map((p) => ({
    id: p.id,
    title: p.title,
    icon: p.icon,
    group: p.group,
  }));

  const links: GraphLink[] = [];
  const nodeIds = new Set(pages.map((p) => p.id));

  for (const page of pages) {
    if (page.parent && nodeIds.has(page.parent)) {
      links.push({ source: page.parent, target: page.id, type: 'parent' });
    }
    if (page.links) {
      for (const targetId of page.links) {
        if (nodeIds.has(targetId) && targetId !== page.id) {
          links.push({ source: page.id, target: targetId, type: 'link' });
        }
      }
    }
  }

  return { nodes, links };
}

export function filterByDepth(data: GraphData, focusId: string, maxDepth: number): GraphData {
  if (maxDepth < 0) return { nodes: [], links: [] };

  const adjacency = new Map<string, Set<string>>();
  for (const link of data.links) {
    const s =
      typeof link.source === 'string' ? link.source : (link.source as unknown as GraphNode).id;
    const t =
      typeof link.target === 'string' ? link.target : (link.target as unknown as GraphNode).id;
    if (!adjacency.has(s)) adjacency.set(s, new Set());
    if (!adjacency.has(t)) adjacency.set(t, new Set());
    adjacency.get(s)!.add(t);
    adjacency.get(t)!.add(s);
  }

  const visited = new Set<string>();
  const queue: [string, number][] = [[focusId, 0]];
  visited.add(focusId);

  while (queue.length > 0) {
    const [nodeId, depth] = queue.shift()!;
    if (depth < maxDepth) {
      const neighbors = adjacency.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([neighbor, depth + 1]);
          }
        }
      }
    }
  }

  const filteredNodes = data.nodes.filter((n) => visited.has(n.id));
  const filteredLinks = data.links.filter((l) => {
    const s = typeof l.source === 'string' ? l.source : (l.source as unknown as GraphNode).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as unknown as GraphNode).id;
    return visited.has(s) && visited.has(t);
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

export function getGroups(data: GraphData): string[] {
  const groups = new Set<string>();
  for (const node of data.nodes) {
    if (node.group) groups.add(node.group);
  }
  return [...groups].sort();
}

export function getLinkTypes(data: GraphData): Array<GraphLink['type']> {
  const types = new Set<GraphLink['type']>();
  for (const link of data.links) {
    types.add(link.type);
  }
  return [...types].sort();
}

const endId = (end: unknown): string => (typeof end === 'string' ? end : (end as GraphNode).id);

/** How many pages link to each page (Markdown links only; the page tree is not a reference). */
export function inLinkCounts(data: GraphData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of data.links) {
    if (link.type !== 'link') continue;
    const target = endId(link.target);
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return counts;
}

/** A node's drawn radius: grows with its incoming links, up to a cap; the focused node is larger. */
export function nodeRadius(inLinks: number, focused = false): number {
  const base = 6 + Math.min(Math.sqrt(inLinks) * 2.5, 10);
  return focused ? base + 3 : base;
}

export interface GraphFilters {
  groups?: Set<string>;
  linkTypes?: Set<GraphLink['type']>;
}

export function filterGraph(data: GraphData, filters: GraphFilters): GraphData {
  const { groups, linkTypes } = filters;

  let filteredNodes = data.nodes;
  if (groups && groups.size > 0) {
    filteredNodes = data.nodes.filter((n) => !n.group || groups.has(n.group));
  }

  const nodeIds = new Set(filteredNodes.map((n) => n.id));

  let filteredLinks = data.links.filter((l) => {
    const s = typeof l.source === 'string' ? l.source : (l.source as unknown as GraphNode).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as unknown as GraphNode).id;
    return nodeIds.has(s) && nodeIds.has(t);
  });

  if (linkTypes && linkTypes.size > 0) {
    filteredLinks = filteredLinks.filter((l) => linkTypes.has(l.type));
  }

  return { nodes: filteredNodes, links: filteredLinks };
}
