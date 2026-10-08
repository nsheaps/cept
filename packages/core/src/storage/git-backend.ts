/**
 * GitBackend — StorageBackend implementation wrapping isomorphic-git.
 *
 * Wraps an underlying filesystem backend (BrowserFsBackend, or LocalFsBackend from @cept/desktop)
 * and adds Git operations: commit, push, pull, log, diff, branch, remote.
 * This is the ONLY module that imports isomorphic-git directly.
 *
 * The filesystem used by isomorphic-git is injected via the `fs` constructor
 * option. This allows the backend to work with any compatible filesystem
 * (node:fs, lightning-fs, memfs, etc.) rather than hardcoding node:fs.
 */

import git from 'isomorphic-git';
import type { HttpClient, TreeObject } from 'isomorphic-git';
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
import { SyncError } from '../git/sync-errors.js';
import { planMerge } from '../git/tree-merge.js';
import type { ConflictResolution, MergedFile, TreeFile } from '../git/tree-merge.js';
import { withExcludeLine } from '../git/sync-policy.js';

const GIT_CAPABILITIES: BackendCapabilities = {
  history: true,
  collaboration: true,
  sync: true,
  branching: true,
  externalEditing: true,
  watchForExternalChanges: true,
};

/** The depth git asks for on `fetch --unshallow`: everything. */
const UNSHALLOW_DEPTH = 2147483647;

/** The remote branch was rewritten: it no longer contains the local commit. */
export class GitDivergedError extends Error {
  constructor(readonly ref: string) {
    super(`The remote branch "${ref}" was rewritten and no longer contains the local commit.`);
    this.name = 'GitDivergedError';
  }
}

/** Auth credentials for Git HTTP operations */
export interface GitAuth {
  username?: string;
  password?: string;
  token?: string;
  headers?: Record<string, string>;
}

/**
 * HTTP client type expected by isomorphic-git.
 * Use `isomorphic-git/http/web` in browsers and `isomorphic-git/http/node` in Node.
 * Re-exported from isomorphic-git for convenience.
 */
export type GitHttp = HttpClient;

/**
 * The browser HTTP client for isomorphic-git (`isomorphic-git/http/web`, which
 * uses `fetch`), loaded on first use so it stays out of the initial bundle.
 */
