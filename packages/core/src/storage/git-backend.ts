/**
 * GitBackend — StorageBackend implementation wrapping isomorphic-git.
 *
 * Wraps an underlying filesystem backend (BrowserFsBackend or LocalFsBackend)
 * and adds Git operations: commit, push, pull, log, diff, branch, remote.
 * This is the ONLY module that imports isomorphic-git directly.
 *
 * The filesystem used by isomorphic-git is injected via the `fs` constructor
 * option. This allows the backend to work with any compatible filesystem
 * (node:fs, lightning-fs, memfs, etc.) rather than hardcoding node:fs.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import type {
  GitStorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  Unsubscribe,
  CommitHash,
  CommitInfo,
  PushResult,
  MergeResult,
  DiffResult,
  LogOptions,
  Branch,
  BranchOperations,
  RemoteOperations,
  StorageBackend,
} from './backend.js';

const GIT_CAPABILITIES: BackendCapabilities = {
  history: true,
  collaboration: true,
  sync: true,
  branching: true,
  externalEditing: true,
  watchForExternalChanges: true,
};

/** Auth credentials for Git HTTP operations */
export interface GitAuth {
  username?: string;
  password?: string;
  token?: string;
  headers?: Record<string, string>;
}

/**
 * Filesystem interface expected by isomorphic-git.
 * Any object implementing these methods can be injected (node:fs, lightning-fs, memfs, etc.).
 */
export interface GitFs {
  readFile: (...args: unknown[]) => unknown;
  writeFile: (...args: unknown[]) => unknown;
  unlink: (...args: unknown[]) => unknown;
  readdir: (...args: unknown[]) => unknown;
  mkdir: (...args: unknown[]) => unknown;
  rmdir: (...args: unknown[]) => unknown;
  stat: (...args: unknown[]) => unknown;
  lstat: (...args: unknown[]) => unknown;
  /** promises namespace (isomorphic-git uses this when available) */
  promises?: {
    readFile: (...args: unknown[]) => Promise<unknown>;
    writeFile: (...args: unknown[]) => Promise<unknown>;
    unlink: (...args: unknown[]) => Promise<unknown>;
    readdir: (...args: unknown[]) => Promise<unknown>;
    mkdir: (...args: unknown[]) => Promise<unknown>;
    rmdir: (...args: unknown[]) => Promise<unknown>;
    stat: (...args: unknown[]) => Promise<unknown>;
    lstat: (...args: unknown[]) => Promise<unknown>;
  };
}

export class GitBackend implements GitStorageBackend {
  readonly type = 'git' as const;
  readonly capabilities: BackendCapabilities = GIT_CAPABILITIES;

  readonly branch: BranchOperations;
  readonly remote: RemoteOperations;

  private underlying: StorageBackend;
  private dir: string;
  private fs: GitFs;
  private auth?: GitAuth;
  private authorName: string;
  private authorEmail: string;

  constructor(options: {
    underlying: StorageBackend;
    dir: string;
    fs: GitFs;
    auth?: GitAuth;
    authorName?: string;
    authorEmail?: string;
  }) {
    this.underlying = options.underlying;
    this.dir = options.dir;
    this.fs = options.fs;
    this.auth = options.auth;
    this.authorName = options.authorName ?? 'Cept User';
    this.authorEmail = options.authorEmail ?? 'user@cept.app';

    this.branch = {
      create: this.branchCreate.bind(this),
      switch: this.branchSwitch.bind(this),
      merge: this.branchMerge.bind(this),
      list: this.branchList.bind(this),
      current: this.branchCurrent.bind(this),
      delete: this.branchDelete.bind(this),
    };

    this.remote = {
      add: this.remoteAdd.bind(this),
      remove: this.remoteRemove.bind(this),
      list: this.remoteList.bind(this),
    };
  }

  // -- StorageBackend delegation --

  async readFile(path: string): Promise<Uint8Array | null> {
    return this.underlying.readFile(path);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    return this.underlying.writeFile(path, data);
  }

  async deleteFile(path: string): Promise<void> {
    return this.underlying.deleteFile(path);
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    return this.underlying.listDirectory(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.underlying.exists(path);
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    return this.underlying.watch(path, callback);
  }

  async stat(path: string): Promise<FileStat | null> {
    return this.underlying.stat(path);
  }

  async initialize(config: WorkspaceConfig): Promise<void> {
    await this.underlying.initialize(config);
    // Initialize a Git repo if not already one
    try {
      await git.findRoot({ fs: this.fs, filepath: this.dir });
    } catch {
      await git.init({ fs: this.fs, dir: this.dir, defaultBranch: 'main' });
    }
  }

  async close(): Promise<void> {
    return this.underlying.close();
  }

  // -- Git operations --

  async commit(message: string, paths?: string[]): Promise<CommitHash> {
    if (paths && paths.length > 0) {
      for (const filepath of paths) {
        await git.add({ fs: this.fs, dir: this.dir, filepath });
      }
    } else {
      // Stage all changes
      await this.stageAll();
    }

    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: {
        name: this.authorName,
        email: this.authorEmail,
      },
    });

