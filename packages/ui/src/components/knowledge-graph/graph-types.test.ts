import { describe, it, expect } from 'vitest';
import { buildGraphData, filterByDepth } from './graph-types.js';
import type { GraphData } from './graph-types.js';

const pages = [
  { id: 'a', title: 'Page A', icon: '\u{1F4C4}', links: ['b', 'c'] },
  { id: 'b', title: 'Page B', parent: 'a', links: ['c'] },
  { id: 'c', title: 'Page C', parent: 'a' },
  { id: 'd', title: 'Page D', group: 'work' },
  { id: 'e', title: 'Page E', parent: 'd', links: ['a'] },
];

describe('buildGraphData', () => {
  it('creates nodes for each page', () => {
    const data = buildGraphData(pages);
    expect(data.nodes).toHaveLength(5);
  });

  it('creates parent links', () => {
    const data = buildGraphData(pages);
    const parentLinks = data.links.filter((l) => l.type === 'parent');
    expect(parentLinks).toHaveLength(3); // b->a, c->a, e->d
  });

  it('creates mention links', () => {
    const data = buildGraphData(pages);
    const mentionLinks = data.links.filter((l) => l.type === 'mention');
    // a links to b,c (2 mentions), b links to c (1 mention), e links to a (1 mention) = 4
    expect(mentionLinks).toHaveLength(4);
  });

  it('preserves node properties', () => {
    const data = buildGraphData(pages);
    const nodeA = data.nodes.find((n) => n.id === 'a');
    expect(nodeA?.title).toBe('Page A');
    expect(nodeA?.icon).toBe('\u{1F4C4}');
  });

  it('preserves group property', () => {
    const data = buildGraphData(pages);
    const nodeD = data.nodes.find((n) => n.id === 'd');
    expect(nodeD?.group).toBe('work');
  });

  it('ignores links to non-existent nodes', () => {
    const data = buildGraphData([
      { id: 'x', title: 'X', links: ['nonexistent'] },
    ]);
    expect(data.links).toHaveLength(0);
  });

  it('ignores self-links', () => {
    const data = buildGraphData([
      { id: 'x', title: 'X', links: ['x'] },
    ]);
    expect(data.links).toHaveLength(0);
  });

  it('returns empty graph for empty input', () => {
    const data = buildGraphData([]);
    expect(data.nodes).toHaveLength(0);
    expect(data.links).toHaveLength(0);
  });
});

describe('filterByDepth', () => {
  const graphData: GraphData = {
    nodes: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
      { id: 'd', title: 'D' },
      { id: 'e', title: 'E' },
    ],
    links: [
      { source: 'a', target: 'b', type: 'parent' },
      { source: 'b', target: 'c', type: 'parent' },
      { source: 'c', target: 'd', type: 'mention' },
      { source: 'd', target: 'e', type: 'mention' },
    ],
  };

  it('returns only focus node at depth 0', () => {
    const result = filterByDepth(graphData, 'a', 0);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('a');
    expect(result.links).toHaveLength(0);
  });

  it('includes direct neighbors at depth 1', () => {
    const result = filterByDepth(graphData, 'a', 1);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('includes two hops at depth 2', () => {
    const result = filterByDepth(graphData, 'a', 2);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('includes full chain at sufficient depth', () => {
    const result = filterByDepth(graphData, 'a', 10);
    expect(result.nodes).toHaveLength(5);
  });

  it('includes relevant links only', () => {
    const result = filterByDepth(graphData, 'a', 1);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].source).toBe('a');
    expect(result.links[0].target).toBe('b');
  });

  it('returns empty for negative depth', () => {
    const result = filterByDepth(graphData, 'a', -1);
    expect(result.nodes).toHaveLength(0);
  });

  it('works when focus node is in middle of chain', () => {
    const result = filterByDepth(graphData, 'c', 1);
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['b', 'c', 'd']);
  });
});