export async function createGitHttp(): Promise<GitHttp> {
  const module = await import('isomorphic-git/http/web');
  return module.default;
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
  private http?: GitHttp;
  private corsProxy?: string;
  private auth?: GitAuth;
  private authorName: string;
  private authorEmail: string;

  constructor(options: {
    underlying: StorageBackend;
    dir: string;
    fs: GitFs;
    http?: GitHttp;
    corsProxy?: string;
    auth?: GitAuth;
    authorName?: string;
    authorEmail?: string;
  }) {
    this.underlying = options.underlying;
    this.dir = options.dir;
    this.fs = options.fs;
    this.http = options.http;
    this.corsProxy = options.corsProxy;
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
      for (const filepath of paths) await this.stagePath(filepath);
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
    if (!this.http) throw new Error('GitBackend: http client required for push');
    const ref = branch ?? (await this.branchCurrent());
    // Nothing to send when origin's copy is already this commit: skip the
    // round trip, which a protected branch would refuse even as a no-op.
    if (await this.upToDateWithOrigin(ref)) return { ok: true, refs: {} };
    const result = await git.push({
      fs: this.fs,
      http: this.http,
      dir: this.dir,
      ref,
      corsProxy: this.corsProxy,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
    return {
      ok: result.ok ?? false,
      refs: result.refs
        ? Object.fromEntries(
            Object.entries(result.refs).map(([k, v]) => [k, { ok: v.ok ?? false, error: v.error }]),
          )
        : {},
    };
  }

  /**
   * Fetch the branch from `origin` and merge it into the local one
   * (`mergeRemote`). A conflict leaves everything as it was and comes back
   * as `ok: false` with each file's versions in `details`.
   */
  async pull(branch?: string): Promise<MergeResult> {
    const ref = branch ?? (await this.branchCurrent());
    await this.fetch(ref);
    return this.mergeRemote({ branch: ref });
  }

  /**
   * Merge `origin`'s copy of the branch, as last fetched, into the local
   * branch and the working tree (REQ-WS-026): a fast-forward when the local
   * branch has nothing of its own, otherwise a merge commit planned by
   * `planMerge`, with `resolutions` applied to the conflicts the user has
   * resolved. While a conflict remains nothing changes, and the result is
   * `ok: false` with the conflicts in `details`.
   */
  async mergeRemote(
    options: { branch?: string; resolutions?: readonly ConflictResolution[] } = {},
  ): Promise<MergeResult> {
    const ref = options.branch ?? (await this.branchCurrent());
    const local = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${ref}` });
    let remote: string;
    try {
      remote = await git.resolveRef({
        fs: this.fs,
        dir: this.dir,
        ref: `refs/remotes/origin/${ref}`,
      });
    } catch {
      // Nothing fetched for this branch yet: nothing to merge.
      return { ok: true, conflicts: [] };
    }
    const descends = (oid: string, ancestor: string) =>
      git.isDescendent({ fs: this.fs, dir: this.dir, oid, ancestor, depth: -1 });
    if (local === remote || (await descends(local, remote))) return { ok: true, conflicts: [] };
    if (await descends(remote, local)) {
      await this.moveBranch(ref, local, remote);
      return { ok: true, conflicts: [], mergeCommit: remote };
    }

    const [base] = await git.findMergeBase({ fs: this.fs, dir: this.dir, oids: [local, remote] });
    if (typeof base !== 'string') {
      throw new SyncError(
        'conflict',
        `The local branch "${ref}" and the remote one share no commit, so they cannot be merged.`,
      );
    }
    const plan = await planMerge({
      base: await this.flatTree(base),
      mine: await this.flatTree(local),
      theirs: await this.flatTree(remote),
      read: async (oid) => (await git.readBlob({ fs: this.fs, dir: this.dir, oid })).blob,
      resolutions: options.resolutions,
      labels: { mine: local.slice(0, 7), theirs: remote.slice(0, 7) },
    });
    if (plan.conflicts.length > 0) {
      return { ok: false, conflicts: plan.conflicts.map((c) => c.path), details: plan.conflicts };
    }
    const tree = await this.writeMergedTree(plan.files);
    const commit = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message: `Merge remote-tracking branch 'origin/${ref}'`,
      author: { name: this.authorName, email: this.authorEmail },
      tree,
      parent: [local, remote],
      noUpdateBranch: true,
    });
    await this.moveBranch(ref, local, commit);
    return { ok: true, conflicts: [], mergeCommit: commit };
  }

  /**
   * Point branch `ref` at `to` and check it out. The checkout refuses to
   * overwrite edits not committed yet; the branch then goes back to `from`.
   */
  private async moveBranch(ref: string, from: string, to: string): Promise<void> {
    const write = (value: string) =>
      git.writeRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${ref}`, value, force: true });
    await write(to);
    try {
      await git.checkout({ fs: this.fs, dir: this.dir, ref });
    } catch (err) {
      await write(from);
      throw err;
    }
  }

  /** A commit's files by path, with their blob ids and modes. */
  private async flatTree(commit: string): Promise<Map<string, TreeFile>> {
    const files = new Map<string, TreeFile>();
    await git.walk({
      fs: this.fs,
      dir: this.dir,
      trees: [git.TREE({ ref: commit })],
      map: async (filepath, [entry]) => {
        if (!entry || filepath === '.') return true;
        const type = await entry.type();
        if (type === 'blob' || type === 'commit') {
          files.set(filepath, {
            oid: await entry.oid(),
            mode: (await entry.mode()).toString(8),
          });
        }
        return true;
      },
    });
    return files;
  }

  /** Write a merge's files as trees; returns the root tree's id. */
  private async writeMergedTree(files: ReadonlyMap<string, MergedFile>): Promise<string> {
    interface Folder {
      files: Map<string, TreeFile>;
      folders: Map<string, Folder>;
    }
    const newFolder = (): Folder => ({ files: new Map(), folders: new Map() });
    const root = newFolder();
    const clash = (path: string) =>
      new SyncError(
        'conflict',
        `"${path}" is a file on one side of the merge and a folder on the other.`,
        [path],
      );
    for (const [path, file] of files) {
      const oid =
        'content' in file
          ? await git.writeBlob({ fs: this.fs, dir: this.dir, blob: file.content })
          : file.oid;
      const parts = path.split('/');
      const name = parts.pop()!;
      let folder = root;
      for (const part of parts) {
        if (folder.files.has(part)) throw clash(path);
        let next = folder.folders.get(part);
        if (!next) {
          next = newFolder();
          folder.folders.set(part, next);
        }
        folder = next;
      }
      if (folder.folders.has(name)) throw clash(path);
      folder.files.set(name, { oid, mode: file.mode });
    }
    const write = async (folder: Folder): Promise<string> => {
      const tree: TreeObject = [];
      for (const [path, file] of folder.files) {
        tree.push({
          mode: file.mode,
          path,
          oid: file.oid,
          type: file.mode === '160000' ? 'commit' : 'blob',
        });
      }
      for (const [path, sub] of folder.folders) {
        tree.push({ mode: '040000', path, oid: await write(sub), type: 'tree' });
      }
      return git.writeTree({ fs: this.fs, dir: this.dir, tree });
    };
    return write(root);
  }

  /**
   * Push the current branch to a different branch on `origin` (the fallback
   * for a rejected push, REQ-WS-026). The local branch keeps tracking its own.
   */
  async pushTo(remoteBranch: string): Promise<PushResult> {
    if (!this.http) throw new Error('GitBackend: http client required for push');
    const ref = await this.branchCurrent();
    const result = await git.push({
      fs: this.fs,
      http: this.http,
      dir: this.dir,
      ref,
      remoteRef: remoteBranch,
      corsProxy: this.corsProxy,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
    return {
      ok: result.ok ?? false,
      refs: Object.fromEntries(
        Object.entries(result.refs ?? {}).map(([k, v]) => [
          k,
          { ok: v.ok ?? false, error: v.error },
        ]),
      ),
    };
  }

  /**
   * Move the local branch and the working tree to `origin`'s copy of it, as
   * last fetched, dropping local commits. Only for commits already pushed
   * elsewhere (`pushTo`).
   */
  async resetToRemote(branch?: string): Promise<void> {
    const ref = branch ?? (await this.branchCurrent());
    const remote = await git.resolveRef({
      fs: this.fs,
      dir: this.dir,
      ref: `refs/remotes/origin/${ref}`,
    });
    await git.writeRef({
      fs: this.fs,
      dir: this.dir,
      ref: `refs/heads/${ref}`,
      value: remote,
      force: true,
    });
    await git.checkout({ fs: this.fs, dir: this.dir, ref, force: true });
  }

  /**
   * Add `pattern` to the repository's `.git/info/exclude`, so files that match
   * it are never staged or committed (REQ-WS-027). Does nothing when the line
   * is already there.
   */
  async ensureExcluded(pattern: string): Promise<void> {
    const gitdir = `${this.dir.replace(/\/+$/, '')}/.git`;
    const path = `${gitdir}/info/exclude`;
    let text = '';
    try {
      text = String(await this.fsCall('readFile', path, 'utf8'));
    } catch {
      // No exclude file yet.
    }
    const next = withExcludeLine(text, pattern);
    if (next === text) return;
    try {
      await this.fsCall('mkdir', `${gitdir}/info`);
    } catch {
      // Already there.
    }
    await this.fsCall('writeFile', path, next, 'utf8');
  }

  /** Call the injected fs, through its `promises` namespace or its callback API. */
  private fsCall(
    name: 'readFile' | 'writeFile' | 'mkdir' | 'lstat',
    ...args: unknown[]
  ): Promise<unknown> {
    const promises = this.fs.promises;
    if (promises) return promises[name](...args);
    return new Promise((resolve, reject) => {
      this.fs[name](...args, (err: unknown, value: unknown) =>
        err ? reject(err) : resolve(value),
      );
    });
  }

  /**
   * Clone a remote repository into this backend's directory.
   * Should be called instead of `initialize()` when bootstrapping from a remote.
   */
  async clone(
    url: string,
    options?: { ref?: string; depth?: number; singleBranch?: boolean },
  ): Promise<void> {
    if (!this.http) throw new Error('GitBackend: http client required for clone');
    // isomorphic-git creates `dir`; the host's workspace (its config and
    // pages) is not the clone's and must not be initialized over.
    await git.clone({
      fs: this.fs,
      http: this.http,
      dir: this.dir,
      url,
      ref: options?.ref ?? 'main',
      singleBranch: options?.singleBranch ?? true,
      depth: options?.depth,
      corsProxy: this.corsProxy,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
  }

  /**
   * Fetch refs from the remote without merging into the working tree.
   */
  async fetch(branch?: string): Promise<void> {
    if (!this.http) throw new Error('GitBackend: http client required for fetch');
    const ref = branch ?? (await this.branchCurrent());
    await git.fetch({
      fs: this.fs,
      http: this.http,
      dir: this.dir,
      ref,
      corsProxy: this.corsProxy,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
  }

  /**
   * Fetch `ref` from `origin` and move the local branch and the working tree
   * to it, without re-cloning. Only new objects come over the wire.
   *
   * `fullHistory` also fetches the commits a shallow clone left out. When the
   * remote branch no longer contains the local commit (a force push), this
   * throws {@link GitDivergedError} unless `resetOnDivergence` is set, which
   * replaces the working tree with the remote's (for clones nobody edits).
   */
  async updateFromRemote(
    ref: string,
    options?: { fullHistory?: boolean; resetOnDivergence?: boolean },
  ): Promise<'updated' | 'unchanged'> {
    if (!this.http) throw new Error('GitBackend: http client required for fetch');
    await git.fetch({
      fs: this.fs,
      http: this.http,
      dir: this.dir,
      ref,
      singleBranch: true,
      tags: false,
      // git's own --unshallow depth.
      depth: options?.fullHistory ? UNSHALLOW_DEPTH : undefined,
      corsProxy: this.corsProxy,
      onAuth: this.auth ? () => this.getOnAuth() : undefined,
    });
    const local = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${ref}` });
    const remote = await git.resolveRef({
      fs: this.fs,
      dir: this.dir,
      ref: `refs/remotes/origin/${ref}`,
    });
    if (local === remote) return 'unchanged';
    // Stops (false) at a shallow clone's boundary rather than throwing; any error here is a real one.
    const fastForward = await git.isDescendent({
      fs: this.fs,
      dir: this.dir,
      oid: remote,
      ancestor: local,
      depth: -1,
    });
    if (!fastForward && !options?.resetOnDivergence) throw new GitDivergedError(ref);
    await git.writeRef({
      fs: this.fs,
      dir: this.dir,
      ref: `refs/heads/${ref}`,
      value: remote,
      force: true,
    });
    await git.checkout({ fs: this.fs, dir: this.dir, ref, force: true });
    return 'updated';
  }

  /** Whether `refs/heads/<ref>` and `origin`'s last-known copy of it are the same commit. */
  private async upToDateWithOrigin(ref: string): Promise<boolean> {
    try {
      const [local, remote] = await Promise.all([
        git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/heads/${ref}` }),
        git.resolveRef({ fs: this.fs, dir: this.dir, ref: `refs/remotes/origin/${ref}` }),
      ]);
      return local === remote;
    } catch {
      return false;
    }
  }

  /**
   * How many commits the current branch has that `origin`'s copy of it (as
   * last fetched, pulled or pushed) does not: local work that is not on the
   * remote yet. A branch with no remote-tracking ref counts every commit. In
   * a shallow clone only the commits it holds are counted.
   */
  async unpushedCommits(): Promise<number> {
    const branch = await this.branchCurrent();
    let remote: string | null = null;
    try {
      remote = await git.resolveRef({
        fs: this.fs,
        dir: this.dir,
        ref: `refs/remotes/origin/${branch}`,
      });
    } catch {
      remote = null;
    }
    const ours = await git.log({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
    if (!remote) return ours.length;
    const theirs = new Set(
      (await git.log({ fs: this.fs, dir: this.dir, ref: remote })).map((e) => e.oid),
    );
    return ours.filter((e) => !theirs.has(e.oid)).length;
  }

  /** The commit the current branch points at. */
  async head(): Promise<CommitHash> {
    return git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
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

  /** Stage one path: add it, or record its removal when the file is gone. */
  private async stagePath(filepath: string): Promise<void> {
    try {
      await this.fsCall('lstat', `${this.dir.replace(/\/+$/, '')}/${filepath}`);
    } catch {
      await git.remove({ fs: this.fs, dir: this.dir, filepath });
      return;
    }
    await git.add({ fs: this.fs, dir: this.dir, filepath });
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
      else {
        oldStart++;
        newStart++;
      }
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