    return sha;
  }

  async push(branch?: string): Promise<PushResult> {
    const ref = branch ?? (await this.branchCurrent());
    const result = await git.push({
      fs: this.fs,
      http,
      dir: this.dir,
      ref,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
    return {
      ok: result.ok ?? false,
      refs: result.refs
        ? Object.fromEntries(
            Object.entries(result.refs).map(([k, v]) => [
              k,
              { ok: v.ok ?? false, error: v.error },
            ]),
          )
        : {},
    };
  }

  async pull(branch?: string): Promise<MergeResult> {
    const ref = branch ?? (await this.branchCurrent());
    try {
      await git.pull({
        fs: this.fs,
        http,
        dir: this.dir,
        ref,
        author: {
          name: this.authorName,
          email: this.authorEmail,
        },
        onAuth: this.auth ? () => this.getOnAuth() : undefined,
      });
      return { ok: true, conflicts: [] };
    } catch (e) {
      const error = e as Error;
      if (error.message?.includes('conflict')) {
        return { ok: false, conflicts: [error.message] };
      }
      throw e;
    }
  }

  async log(path?: string, options?: LogOptions): Promise<CommitInfo[]> {
    const logResult = await git.log({
      fs: this.fs,
      dir: this.dir,
      filepath: path,
      depth: options?.limit,
    });

    return logResult
      .filter((entry) => {
        if (options?.since && entry.commit.author.timestamp * 1000 < options.since.getTime()) {
          return false;
        }
        if (options?.until && entry.commit.author.timestamp * 1000 > options.until.getTime()) {
          return false;
        }
        return true;
      })
      .map((entry) => ({
        hash: entry.oid,
        message: entry.commit.message.trimEnd(),
        author: {
          name: entry.commit.author.name,
          email: entry.commit.author.email,
          timestamp: entry.commit.author.timestamp,
        },
        parent: entry.commit.parent,
      }));
  }

  async diff(commitA: string, commitB: string, _path?: string): Promise<DiffResult> {
    const treeA = await this.getTreeAtCommit(commitA);
    const treeB = await this.getTreeAtCommit(commitB);

    const files: DiffResult['files'] = [];

    // Find additions and modifications
    for (const [filePath, hashB] of treeB) {
      const hashA = treeA.get(filePath);
      if (!hashA) {
        const contentB = await this.readBlobAtCommit(commitB, filePath);
        const hunks = generateUnifiedHunks('', contentB);
        files.push({ path: filePath, type: 'add', hunks });
      } else if (hashA !== hashB) {
        const contentA = await this.readBlobAtCommit(commitA, filePath);
        const contentB = await this.readBlobAtCommit(commitB, filePath);
        const hunks = generateUnifiedHunks(contentA, contentB);
        files.push({ path: filePath, type: 'modify', hunks });
      }
    }

    // Find deletions
    for (const [filePath] of treeA) {
      if (!treeB.has(filePath)) {
        const contentA = await this.readBlobAtCommit(commitA, filePath);
        const hunks = generateUnifiedHunks(contentA, '');
        files.push({ path: filePath, type: 'delete', hunks });
      }
    }

    return { files };
  }

  // -- Branch operations --

  private async branchCreate(name: string, from?: string): Promise<void> {
    if (from) {
      const oid = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: from });
      await git.branch({ fs: this.fs, dir: this.dir, ref: name, object: oid });
    } else {
      await git.branch({ fs: this.fs, dir: this.dir, ref: name });
    }
  }

  private async branchSwitch(name: string): Promise<void> {
    await git.checkout({ fs: this.fs, dir: this.dir, ref: name });
  }

  private async branchMerge(source: string, target?: string): Promise<MergeResult> {
    try {
      const result = await git.merge({
        fs: this.fs,
        dir: this.dir,
        ours: target,
        theirs: source,
        author: {
          name: this.authorName,
          email: this.authorEmail,
        },
      });

      return {
        ok: true,
        conflicts: [],
        mergeCommit: result.oid,
      };
    } catch (e) {
      const error = e as Error;
      return {
        ok: false,
        conflicts: [error.message],
      };
    }
  }

  private async branchList(): Promise<Branch[]> {
    const branches = await git.listBranches({ fs: this.fs, dir: this.dir });
    const currentBranch = await this.branchCurrent();

    return branches.map((name) => ({
      name,
      current: name === currentBranch,
    }));
  }

  private async branchCurrent(): Promise<string> {
    return git.currentBranch({
      fs: this.fs,
      dir: this.dir,
      fullname: false,
    }) as Promise<string>;
  }

  private async branchDelete(name: string): Promise<void> {
    await git.deleteBranch({ fs: this.fs, dir: this.dir, ref: name });
  }

  // -- Remote operations --

  private async remoteAdd(name: string, url: string): Promise<void> {
    await git.addRemote({ fs: this.fs, dir: this.dir, remote: name, url });
  }

  private async remoteRemove(name: string): Promise<void> {
    await git.deleteRemote({ fs: this.fs, dir: this.dir, remote: name });
  }

  private async remoteList(): Promise<Array<{ name: string; url: string }>> {
    const remotes = await git.listRemotes({ fs: this.fs, dir: this.dir });
    return remotes.map((r) => ({ name: r.remote, url: r.url }));
  }

  // -- Internal helpers --

  private getOnAuth() {
    if (!this.auth) return undefined;
    if (this.auth.token) {
      return { username: this.auth.token, password: 'x-oauth-basic' };
    }
    return { username: this.auth.username, password: this.auth.password };
  }

  private async stageAll(): Promise<void> {
    const statusMatrix = await git.statusMatrix({ fs: this.fs, dir: this.dir });

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      if (headStatus === workdirStatus && workdirStatus === stageStatus) continue;

      if (workdirStatus === 0) {
        await git.remove({ fs: this.fs, dir: this.dir, filepath });
      } else if (headStatus !== workdirStatus || stageStatus !== workdirStatus) {
        await git.add({ fs: this.fs, dir: this.dir, filepath });
      }
    }
  }

  private async getTreeAtCommit(ref: string): Promise<Map<string, string>> {
    const tree = new Map<string, string>();

    await git.walk({
      fs: this.fs,
      dir: this.dir,
      trees: [git.TREE({ ref })],
      map: async (filepath, entries) => {
        if (!entries || entries.length === 0) return undefined;
        const entry = entries[0];
        if (!entry) return undefined;
        const entryType = await entry.type();
        if (entryType === 'blob') {
          const oid = await entry.oid();
          tree.set(filepath, oid);
        }
        return undefined;
      },
    });

    return tree;
  }

  /** Read the text content of a file at a specific commit */
  private async readBlobAtCommit(ref: string, filepath: string): Promise<string> {
    let content = '';

    await git.walk({
      fs: this.fs,
      dir: this.dir,
      trees: [git.TREE({ ref })],
      map: async (entryPath, entries) => {
        if (entryPath !== filepath) return undefined;
        if (!entries || entries.length === 0) return undefined;
        const entry = entries[0];
        if (!entry) return undefined;
        const entryType = await entry.type();
        if (entryType === 'blob') {
          const blob = await entry.content();
          if (blob) {
            content = new TextDecoder().decode(blob);
          }
        }
        return undefined;
      },
    });

    return content;
  }
}

