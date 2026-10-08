/**
 * Git space sessions (REQ-WS-027): an editable space kept in a local clone of
 * a GitHub repository.
 *
 * A session holds one `GitBackend` over the clone and gives the app a backend
 * rooted at the space (the clone's root, or the space's sub-folder in it).
 * Every write or delete through that backend is recorded for the auto-commit
 * engine, which commits on a debounce with the documented message template.
 * Syncing commits what is pending, pulls, then pushes, through `SyncEngine`.
 *
 * Commits are attributed to the signed-in account (`commitIdentityFor`), the
 * per-device settings file stays out of commits (`ensureExcluded`), and the
 * clone stays on the branch it was cloned at (`trackedBranch`).
 */

import { GitBackend } from '../storage/git-backend.js';
import type { GitAuth, GitFs, GitHttp } from '../storage/git-backend.js';
import { ScopedBackend } from '../storage/scoped.js';
import type {
  BackendCapabilities,
  DirEntry,
  FileStat,
  FsEvent,
  StorageBackend,
  Unsubscribe,
  WorkspaceConfig,
} from '../storage/backend.js';
import { AutoCommitEngine } from './auto-commit.js';
import type { FileChange } from './auto-commit.js';
import { SyncEngine } from './sync-engine.js';
import type { SyncStatus } from './sync-engine.js';
import { loadSyncSettings, SYNC_SETTINGS_EXCLUDE } from './sync-policy.js';
import type { CommitIdentity, SyncSettings } from './sync-policy.js';

/** Clean path segments, without `.` or empty parts. */
function segments(path: string): string[] {
  return path.split('/').filter((part) => part !== '' && part !== '.');
}

/**
 * A space's backend that reports each write and delete. Paths are relative to
 * the space root; `onChange` receives them relative to the repository root.
 */
export class RecordingBackend implements StorageBackend {
  readonly type: StorageBackend['type'];
  readonly capabilities: BackendCapabilities;

  constructor(
    private readonly space: StorageBackend,
    /** The space's folder inside the repository; empty for the repository root. */
    private readonly subPath: string,
    private readonly onChange: (repoPath: string, type: FileChange['type']) => void,
  ) {
    this.type = space.type;
    this.capabilities = space.capabilities;
  }

  private repoPath(path: string): string {
    return [...segments(this.subPath), ...segments(path)].join('/');
  }

  readFile(path: string): Promise<Uint8Array | null> {
    return this.space.readFile(path);
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const existed = await this.space.exists(path);
    await this.space.writeFile(path, data);
    this.onChange(this.repoPath(path), existed ? 'modify' : 'add');
  }

  async deleteFile(path: string): Promise<void> {
    const existed = await this.space.exists(path);
    await this.space.deleteFile(path);
    if (existed) this.onChange(this.repoPath(path), 'delete');
  }

  listDirectory(path: string): Promise<DirEntry[]> {
    return this.space.listDirectory(path);
  }

  exists(path: string): Promise<boolean> {
    return this.space.exists(path);
  }

  stat(path: string): Promise<FileStat | null> {
    return this.space.stat(path);
  }

  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe {
    return this.space.watch(path, callback);
  }

  initialize(config: WorkspaceConfig): Promise<void> {
    return this.space.initialize(config);
  }

  close(): Promise<void> {
    return this.space.close();
  }
}

export interface GitSpaceSessionOptions {
  /** The app's backend, which holds the clone. */
  host: StorageBackend;
  /**
   * The raw filesystem under `host`, for isomorphic-git. Must be the raw
   * filesystem of `host` (e.g. `host.getRawFs()`).
   */
  fs: GitFs;
  /** The clone's folder in `host`. */
  dir: string;
  /** The space's folder inside the repository; empty or absent for the root. */
  subPath?: string;
  http: GitHttp;
  corsProxy?: string;
  auth?: GitAuth;
  /** Who commits are attributed to (`commitIdentityFor`). */
  identity: CommitIdentity;
  /** Sync settings; read from the space's `.cept/sync.local.json` when absent. */
  settings?: SyncSettings;
}

/** The result of one sync. */
export interface GitSpaceSyncResult {
  status: SyncStatus;
  /** Whether the pull brought in commits, so the files on disk changed. */
  changed: boolean;
}

/** Local work not on the remote yet. */
export interface GitSpaceLocalChanges {
  /** Edited files not committed yet. */
  pending: number;
  /** Commits not pushed yet. */
  unpushed: number;
}

