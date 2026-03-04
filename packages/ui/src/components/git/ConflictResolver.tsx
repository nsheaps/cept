import { useState, useMemo, useCallback } from 'react';
import type { MergeConflict, ResolutionStrategy, ResolvedConflict } from '@cept/core';

export interface ConflictResolverProps {
  conflicts: MergeConflict[];
  onResolve?: (resolutions: ResolvedConflict[]) => void;
  onCancel?: () => void;
}

interface ConflictResolution {
  strategy: ResolutionStrategy;
  content: string;
}

export function ConflictResolver({
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolverProps) {
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
  const [activeConflict, setActiveConflict] = useState<number>(0);

  const current = conflicts[activeConflict];

  const allResolved = useMemo(
    () => conflicts.every((c) => resolutions.has(c.path)),
    [conflicts, resolutions],
  );

  const resolvedCount = useMemo(
    () => conflicts.filter((c) => resolutions.has(c.path)).length,
    [conflicts, resolutions],
  );

  const handleChoose = useCallback(
    (strategy: ResolutionStrategy) => {
      if (!current) return;
      let content = '';
      if (strategy === 'ours') {
        content = current.ours ?? '';
      } else if (strategy === 'theirs') {
        content = current.theirs ?? '';
      } else if (strategy === 'merge') {
        content = `${current.ours ?? ''}\n${current.theirs ?? ''}`;
      }

      setResolutions((prev) => {
        const next = new Map(prev);
        next.set(current.path, { strategy, content });
        return next;
      });

      // Auto-advance to next unresolved conflict
      if (activeConflict < conflicts.length - 1) {
        setActiveConflict(activeConflict + 1);
      }
    },
    [current, activeConflict, conflicts.length],
  );

  const handleManualEdit = useCallback(
    (content: string) => {
      if (!current) return;
      setResolutions((prev) => {
        const next = new Map(prev);
        next.set(current.path, { strategy: 'manual', content });
        return next;
      });
    },
    [current],
  );

  const handleApply = useCallback(() => {
    if (!onResolve || !allResolved) return;
    const result: ResolvedConflict[] = conflicts.map((c) => {
      const res = resolutions.get(c.path)!;
      return {
        path: c.path,
        strategy: res.strategy,
        resolvedContent: res.content,
      };
    });
    onResolve(result);
  }, [onResolve, allResolved, conflicts, resolutions]);

  if (conflicts.length === 0) {
    return (
      <div className="cept-conflict-resolver" data-testid="conflict-resolver">
        <div className="cept-conflict-empty" data-testid="conflict-empty">
          No conflicts to resolve.
        </div>
      </div>
    );
  }

  const currentResolution = current ? resolutions.get(current.path) : undefined;

  return (
    <div className="cept-conflict-resolver" data-testid="conflict-resolver">
      <div className="cept-conflict-header" data-testid="conflict-header">
        <span className="cept-conflict-count" data-testid="conflict-count">
          {resolvedCount}/{conflicts.length} resolved
        </span>
        <div className="cept-conflict-nav">
          <button
            className="cept-conflict-nav-btn"
            disabled={activeConflict === 0}
            onClick={() => setActiveConflict(activeConflict - 1)}
            data-testid="conflict-prev"
          >
            Previous
          </button>
          <span data-testid="conflict-index">
            {activeConflict + 1} of {conflicts.length}
          </span>
          <button
            className="cept-conflict-nav-btn"
            disabled={activeConflict === conflicts.length - 1}
            onClick={() => setActiveConflict(activeConflict + 1)}
            data-testid="conflict-next"
          >
            Next
          </button>
        </div>
      </div>

      {current && (
        <div className="cept-conflict-detail" data-testid="conflict-detail">
          <div className="cept-conflict-path" data-testid="conflict-path">
            {current.path}
          </div>
          <div className="cept-conflict-type" data-testid="conflict-type">
            {current.type}
          </div>

          <div className="cept-conflict-diff">
            <div className="cept-conflict-side" data-testid="conflict-ours">
              <div className="cept-conflict-side-label">Ours</div>
              <pre className="cept-conflict-content">{current.ours ?? '(deleted)'}</pre>
            </div>
            <div className="cept-conflict-side" data-testid="conflict-theirs">
              <div className="cept-conflict-side-label">Theirs</div>
              <pre className="cept-conflict-content">{current.theirs ?? '(deleted)'}</pre>
            </div>
          </div>

          <div className="cept-conflict-actions" data-testid="conflict-actions">
            <button
              className={`cept-conflict-btn${currentResolution?.strategy === 'ours' ? ' is-selected' : ''}`}
              onClick={() => handleChoose('ours')}
              data-testid="conflict-choose-ours"
            >
              Accept Ours
            </button>
            <button
              className={`cept-conflict-btn${currentResolution?.strategy === 'theirs' ? ' is-selected' : ''}`}
              onClick={() => handleChoose('theirs')}
              data-testid="conflict-choose-theirs"
            >
              Accept Theirs
            </button>
            <button
              className={`cept-conflict-btn${currentResolution?.strategy === 'merge' ? ' is-selected' : ''}`}
              onClick={() => handleChoose('merge')}
              data-testid="conflict-choose-merge"
            >
              Merge Both
            </button>
          </div>

          {currentResolution?.strategy === 'manual' && (
            <textarea
              className="cept-conflict-editor"
              value={currentResolution.content}
              onChange={(e) => handleManualEdit(e.target.value)}
              data-testid="conflict-manual-editor"
            />
          )}

          {currentResolution && (
            <div className="cept-conflict-resolution-status" data-testid="conflict-resolution-status">
              Resolved: {currentResolution.strategy}
            </div>
          )}
        </div>
      )}

      <div className="cept-conflict-footer" data-testid="conflict-footer">
        {onCancel && (
          <button
            className="cept-conflict-cancel"
            onClick={onCancel}
            data-testid="conflict-cancel"
          >
            Cancel
          </button>
        )}
        <button
          className="cept-conflict-apply"
          disabled={!allResolved}
          onClick={handleApply}
          data-testid="conflict-apply"
        >
          Apply Resolutions
        </button>
      </div>
    </div>
  );
}
