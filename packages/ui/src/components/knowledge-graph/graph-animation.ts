import type { GraphData, GraphNode, GraphLink } from './graph-types.js';

export interface TimestampedNode extends GraphNode {
  createdAt?: string;
}

export interface AnimationFrame {
  time: string;
  data: GraphData;
}

export function buildAnimationFrames(
  nodes: TimestampedNode[],
  links: GraphLink[],
  frameCount: number,
): AnimationFrame[] {
  const dated = nodes.filter((n) => n.createdAt);
  if (dated.length === 0) return [];

  const sorted = [...dated].sort(
    (a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(),
  );
  const undated = nodes.filter((n) => !n.createdAt);

  const startTime = new Date(sorted[0].createdAt!).getTime();
  const endTime = new Date(sorted[sorted.length - 1].createdAt!).getTime();

  if (startTime === endTime) {
    return [{ time: sorted[0].createdAt!, data: { nodes: [...nodes], links: [...links] } }];
  }

  const step = (endTime - startTime) / Math.max(frameCount - 1, 1);
  const frames: AnimationFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    const threshold = startTime + step * i;
    const visibleNodes = [
      ...undated,
      ...sorted.filter((n) => new Date(n.createdAt!).getTime() <= threshold),
    ];
    const nodeIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = links.filter((l) => {
      const s = typeof l.source === 'string' ? l.source : (l.source as unknown as GraphNode).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as unknown as GraphNode).id;
      return nodeIds.has(s) && nodeIds.has(t);
    });

    frames.push({
      time: new Date(threshold).toISOString(),
      data: { nodes: visibleNodes, links: visibleLinks },
    });
  }

  return frames;
}

export interface PerformanceOptions {
  maxNodes: number;
  maxLinks: number;
}

const DEFAULT_PERF: PerformanceOptions = {
  maxNodes: 500,
  maxLinks: 1000,
};

export function optimizeForPerformance(
  data: GraphData,
  options: Partial<PerformanceOptions> = {},
): GraphData {
  const { maxNodes, maxLinks } = { ...DEFAULT_PERF, ...options };

  if (data.nodes.length <= maxNodes && data.links.length <= maxLinks) {
    return data;
  }

  // Score nodes by connectivity
  const connectionCount = new Map<string, number>();
  for (const node of data.nodes) {
    connectionCount.set(node.id, 0);
  }
  for (const link of data.links) {
    const s = typeof link.source === 'string' ? link.source : (link.source as unknown as GraphNode).id;
    const t = typeof link.target === 'string' ? link.target : (link.target as unknown as GraphNode).id;
    connectionCount.set(s, (connectionCount.get(s) ?? 0) + 1);
    connectionCount.set(t, (connectionCount.get(t) ?? 0) + 1);
  }

  // Keep most connected nodes
  const sortedNodes = [...data.nodes].sort(
    (a, b) => (connectionCount.get(b.id) ?? 0) - (connectionCount.get(a.id) ?? 0),
  );
  const keptNodes = sortedNodes.slice(0, maxNodes);
  const keptIds = new Set(keptNodes.map((n) => n.id));

  const keptLinks = data.links.filter((l) => {
    const s = typeof l.source === 'string' ? l.source : (l.source as unknown as GraphNode).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as unknown as GraphNode).id;
    return keptIds.has(s) && keptIds.has(t);
  }).slice(0, maxLinks);

  return { nodes: keptNodes, links: keptLinks };
}