export class GitSpaceSession {
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by `stop()`, so a loop whose sync is still running does not schedule another. */
  private loop = 0;
  private disposed = false;
  /** The last sync queued, settled or not: syncs run one at a time, in order. */
  private tail: Promise<unknown> = Promise.resolve();

  private constructor(
    readonly git: GitBackend,
    /** The space's files, rooted at the space; edits through it are committed. */
    readonly backend: StorageBackend,
    readonly autoCommit: AutoCommitEngine,
    readonly sync: SyncEngine,
    readonly settings: SyncSettings,
  ) {}

  static async open(options: GitSpaceSessionOptions): Promise<GitSpaceSession> {
    const dir = `/${segments(options.dir).join('/')}`;
    const subPath = segments(options.subPath ?? '').join('/');
    const root = subPath ? `${dir}/${subPath}` : dir;
    const settings = options.settings ?? (await loadSyncSettings(options.host, root));
    const git = new GitBackend({
      underlying: options.host,
      dir,
      fs: options.fs,
      http: options.http,
      corsProxy: options.corsProxy,
      auth: options.auth,
      authorName: options.identity.name,
      authorEmail: options.identity.email,
    });
    await git.ensureExcluded(SYNC_SETTINGS_EXCLUDE);
    const autoCommit = new AutoCommitEngine(git, {
      debounceMs: settings.debounceMs,
      autoFlush: settings.autoCommit,
    });
    const sync = new SyncEngine(git, {
      intervalMs: settings.intervalMs,
      autoPush: settings.autoPush,
    });
    const backend = new RecordingBackend(
      new ScopedBackend(options.host, root),
      subPath,
      (path, type) => autoCommit.recordChange(path, type),
    );
    return new GitSpaceSession(git, backend, autoCommit, sync, settings);
  }

  /**
   * Run `task` after every sync queued before it has settled. Rejects once the
   * session is disposed.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new Error('The git space session is closed.'));
    const run = this.tail.then(task);
    this.tail = run.catch(() => undefined);
    return run;
  }

  private async runSync(): Promise<GitSpaceSyncResult> {
    await this.autoCommit.flushNow();
    const before = await this.git.head().catch(() => null);
    const status = await this.sync.sync();
    const after = await this.git.head().catch(() => null);
    return { status, changed: before !== after && status.state !== 'conflict' };
  }

  /** Commit what is pending, pull, then push (when auto-push is on). */
  syncNow(): Promise<GitSpaceSyncResult> {
    return this.enqueue(() => this.runSync());
  }

  /** Commit what is pending, pull, then push even when auto-push is off. */
  pushNow(): Promise<GitSpaceSyncResult> {
    return this.enqueue(() => {
      // runSync() commits what is pending; markDirty makes it push even when auto-push is off.
      this.sync.markDirty();
      return this.runSync();
    });
  }

  /**
   * Sync now, and again `intervalMs` after each sync settles, calling
   * `onSynced` after each one. The next sync is scheduled only once the
   * current one is done, so a slow sync never piles up behind another. The
   * first sync runs at once on purpose: opening a space (or coming back to
   * it) pulls what changed meanwhile.
   */
  start(onSynced?: (result: GitSpaceSyncResult) => void): void {
    this.stop();
    if (this.disposed) return;
    const loop = this.loop;
    const tick = () => {
      this.timer = null;
      void this.syncNow()
        .then((result) => onSynced?.(result))
        .catch(() => undefined)
        .finally(() => {
          if (loop !== this.loop || this.disposed) return;
          this.timer = setTimeout(tick, this.settings.intervalMs);
        });
    };
    tick();
  }

  /** Stop the automatic syncs; one already running finishes. */
  stop(): void {
    this.loop += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Edited files not committed yet, and commits not pushed yet. */
  async localChanges(): Promise<GitSpaceLocalChanges> {
    const unpushed = await this.git.unpushedCommits().catch(() => 0);
    return { pending: this.autoCommit.getPendingChanges().length, unpushed };
  }

  /**
   * Stop syncing, wait for a sync that is running to finish, then commit what
   * is pending. Safe to call more than once.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    await this.tail;
    await this.autoCommit.flushNow().catch(() => null);
    this.autoCommit.dispose();
    this.sync.dispose();
  }
}
