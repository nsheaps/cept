/**
 * Three-way merge of two commits' files (REQ-WS-026), as a plan the git
 * backend then writes as a merge commit.
 *
 * Files changed on one side only take that side. Files changed on both merge
 * as text (`mergeText`: front matter key by key, the rest line by line). What
 * is left — overlapping edits, a file deleted on one side and changed on the
 * other, binary files — is a conflict, until the user picks a resolution.
 * Picking mine or theirs keeps the other version as a conflict copy next to
 * the file; conflict markers are never written into a file.
 *
 * This module works on flattened trees and a blob reader, so it knows nothing
 * of isomorphic-git (architecture rule 5).
 */

import type { MergeConflict } from './merge-engine.js';
import { hasConflictMarkers, mergeText } from './text-merge.js';

/** A file in a commit: its blob and mode. */
export interface TreeFile {
  oid: string;
  mode: string;
}

/** A commit's files by path (from the repository root). */
export type FlatTree = ReadonlyMap<string, TreeFile>;

/** A file of the merge result: an existing blob, or new content. */
export type MergedFile = TreeFile | { mode: string; content: Uint8Array };

/**
 * How the user resolved a conflict. For a file deleted on one side, the
 * deleting side's choice deletes it. `merged` takes `content`.
 */
export interface ConflictResolution {
  path: string;
  choice: 'mine' | 'theirs' | 'merged';
  content?: string;
}

export interface MergePlanInput {
  base: FlatTree;
  mine: FlatTree;
  theirs: FlatTree;
  /** Read a blob's bytes. */
  read: (oid: string) => Promise<Uint8Array>;
  /** Resolutions for conflicts the user has resolved. */
  resolutions?: readonly ConflictResolution[];
  /** Short commit ids of each side, to name conflict copies. */
  labels: { mine: string; theirs: string };
}

export interface MergePlan {
  /** The merged commit's files; complete only when `conflicts` is empty. */
  files: Map<string, MergedFile>;
  /** Conflicts still to resolve. */
  conflicts: MergeConflict[];
  /** Conflict copies written by the resolutions, by the path of the file they belong to. */
  copies: Map<string, string>;
}

const REGULAR_FILE = '100644';

function sameFile(a: TreeFile | undefined, b: TreeFile | undefined): boolean {
  return a === b || (a !== undefined && b !== undefined && a.oid === b.oid && a.mode === b.mode);
}

/** A blob as text, or null when it is not UTF-8 text. */
function asText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** `dir/Name (their version abc1234).md` beside `dir/Name.md`, not clashing with `taken`. */
export function conflictCopyPath(
  path: string,
  label: string,
  taken: (p: string) => boolean,
): string {
  const slash = path.lastIndexOf('/');
  const dir = path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 1; ; n++) {
    const candidate = `${dir}${stem} (${label}${n > 1 ? ` ${n}` : ''})${ext}`;
    if (!taken(candidate)) return candidate;
  }
}

/** Plan the merge of `mine` and `theirs` against `base`. */
export async function planMerge(input: MergePlanInput): Promise<MergePlan> {
  const { base, mine, theirs } = input;
  const files = new Map<string, MergedFile>();
  const conflicts: MergeConflict[] = [];
  const copies = new Map<string, string>();
  const resolutions = new Map((input.resolutions ?? []).map((r) => [r.path, r]));
  const paths = [...new Set([...mine.keys(), ...theirs.keys(), ...base.keys()])].sort();
  const taken = (p: string) => mine.has(p) || theirs.has(p) || files.has(p);
  const text = async (file: TreeFile | undefined) =>
    file ? asText(await input.read(file.oid)) : null;

  const keepCopy = (path: string, file: TreeFile, label: string) => {
    const copy = conflictCopyPath(path, label, taken);
    files.set(copy, file);
    copies.set(path, copy);
  };

  for (const path of paths) {
    const b = base.get(path);
    const m = mine.get(path);
    const t = theirs.get(path);
    if (sameFile(m, t) || sameFile(t, b)) {
      if (m) files.set(path, m);
      continue;
    }
    if (sameFile(m, b)) {
      if (t) files.set(path, t);
      continue;
    }

    // Both sides changed the file.
    const [baseText, mineText, theirText] = await Promise.all([text(b), text(m), text(t)]);
    const binary =
      (m !== undefined && mineText === null) || (t !== undefined && theirText === null);
    if (m && t && !binary) {
      const result = mergeText(path, b ? baseText : null, mineText!, theirText!);
      if (result.clean) {
        files.set(path, { mode: m.mode, content: new TextEncoder().encode(result.merged) });
        continue;
      }
      const conflict: MergeConflict = {
        path,
        type: b ? 'content' : 'add-add',
        ours: mineText,
        theirs: theirText,
        base: baseText,
        merged: result.merged,
      };
      if (!resolve(conflict)) conflicts.push(conflict);
      continue;
    }
    const conflict: MergeConflict = {
      path,
      type: m && t ? (b ? 'content' : 'add-add') : 'delete-modify',
      ours: m ? (mineText ?? '') : null,
      theirs: t ? (theirText ?? '') : null,
      base: baseText,
      ...(binary ? { binary: true } : {}),
    };
    if (!resolve(conflict)) conflicts.push(conflict);
  }

  /** Apply the user's resolution of `conflict`; false when there is none, or it is not valid. */
  function resolve(conflict: MergeConflict): boolean {
    const resolution = resolutions.get(conflict.path);
    if (!resolution) return false;
    const { path } = conflict;
    const m = mine.get(path);
    const t = theirs.get(path);
    if (resolution.choice === 'merged') {
      const content = resolution.content;
      if (content === undefined || conflict.binary || hasConflictMarkers(content)) return false;
      files.set(path, {
        mode: m?.mode ?? t?.mode ?? REGULAR_FILE,
        content: new TextEncoder().encode(content),
      });
      return true;
    }
    const chosen = resolution.choice === 'mine' ? m : t;
    const other = resolution.choice === 'mine' ? t : m;
    if (chosen) files.set(path, chosen);
    // The version not chosen stays as a copy; a deletion has nothing to keep.
    if (chosen && other) {
      keepCopy(
        path,
        other,
        resolution.choice === 'mine'
          ? `their version ${input.labels.theirs}`
          : `my version ${input.labels.mine}`,
      );
    }
    return true;
  }

  return { files, conflicts, copies };
}
