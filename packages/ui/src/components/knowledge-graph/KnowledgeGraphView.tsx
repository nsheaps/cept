import { useState, useCallback, useMemo } from 'react';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import type { GraphData, GraphViewOptions } from './graph-types.js';

export interface KnowledgeGraphViewProps {
  data: GraphData;
  initialMode?: 'global' | 'local';
  initialFocusNodeId?: string;
  initialDepth?: number;
  maxDepth?: number;
  colorGroups?: Record<string, string>;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export function KnowledgeGraphView({
  data,
  initialMode = 'global',
  initialFocusNodeId,
  initialDepth = 2,
  maxDepth = 5,
  colorGroups,
  width = 800,
  height = 600,
  onNodeClick,
}: KnowledgeGraphViewProps) {
  const [mode, setMode] = useState<'global' | 'local'>(initialMode);
  const [focusNodeId, setFocusNodeId] = useState<string | undefined>(initialFocusNodeId);
  const [depth, setDepth] = useState(initialDepth);
  const [showLabels, setShowLabels] = useState(true);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (mode === 'global') {
      setFocusNodeId(nodeId);
      setMode('local');
    }
    onNodeClick?.(nodeId);
  }, [mode, onNodeClick]);

  const handleModeToggle = useCallback(() => {
    setMode((prev) => (prev === 'global' ? 'local' : 'global'));
  }, []);

  const options: Partial<GraphViewOptions> = useMemo(() => ({
    mode,
    focusNodeId,
    depth,
    colorGroups,
    showLabels,
  }), [mode, focusNodeId, depth, colorGroups, showLabels]);

  const focusNodeTitle = useMemo(() => {
    if (!focusNodeId) return undefined;
    return data.nodes.find((n) => n.id === focusNodeId)?.title;
  }, [data.nodes, focusNodeId]);

  return (
    <div className="cept-knowledge-graph-view" data-testid="knowledge-graph-view">
      <div className="cept-graph-toolbar" data-testid="graph-toolbar">
        <button
          className={`cept-graph-mode-btn ${mode === 'global' ? 'is-active' : ''}`}
          onClick={() => setMode('global')}
          data-testid="graph-mode-global"
        >
          Global
        </button>
        <button
          className={`cept-graph-mode-btn ${mode === 'local' ? 'is-active' : ''}`}
          onClick={() => setMode('local')}
          data-testid="graph-mode-local"
          disabled={!focusNodeId}
        >
          Local
        </button>

        <label className="cept-graph-toggle-label">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            data-testid="graph-labels-toggle"
          />
          Labels
        </label>

        {mode === 'local' && focusNodeId && (
          <>
            <div className="cept-graph-separator" />
            <span className="cept-graph-focus-label" data-testid="graph-focus-label">
              Focus: {focusNodeTitle ?? focusNodeId}
            </span>
            <div className="cept-graph-depth-control" data-testid="graph-depth-control">
              <label htmlFor="graph-depth-slider">Depth:</label>
              <input
                id="graph-depth-slider"
                type="range"
                min={0}
                max={maxDepth}
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                data-testid="graph-depth-slider"
              />
              <span data-testid="graph-depth-value">{depth}</span>
            </div>
            <button
              className="cept-graph-mode-btn"
              onClick={handleModeToggle}
              data-testid="graph-back-to-global"
            >
              Back to global
            </button>
          </>
        )}
      </div>

      <KnowledgeGraph
        data={data}
        options={options}
        width={width}
        height={height}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
