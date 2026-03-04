/**
 * MergeEngine — Handles automatic merging and conflict resolution.
 *
 * Provides conflict detection, three-way merge for text files,
 * and strategies for automatic conflict resolution in Cept workspaces.
 */

/** A conflict between two versions of a file */
export interface MergeConflict {
  path: string;
  type: 'content' | 'delete-modify' | 'add-add';
  /** Our version content (null if deleted) */
  ours: string | null;
  /** Their version content (null if deleted) */
  theirs: string | null;
  /** Common ancestor content (null if newly added) */
  base: string | null;
}

/** Resolution strategy for a conflict */
export type ResolutionStrategy =
  | 'ours'
  | 'theirs'
  | 'merge'
  | 'manual';

/** A resolved conflict with the chosen resolution */
export interface ResolvedConflict {
  path: string;
  strategy: ResolutionStrategy;
  resolvedContent: string;
}

/** Result of a merge attempt */
export interface MergeAttemptResult {
  /** Whether all conflicts were resolved automatically */
  fullyResolved: boolean;
  /** Automatically resolved conflicts */
  autoResolved: ResolvedConflict[];
  /** Conflicts that need manual resolution */
  manualConflicts: MergeConflict[];
}

/** Auto-merge strategy configuration */
export interface AutoMergeConfig {
  /** Default strategy for content conflicts. Default: 'merge' */
  defaultStrategy?: ResolutionStrategy;
  /** Strategy for delete-modify conflicts. Default: 'theirs' */
  deleteModifyStrategy?: 'ours' | 'theirs';
  /** Strategy for add-add conflicts. Default: 'merge' */
  addAddStrategy?: ResolutionStrategy;
  /** File patterns that should always use a specific strategy */
  patternStrategies?: Array<{ pattern: string; strategy: ResolutionStrategy }>;
}

/**
 * Parses a Git-style conflict block into ours/theirs content.
 */
export function parseConflictMarkers(content: string): {
  hasConflicts: boolean;
  sections: Array<{ ours: string; theirs: string; base?: string }>;
} {
  const conflictRegex =
    /<<<<<<< .*?\n([\s\S]*?)(?:\|\|\|\|\|\|\| .*?\n([\s\S]*?))?=======\n([\s\S]*?)>>>>>>> .*?\n/g;

  const sections: Array<{ ours: string; theirs: string; base?: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = conflictRegex.exec(content)) !== null) {
    sections.push({
      ours: match[1],
      base: match[2],
      theirs: match[3],
    });
  }

  return {
    hasConflicts: sections.length > 0,
    sections,
  };
}

/**
 * Simple line-based three-way merge.
 * Merges changes from both sides relative to a common ancestor.
 */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string,
): { merged: string; hasConflicts: boolean; conflicts: number } {
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');

  const result: string[] = [];
  let conflictCount = 0;
  const maxLen = Math.max(baseLines.length, ourLines.length, theirLines.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = i < baseLines.length ? baseLines[i] : undefined;
    const ourLine = i < ourLines.length ? ourLines[i] : undefined;
    const theirLine = i < theirLines.length ? theirLines[i] : undefined;

    if (ourLine === theirLine) {
      // Both sides agree
      if (ourLine !== undefined) result.push(ourLine);
    } else if (ourLine === baseLine) {
      // Only theirs changed
      if (theirLine !== undefined) result.push(theirLine);
    } else if (theirLine === baseLine) {
      // Only ours changed
      if (ourLine !== undefined) result.push(ourLine);
    } else {
      // Both sides changed differently — conflict
      conflictCount++;
      result.push('<<<<<<< ours');
      if (ourLine !== undefined) result.push(ourLine);
      result.push('=======');
      if (theirLine !== undefined) result.push(theirLine);
      result.push('>>>>>>> theirs');
    }
  }

  return {
    merged: result.join('\n'),
    hasConflicts: conflictCount > 0,
    conflicts: conflictCount,
  };
}

/**
 * Attempts to automatically resolve a set of conflicts.
 */
