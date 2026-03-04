import { useState, useCallback, useMemo } from 'react';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import type { GraphData, GraphLink, GraphViewOptions } from './graph-types.js';
import { getGroups, getLinkTypes, filterGraph } from './graph-types.js';

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
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [activeLinkTypes, setActiveLinkTypes] = useState<Set<GraphLink['type']>>(new Set());

  const groups = useMemo(() => getGroups(data), [data]);
  const linkTypes = useMemo(() => getLinkTypes(data), [data]);

  const filteredData = useMemo(() => {
    const hasGroupFilter = activeGroups.size > 0;
    const hasLinkFilter = activeLinkTypes.size > 0;
    if (!hasGroupFilter && !hasLinkFilter) return data;
    return filterGraph(data, {
      groups: hasGroupFilter ? activeGroups : undefined,
      linkTypes: hasLinkFilter ? activeLinkTypes : undefined,
    });
  }, [data, activeGroups, activeLinkTypes]);

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

  const toggleGroup = useCallback((group: string) => {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const toggleLinkType = useCallback((type: GraphLink['type']) => {
    setActiveLinkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
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

      {(groups.length > 0 || linkTypes.length > 1) && (
        <div className="cept-graph-filter-bar" data-testid="graph-filter-bar">
          {groups.length > 0 && (
            <div className="cept-graph-filter-section" data-testid="graph-group-filters">
              <span className="cept-graph-filter-label">Groups:</span>
              {groups.map((group) => (
                <button
                  key={group}
                  className={`cept-graph-filter-chip ${activeGroups.has(group) ? 'is-active' : ''}`}
                  onClick={() => toggleGroup(group)}
                  data-testid={`graph-filter-group-${group}`}
                >
                  <span
                    className="cept-graph-filter-dot"
                    style={{ backgroundColor: colorGroups?.[group] ?? '#6366f1' }}
                  />
                  {group}
                </button>
              ))}
            </div>
          )}
          {linkTypes.length > 1 && (
            <div className="cept-graph-filter-section" data-testid="graph-link-filters">
              <span className="cept-graph-filter-label">Links:</span>
              {linkTypes.map((type) => (
                <button
                  key={type}
                  className={`cept-graph-filter-chip ${activeLinkTypes.has(type) ? 'is-active' : ''}`}
                  onClick={() => toggleLinkType(type)}
                  data-testid={`graph-filter-link-${type}`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <KnowledgeGraph
        data={filteredData}
        options={options}
        width={width}
        height={height}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
