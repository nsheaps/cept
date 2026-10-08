/**
 * ConflictResolver — the per-file conflict view of a GitHub space's sync
 * (REQ-WS-026). For each file both sides changed in the same place it offers
 * Keep mine, Keep theirs or Edit merged (starting from the merge with conflict
 * markers); for a file deleted on one side and changed on the other, Keep the
 * file or Delete it. Keeping one version keeps the other as a conflict copy
 * beside it. Nothing is applied while a merged edit still holds conflict
 * markers, and binary files cannot be edited here.
 */

import { useState, useMemo, useCallback } from 'react';
import { hasConflictMarkers } from '@cept/core';
import type { ConflictResolution, MergeConflict } from '@cept/core';

export interface ConflictResolverProps {
  conflicts: MergeConflict[];
  /** Every conflict has a valid resolution; merge with these and sync. */
  onResolve?: (resolutions: ConflictResolution[]) => void;
  onCancel?: () => void;
  /** Push the unmerged work to a new branch instead of resolving here. */
  onPushToNewBranch?: () => void;
  /** A resolution or push is running. */
  busy?: boolean;
}

type Choice = ConflictResolution['choice'];

interface Draft {
  choice: Choice;
  content?: string;
}

/** Why a merged edit cannot be applied yet, or null when it can. */
function mergedProblem(draft: Draft, conflict: MergeConflict): 'markers' | 'empty' | null {
  const content = draft.content ?? '';
  if (hasConflictMarkers(content)) return 'markers';
  // An emptied file is only a real merge when both sides were empty too.
  if (content.trim() === '' && ((conflict.ours ?? '') !== '' || (conflict.theirs ?? '') !== '')) {
    return 'empty';
  }
  return null;
}

/** Whether `draft` can be applied: a merged edit must be free of markers and not emptied. */
function isValid(draft: Draft | undefined, conflict: MergeConflict): boolean {
  if (!draft) return false;
  return draft.choice !== 'merged' || mergedProblem(draft, conflict) === null;
}

/** The choices offered for a conflict, as [choice, label] pairs. */
function choicesFor(conflict: MergeConflict): [Choice, string][] {
  if (conflict.type === 'delete-modify') {
    // The side that still has the file keeps it; the other side deletes it.
    const keep: Choice = conflict.ours === null ? 'theirs' : 'mine';
    const remove: Choice = keep === 'mine' ? 'theirs' : 'mine';
    return [
      [keep, 'Keep the file'],
      [remove, 'Delete it'],
    ];
  }
  const choices: [Choice, string][] = [
    ['mine', 'Keep mine'],
    ['theirs', 'Keep theirs'],
  ];
  if (!conflict.binary) choices.push(['merged', 'Edit merged']);
  return choices;
}

const TYPE_LABELS: Record<MergeConflict['type'], string> = {
  content: 'Changed here and on GitHub',
  'add-add': 'Added here and on GitHub',
  'delete-modify': 'Deleted on one side, changed on the other',
};

function sideText(text: string | null, binary: boolean | undefined): string {
  if (text === null) return '(deleted)';
  return binary ? '(binary file)' : text;
}

