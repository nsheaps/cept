import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphLink, GraphViewOptions } from './graph-types.js';
import { filterByDepth } from './graph-types.js';

export interface KnowledgeGraphProps {
  data: GraphData;
  options?: Partial<GraphViewOptions>;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

const DEFAULT_COLORS: Record<string, string> = {
  default: '#6366f1',
};

export function KnowledgeGraph({
  data,
  options = {},
  width = 800,
  height = 600,
  onNodeClick,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const mode = options.mode ?? 'global';
  const showLabels = options.showLabels ?? true;
  const colorGroups = options.colorGroups ?? DEFAULT_COLORS;

  const getDisplayData = useCallback(() => {
    if (mode === 'local' && options.focusNodeId) {
      return filterByDepth(data, options.focusNodeId, options.depth ?? 2);
    }
    return data;
  }, [data, mode, options.focusNodeId, options.depth]);

  useEffect(() => {
    if (!svgRef.current) return;

    const displayData = getDisplayData();
    if (displayData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    const simulation = d3.forceSimulation(displayData.nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(displayData.links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d) => (d as GraphNode).id)
        .distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    // Links
    const link = g.append('g')
      .attr('class', 'cept-graph-links')
      .selectAll('line')
      .data(displayData.links)
      .join('line')
      .attr('class', 'cept-graph-link')
      .attr('stroke', (d: GraphLink) => d.type === 'parent' ? '#d1d5db' : '#93c5fd')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d: GraphLink) => d.type === 'mention' ? '4,4' : 'none');

    // Nodes
    const node = g.append('g')
      .attr('class', 'cept-graph-nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(displayData.nodes)
      .join('g')
      .attr('class', 'cept-graph-node')
      .attr('cursor', 'pointer')
      .on('click', (_event: MouseEvent, d: GraphNode) => {
        onNodeClick?.(d.id);
      });

    node.append('circle')
      .attr('r', (d: GraphNode) =>
        options.focusNodeId === d.id ? 10 : 7,
      )
      .attr('fill', (d: GraphNode) => {
        if (d.group && colorGroups[d.group]) return colorGroups[d.group];
        return colorGroups['default'] ?? '#6366f1';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    if (showLabels) {
      node.append('text')
        .attr('dx', 12)
        .attr('dy', 4)
        .attr('font-size', '11px')
        .attr('fill', '#374151')
        .text((d: GraphNode) => d.title);
    }

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => ((d.source as unknown as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as unknown as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as unknown as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as unknown as GraphNode).y ?? 0));

      node.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [data, getDisplayData, width, height, showLabels, colorGroups, options.focusNodeId, onNodeClick]);

  return (
    <div className="cept-knowledge-graph" data-testid="knowledge-graph">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        data-testid="knowledge-graph-svg"
      />
    </div>
  );
}