export function autoResolve(
  conflicts: MergeConflict[],
  config?: AutoMergeConfig,
): MergeAttemptResult {
  const defaultStrategy = config?.defaultStrategy ?? 'merge';
  const deleteModifyStrategy = config?.deleteModifyStrategy ?? 'theirs';
  const addAddStrategy = config?.addAddStrategy ?? 'merge';

  const autoResolved: ResolvedConflict[] = [];
  const manualConflicts: MergeConflict[] = [];

  for (const conflict of conflicts) {
    // Check pattern-specific strategies
    const patternMatch = config?.patternStrategies?.find((ps) =>
      conflict.path.endsWith(ps.pattern) || conflict.path.includes(ps.pattern),
    );

    if (patternMatch) {
      const resolved = resolveWithStrategy(conflict, patternMatch.strategy);
      if (resolved) {
        autoResolved.push(resolved);
        continue;
      }
    }

    if (conflict.type === 'delete-modify') {
      if (deleteModifyStrategy === 'ours') {
        autoResolved.push({
          path: conflict.path,
          strategy: 'ours',
          resolvedContent: conflict.ours ?? '',
        });
      } else {
        autoResolved.push({
          path: conflict.path,
          strategy: 'theirs',
          resolvedContent: conflict.theirs ?? '',
        });
      }
      continue;
    }

    if (conflict.type === 'add-add') {
      if (addAddStrategy === 'ours') {
        autoResolved.push({
          path: conflict.path,
          strategy: 'ours',
          resolvedContent: conflict.ours ?? '',
        });
      } else if (addAddStrategy === 'theirs') {
        autoResolved.push({
          path: conflict.path,
          strategy: 'theirs',
          resolvedContent: conflict.theirs ?? '',
        });
      } else {
        // For add-add with merge, both contents are concatenated
        autoResolved.push({
          path: conflict.path,
          strategy: 'merge',
          resolvedContent: `${conflict.ours ?? ''}\n${conflict.theirs ?? ''}`,
        });
      }
      continue;
    }

    // Content conflicts
    if (defaultStrategy === 'ours') {
      autoResolved.push({
        path: conflict.path,
        strategy: 'ours',
        resolvedContent: conflict.ours ?? '',
      });
    } else if (defaultStrategy === 'theirs') {
      autoResolved.push({
        path: conflict.path,
        strategy: 'theirs',
        resolvedContent: conflict.theirs ?? '',
      });
    } else if (defaultStrategy === 'merge' && conflict.base !== null) {
      const mergeResult = threeWayMerge(
        conflict.base,
        conflict.ours ?? '',
        conflict.theirs ?? '',
      );
      if (!mergeResult.hasConflicts) {
        autoResolved.push({
          path: conflict.path,
          strategy: 'merge',
          resolvedContent: mergeResult.merged,
        });
      } else {
        manualConflicts.push(conflict);
      }
    } else {
      manualConflicts.push(conflict);
    }
  }

  return {
    fullyResolved: manualConflicts.length === 0,
    autoResolved,
    manualConflicts,
  };
}

function resolveWithStrategy(
  conflict: MergeConflict,
  strategy: ResolutionStrategy,
): ResolvedConflict | null {
  if (strategy === 'ours') {
    return {
      path: conflict.path,
      strategy: 'ours',
      resolvedContent: conflict.ours ?? '',
    };
  }
  if (strategy === 'theirs') {
    return {
      path: conflict.path,
      strategy: 'theirs',
      resolvedContent: conflict.theirs ?? '',
    };
  }
  if (strategy === 'merge' && conflict.base !== null && conflict.ours !== null && conflict.theirs !== null) {
    const result = threeWayMerge(conflict.base, conflict.ours, conflict.theirs);
    if (!result.hasConflicts) {
      return {
        path: conflict.path,
        strategy: 'merge',
        resolvedContent: result.merged,
      };
    }
  }
  // Manual strategy or unresolvable merge
  return null;
}