export function ConflictResolver({
  conflicts,
  onResolve,
  onCancel,
  onPushToNewBranch,
  busy = false,
}: ConflictResolverProps) {
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [activeConflict, setActiveConflict] = useState<number>(0);

  const current = conflicts[Math.min(activeConflict, conflicts.length - 1)];
  const resolvedCount = useMemo(
    () => conflicts.filter((c) => isValid(drafts.get(c.path), c)).length,
    [conflicts, drafts],
  );
  const allResolved = conflicts.length > 0 && resolvedCount === conflicts.length;

  const setDraft = useCallback((path: string, draft: Draft) => {
    setDrafts((prev) => new Map(prev).set(path, draft));
  }, []);

  const handleChoose = useCallback(
    (choice: Choice) => {
      if (!current) return;
      if (choice === 'merged') {
        const previous = drafts.get(current.path);
        const content =
          previous?.choice === 'merged'
            ? previous.content
            : (current.merged ?? current.ours ?? current.theirs ?? '');
        setDraft(current.path, { choice, content });
        return;
      }
      setDraft(current.path, { choice });
      // Move on to the next conflict once this one is decided.
      if (activeConflict < conflicts.length - 1) setActiveConflict(activeConflict + 1);
    },
    [current, drafts, setDraft, activeConflict, conflicts.length],
  );

  const handleApply = useCallback(() => {
    if (!onResolve || !allResolved) return;
    onResolve(
      conflicts.map((c) => {
        const draft = drafts.get(c.path)!;
        return draft.choice === 'merged'
          ? { path: c.path, choice: 'merged', content: draft.content ?? '' }
          : { path: c.path, choice: draft.choice };
      }),
    );
  }, [onResolve, allResolved, conflicts, drafts]);

  if (conflicts.length === 0 || !current) {
    return (
      <div className="cept-conflict-resolver" data-testid="conflict-resolver">
        <div className="cept-conflict-empty" data-testid="conflict-empty">
          No conflicts to resolve.
        </div>
      </div>
    );
  }

  const draft = drafts.get(current.path);
  const problem = draft?.choice === 'merged' ? mergedProblem(draft, current) : null;

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

      <div className="cept-conflict-detail" data-testid="conflict-detail">
        <div className="cept-conflict-path" data-testid="conflict-path">
          {current.path}
        </div>
        <div className="cept-conflict-type" data-testid="conflict-type">
          {TYPE_LABELS[current.type]}
        </div>

        <div className="cept-conflict-diff">
          <div className="cept-conflict-side" data-testid="conflict-ours">
            <div className="cept-conflict-side-label">Mine (this device)</div>
            <pre className="cept-conflict-content">{sideText(current.ours, current.binary)}</pre>
          </div>
          <div className="cept-conflict-side" data-testid="conflict-theirs">
            <div className="cept-conflict-side-label">Theirs (GitHub)</div>
            <pre className="cept-conflict-content">{sideText(current.theirs, current.binary)}</pre>
          </div>
        </div>

        <div className="cept-conflict-actions" data-testid="conflict-actions">
          {choicesFor(current).map(([choice, label]) => (
            <button
              key={choice}
              className={`cept-conflict-btn${draft?.choice === choice ? ' is-selected' : ''}`}
              onClick={() => handleChoose(choice)}
              disabled={busy}
              aria-pressed={draft?.choice === choice}
              data-testid={`conflict-choose-${choice}`}
            >
              {label}
            </button>
          ))}
        </div>

        {draft?.choice === 'merged' && (
          <>
            <textarea
              className="cept-conflict-editor"
              aria-label={`Merged ${current.path}`}
              value={draft.content ?? ''}
              onChange={(e) =>
                setDraft(current.path, { choice: 'merged', content: e.target.value })
              }
              data-testid="conflict-merged-editor"
            />
            {problem === 'markers' && (
              <div className="cept-conflict-warning" role="alert" data-testid="conflict-markers">
                Remove the conflict markers (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======,
                &gt;&gt;&gt;&gt;&gt;&gt;&gt;) before applying.
              </div>
            )}
            {problem === 'empty' && (
              <div
                className="cept-conflict-warning"
                role="alert"
                data-testid="conflict-empty-merge"
              >
                The merged file is empty. To remove the file, keep a version or delete it instead.
              </div>
            )}
          </>
        )}

        {draft && draft.choice !== 'merged' && current.type !== 'delete-modify' && (
          <div className="cept-conflict-resolution-status" data-testid="conflict-resolution-status">
            The other version is kept as a copy beside the file.
          </div>
        )}
      </div>

      <div className="cept-conflict-footer" data-testid="conflict-footer">
        {onCancel && (
          <button className="cept-conflict-cancel" onClick={onCancel} data-testid="conflict-cancel">
            Later
          </button>
        )}
        {onPushToNewBranch && (
          <button
            className="cept-conflict-cancel"
            onClick={onPushToNewBranch}
            disabled={busy}
            data-testid="conflict-push-new-branch"
          >
            Push mine to a new branch
          </button>
        )}
        <button
          className="cept-conflict-apply"
          disabled={!allResolved || busy}
          onClick={handleApply}
          data-testid="conflict-apply"
        >
          Apply and sync
        </button>
      </div>
    </div>
  );
}
