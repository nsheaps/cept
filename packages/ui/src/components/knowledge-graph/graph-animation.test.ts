import { describe, it, expect } from 'vitest';
import { buildAnimationFrames, optimizeForPerformance } from './graph-animation.js';
import type { TimestampedNode } from './graph-animation.js';
import type { GraphLink, GraphData } from './graph-types.js';

const nodes: TimestampedNode[] = [
  { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z' },
  { id: 'c', title: 'C', createdAt: '2026-01-03T00:00:00Z' },
];

const links: GraphLink[] = [
  { source: 'a', target: 'b', type: 'parent' },
  { source: 'b', target: 'c', type: 'mention' },
];

describe('buildAnimationFrames', () => {
  it('returns empty array when no nodes have timestamps', () => {
    const undated = [{ id: 'x', title: 'X' }];
    expect(buildAnimationFrames(undated, [], 5)).toEqual([]);
  });

  it('returns requested number of frames', () => {
    const frames = buildAnimationFrames(nodes, links, 5);
    expect(frames).toHaveLength(5);
  });

  it('first frame contains earliest node', () => {
    const frames = buildAnimationFrames(nodes, links, 3);
    expect(frames[0].data.nodes.some((n) => n.id === 'a')).toBe(true);
  });

  it('last frame contains all nodes', () => {
    const frames = buildAnimationFrames(nodes, links, 3);
    const last = frames[frames.length - 1];
    expect(last.data.nodes.length).toBe(nodes.length);
  });

  it('frames are chronologically ordered', () => {
    const frames = buildAnimationFrames(nodes, links, 5);
    for (let i = 1; i < frames.length; i++) {
      expect(new Date(frames[i].time).getTime()).toBeGreaterThanOrEqual(
        new Date(frames[i - 1].time).getTime(),
      );
    }
  });

  it('links only appear when both endpoints visible', () => {
    const frames = buildAnimationFrames(nodes, links, 3);
    for (const frame of frames) {
      const nodeIds = new Set(frame.data.nodes.map((n) => n.id));
      for (const link of frame.data.links) {
        const s = typeof link.source === 'string' ? link.source : link.source;
        const t = typeof link.target === 'string' ? link.target : link.target;
        expect(nodeIds.has(s as string)).toBe(true);
        expect(nodeIds.has(t as string)).toBe(true);
      }
    }
  });

  it('includes undated nodes in all frames', () => {
    const withUndated: TimestampedNode[] = [
      ...nodes,
      { id: 'u', title: 'Undated' },
    ];
    const frames = buildAnimationFrames(withUndated, links, 3);
    for (const frame of frames) {
      expect(frame.data.nodes.some((n) => n.id === 'u')).toBe(true);
    }
  });

  it('returns single frame when all nodes have same timestamp', () => {
    const sameTime: TimestampedNode[] = [
      { id: 'x', title: 'X', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'y', title: 'Y', createdAt: '2026-01-01T00:00:00Z' },
    ];
    const frames = buildAnimationFrames(sameTime, [], 5);
    expect(frames).toHaveLength(1);
  });
});

describe('optimizeForPerformance', () => {
  it('returns data unchanged when under limits', () => {
    const data: GraphData = { nodes: [{ id: 'a', title: 'A' }], links: [] };
    const result = optimizeForPerformance(data);
    expect(result).toBe(data);
  });

  it('trims nodes to maxNodes', () => {
    const manyNodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, title: `N${i}` }));
    const data: GraphData = { nodes: manyNodes, links: [] };
    const result = optimizeForPerformance(data, { maxNodes: 3 });
    expect(result.nodes).toHaveLength(3);
  });

  it('keeps most connected nodes', () => {
    const data: GraphData = {
      nodes: [
        { id: 'hub', title: 'Hub' },
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
        { id: 'c', title: 'C' },
      ],
      links: [
        { source: 'hub', target: 'a', type: 'parent' },
        { source: 'hub', target: 'b', type: 'parent' },
        { source: 'hub', target: 'c', type: 'parent' },
      ],
    };
    const result = optimizeForPerformance(data, { maxNodes: 2 });
    expect(result.nodes.some((n) => n.id === 'hub')).toBe(true);
  });

  it('trims links to maxLinks', () => {
    const data: GraphData = {
      nodes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      links: Array.from({ length: 5 }, () => ({ source: 'a', target: 'b', type: 'parent' })),
    };
    const result = optimizeForPerformance(data, { maxLinks: 2 });
    expect(result.links.length).toBeLessThanOrEqual(2);
  });

  it('removes links referencing trimmed nodes', () => {
    const data: GraphData = {
      nodes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, title: `N${i}` })),
      links: [{ source: 'n0', target: 'n4', type: 'parent' }],
    };
    const result = optimizeForPerformance(data, { maxNodes: 2 });
    const keptIds = new Set(result.nodes.map((n) => n.id));
    for (const link of result.links) {
      expect(keptIds.has(link.source as string)).toBe(true);
      expect(keptIds.has(link.target as string)).toBe(true);
    }
  });
});
