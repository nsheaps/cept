import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KnowledgeGraph } from './KnowledgeGraph.js';
import type { GraphLink, GraphViewOptions } from './graph-types.js';
import { buildAnimationFrames, optimizeForPerformance } from './graph-animation.js';
import type { TimestampedNode, PerformanceOptions } from './graph-animation.js';

export interface GraphAnimationPlayerProps {
  nodes: TimestampedNode[];
  links: GraphLink[];
  frameCount?: number;
  intervalMs?: number;
  performanceOptions?: Partial<PerformanceOptions>;
  graphOptions?: Partial<GraphViewOptions>;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
}

export function GraphAnimationPlayer({
  nodes,
  links,
  frameCount = 20,
  intervalMs = 500,
  performanceOptions,
  graphOptions = {},
  width = 800,
  height = 600,
  onNodeClick,
}: GraphAnimationPlayerProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const frames = useMemo(
    () => buildAnimationFrames(nodes, links, frameCount),
    [nodes, links, frameCount],
  );

  const displayData = useMemo(() => {
    if (frames.length === 0) return { nodes: [], links: [] };
    const frameData = frames[Math.min(currentFrame, frames.length - 1)].data;
    return performanceOptions
      ? optimizeForPerformance(frameData, performanceOptions)
      : frameData;
  }, [frames, currentFrame, performanceOptions]);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrame(0);
  }, []);

  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          if (prev >= frames.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, frames.length, intervalMs]);

  if (frames.length === 0) {
    return (
      <div className="cept-graph-animation" data-testid="graph-animation-player">
        <div className="cept-graph-animation-empty" data-testid="graph-animation-empty">
          No timestamped data available for animation
        </div>
      </div>
    );
  }

  const currentTime = frames[Math.min(currentFrame, frames.length - 1)]?.time ?? '';
  const formattedTime = currentTime ? new Date(currentTime).toLocaleDateString() : '';

  return (
    <div className="cept-graph-animation" data-testid="graph-animation-player">
      <div className="cept-graph-animation-controls" data-testid="graph-animation-controls">
        <button
          className="cept-graph-mode-btn"
          onClick={isPlaying ? pause : play}
          data-testid="graph-animation-play"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          className="cept-graph-mode-btn"
          onClick={reset}
          data-testid="graph-animation-reset"
        >
          Reset
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentFrame}
          onChange={(e) => {
            setCurrentFrame(Number(e.target.value));
            setIsPlaying(false);
          }}
          data-testid="graph-animation-scrubber"
        />
        <span className="cept-graph-animation-time" data-testid="graph-animation-time">
          {formattedTime}
        </span>
        <span className="cept-graph-animation-counter" data-testid="graph-animation-counter">
          {displayData.nodes.length} nodes
        </span>
      </div>
      <KnowledgeGraph
        data={displayData}
        options={graphOptions}
        width={width}
        height={height}
        onNodeClick={onNodeClick}
      />
    </div>
  );
}