/**
 * Generate unified diff hunks from two strings.
 * Uses LCS-based diff to produce hunks in unified diff format.
 */
function generateUnifiedHunks(oldText: string, newText: string): string[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const diffOps = computeLcsDiff(oldLines, newLines);
  if (diffOps.length === 0) return [];

  // Check if there are any actual changes
  const hasChanges = diffOps.some((op) => op.type !== 'context');
  if (!hasChanges) return [];

  // Group into hunks with 3 lines of context
  const contextSize = 3;
  const hunkRanges: Array<{ start: number; end: number }> = [];

  // Find ranges of non-context lines, expanded by contextSize
  for (let idx = 0; idx < diffOps.length; idx++) {
    if (diffOps[idx].type !== 'context') {
      const start = Math.max(0, idx - contextSize);
      const end = Math.min(diffOps.length, idx + contextSize + 1);

      if (hunkRanges.length > 0 && start <= hunkRanges[hunkRanges.length - 1].end) {
        hunkRanges[hunkRanges.length - 1].end = end;
      } else {
        hunkRanges.push({ start, end });
      }
    }
  }

  const hunks: string[] = [];

  for (const range of hunkRanges) {
    const lines: string[] = [];
    let oldCount = 0;
    let newCount = 0;

    // Calculate old/new start positions by counting ops before this range
    let oldStart = 1;
    let newStart = 1;
    for (let idx = 0; idx < range.start; idx++) {
      if (diffOps[idx].type === 'remove') oldStart++;
      else if (diffOps[idx].type === 'add') newStart++;
      else { oldStart++; newStart++; }
    }

    for (let idx = range.start; idx < range.end; idx++) {
      const op = diffOps[idx];
      if (op.type === 'remove') {
        lines.push(`-${op.content}`);
        oldCount++;
      } else if (op.type === 'add') {
        lines.push(`+${op.content}`);
        newCount++;
      } else {
        lines.push(` ${op.content}`);
        oldCount++;
        newCount++;
      }
    }

    const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`;
    hunks.push([header, ...lines].join('\n'));
  }

  return hunks;
}

interface DiffOp {
  type: 'add' | 'remove' | 'context';
  content: string;
}

/** Compute line-level diff using LCS. */
function computeLcsDiff(oldLines: string[], newLines: string[]): DiffOp[] {
  const m = oldLines.length;
  const n = newLines.length;

  // For very large files, fall back to simple remove-all/add-all
  if (m + n > 10000) {
    const ops: DiffOp[] = [];
    for (const line of oldLines) ops.push({ type: 'remove', content: line });
    for (const line of newLines) ops.push({ type: 'add', content: line });
    return ops;
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'context', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', content: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'remove', content: oldLines[i - 1] });
      i--;
    }
  }

  return ops;
}
