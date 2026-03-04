/**
 * GitBackend — StorageBackend implementation wrapping isomorphic-git.
 *
 * Wraps an underlying filesystem backend (BrowserFsBackend or LocalFsBackend)
 * and adds Git operations: commit, push, pull, log, diff, branch, remote.
 * This is the ONLY module that imports isomorphic-git directly.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as nodeFs from 'node:fs';
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

export class GitBackend implements GitStorageBackend {
  readonly type = 'git' as const;
  readonly capabilities: BackendCapabilities = GIT_CAPABILITIES;

  readonly branch: BranchOperations;
  readonly remote: RemoteOperations;

  private underlying: StorageBackend;
  private dir: string;
  private auth?: GitAuth;
  private authorName: string;
  private authorEmail: string;

  constructor(options: {
    underlying: StorageBackend;
    dir: string;
    auth?: GitAuth;
    authorName?: string;
    authorEmail?: string;
  }) {
    this.underlying = options.underlying;
    this.dir = options.dir;
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
      await git.findRoot({ fs: nodeFs, filepath: this.dir });
    } catch {
      await git.init({ fs: nodeFs, dir: this.dir, defaultBranch: 'main' });
    }
  }

  async close(): Promise<void> {
    return this.underlying.close();
  }

  // -- Git operations --

  async commit(message: string, paths?: string[]): Promise<CommitHash> {
    if (paths && paths.length > 0) {
      for (const filepath of paths) {
        await git.add({ fs: nodeFs, dir: this.dir, filepath });
      }
    } else {
      // Stage all changes
      await this.stageAll();
    }

    const sha = await git.commit({
      fs: nodeFs,
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
      fs: nodeFs,
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
        fs: nodeFs,
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
      fs: nodeFs,
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
        files.push({ path: filePath, type: 'add', hunks: [] });
      } else if (hashA !== hashB) {
        files.push({ path: filePath, type: 'modify', hunks: [] });
      }
    }

    // Find deletions
    for (const [filePath] of treeA) {
      if (!treeB.has(filePath)) {
        files.push({ path: filePath, type: 'delete', hunks: [] });
      }
    }

    return { files };
  }

  // -- Branch operations --

  private async branchCreate(name: string, from?: string): Promise<void> {
    if (from) {
      const oid = await git.resolveRef({ fs: nodeFs, dir: this.dir, ref: from });
      await git.branch({ fs: nodeFs, dir: this.dir, ref: name, object: oid });
    } else {
      await git.branch({ fs: nodeFs, dir: this.dir, ref: name });
    }
  }

  private async branchSwitch(name: string): Promise<void> {
    await git.checkout({ fs: nodeFs, dir: this.dir, ref: name });
  }

  private async branchMerge(source: string, target?: string): Promise<MergeResult> {
    try {
      const result = await git.merge({
        fs: nodeFs,
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
    const branches = await git.listBranches({ fs: nodeFs, dir: this.dir });
    const currentBranch = await this.branchCurrent();

    return branches.map((name) => ({
      name,
      current: name === currentBranch,
    }));
  }

  private async branchCurrent(): Promise<string> {
    return git.currentBranch({
      fs: nodeFs,
      dir: this.dir,
      fullname: false,
    }) as Promise<string>;
  }

  private async branchDelete(name: string): Promise<void> {
    await git.deleteBranch({ fs: nodeFs, dir: this.dir, ref: name });
  }

  // -- Remote operations --

  private async remoteAdd(name: string, url: string): Promise<void> {
    await git.addRemote({ fs: nodeFs, dir: this.dir, remote: name, url });
  }

  private async remoteRemove(name: string): Promise<void> {
    await git.deleteRemote({ fs: nodeFs, dir: this.dir, remote: name });
  }

  private async remoteList(): Promise<Array<{ name: string; url: string }>> {
    const remotes = await git.listRemotes({ fs: nodeFs, dir: this.dir });
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
    const statusMatrix = await git.statusMatrix({ fs: nodeFs, dir: this.dir });

    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      if (headStatus === workdirStatus && workdirStatus === stageStatus) continue;

      if (workdirStatus === 0) {
        await git.remove({ fs: nodeFs, dir: this.dir, filepath });
      } else if (headStatus !== workdirStatus || stageStatus !== workdirStatus) {
        await git.add({ fs: nodeFs, dir: this.dir, filepath });
      }
    }
  }

  private async getTreeAtCommit(ref: string): Promise<Map<string, string>> {
    const tree = new Map<string, string>();

    await git.walk({
      fs: nodeFs,
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
}
