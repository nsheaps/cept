import { describe, it, expect } from 'vitest';
import { buildAnimationFrames, optimizeForPerformance } from './graph-animation.js';
import type { TimestampedNode } from './graph-animation.js';
import type { GraphData, GraphLink } from './graph-types.js';

describe('buildAnimationFrames', () => {
  const nodes: TimestampedNode[] = [
    { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'c', title: 'C', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'd', title: 'D', createdAt: '2026-01-04T00:00:00Z' },
  ];

  const links: GraphLink[] = [
    { source: 'a', target: 'b', type: 'parent' },
    { source: 'b', target: 'c', type: 'mention' },
    { source: 'c', target: 'd', type: 'mention' },
  ];

  it('creates the specified number of frames', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    expect(frames).toHaveLength(4);
  });

  it('first frame has earliest nodes', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    const firstNodeIds = frames[0].data.nodes.map((n) => n.id);
    expect(firstNodeIds).toContain('a');
  });

  it('last frame has all nodes', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    expect(frames[frames.length - 1].data.nodes).toHaveLength(4);
  });

  it('frames are in chronological order', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    for (let i = 1; i < frames.length; i++) {
      expect(new Date(frames[i].time).getTime()).toBeGreaterThanOrEqual(
        new Date(frames[i - 1].time).getTime(),
      );
    }
  });

  it('node count increases or stays same across frames', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].data.nodes.length).toBeGreaterThanOrEqual(
        frames[i - 1].data.nodes.length,
      );
    }
  });

  it('only includes links for visible nodes', () => {
    const frames = buildAnimationFrames(nodes, links, 4);
    const firstFrame = frames[0];
    const nodeIds = new Set(firstFrame.data.nodes.map((n) => n.id));
    for (const link of firstFrame.data.links) {
      expect(nodeIds.has(link.source as string)).toBe(true);
      expect(nodeIds.has(link.target as string)).toBe(true);
    }
  });

  it('returns empty for nodes without timestamps', () => {
    const undated = [{ id: 'x', title: 'X' }];
    const frames = buildAnimationFrames(undated, [], 5);
    expect(frames).toHaveLength(0);
  });

  it('handles single timestamp by returning one frame', () => {
    const single = [{ id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' }];
    const frames = buildAnimationFrames(single, [], 5);
    expect(frames).toHaveLength(1);
  });

  it('includes undated nodes in all frames', () => {
    const mixed: TimestampedNode[] = [
      { id: 'x', title: 'X' },
      { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z' },
    ];
    const frames = buildAnimationFrames(mixed, [], 2);
    for (const frame of frames) {
      const ids = frame.data.nodes.map((n) => n.id);
      expect(ids).toContain('x');
    }
  });
});

describe('optimizeForPerformance', () => {
  it('returns data unchanged when under limits', () => {
    const data: GraphData = {
      nodes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }],
      links: [{ source: 'a', target: 'b', type: 'parent' }],
    };
    const result = optimizeForPerformance(data, { maxNodes: 100 });
    expect(result).toBe(data);
  });

  it('limits number of nodes', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({
      id: `n${i}`,
      title: `Node ${i}`,
    }));
    const links: GraphLink[] = [
      { source: 'n0', target: 'n1', type: 'parent' as const },
      { source: 'n0', target: 'n2', type: 'parent' as const },
      { source: 'n0', target: 'n3', type: 'parent' as const },
    ];
    const data: GraphData = { nodes, links };
    const result = optimizeForPerformance(data, { maxNodes: 5, maxLinks: 100 });
    expect(result.nodes).toHaveLength(5);
  });

  it('keeps most connected nodes', () => {
    const nodes = [
      { id: 'hub', title: 'Hub' },
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
      { id: 'lone', title: 'Lone' },
    ];
    const links: GraphLink[] = [
      { source: 'hub', target: 'a', type: 'parent' },
      { source: 'hub', target: 'b', type: 'parent' },
      { source: 'hub', target: 'c', type: 'parent' },
    ];
    const data: GraphData = { nodes, links };
    const result = optimizeForPerformance(data, { maxNodes: 3, maxLinks: 100 });
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain('hub');
    // 'lone' has 0 connections, should be dropped first
    expect(ids).not.toContain('lone');
  });

  it('limits number of links', () => {
    const nodes = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ];
    const links: GraphLink[] = Array.from({ length: 5 }, (_, i) => ({
      source: 'a',
      target: 'b',
      type: 'mention' as const,
    }));
    const data: GraphData = { nodes, links };
    const result = optimizeForPerformance(data, { maxNodes: 100, maxLinks: 2 });
    expect(result.links).toHaveLength(2);
  });

  it('removes links to pruned nodes', () => {
    const nodes = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ];
    const links: GraphLink[] = [
      { source: 'a', target: 'b', type: 'parent' },
      { source: 'b', target: 'c', type: 'mention' },
    ];
    const data: GraphData = { nodes, links };
    const result = optimizeForPerformance(data, { maxNodes: 2, maxLinks: 100 });
    for (const link of result.links) {
      const nodeIds = new Set(result.nodes.map((n) => n.id));
      expect(nodeIds.has(link.source as string)).toBe(true);
      expect(nodeIds.has(link.target as string)).toBe(true);
    }
  });
});
