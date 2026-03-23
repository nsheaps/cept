/**
 * StorageBackend — The primary persistence abstraction for Cept.
 *
 * All workspace data (pages, databases, assets, config) is read/written
 * through this interface. Three implementations:
 * - BrowserFsBackend (lightning-fs / IndexedDB)
 * - LocalFsBackend (Node fs)
 * - GitBackend (extends StorageBackend + isomorphic-git)
 */

/** Unsubscribe function returned by watch() */
export type Unsubscribe = () => void;

/** Filesystem event types */
export type FsEventType = 'create' | 'modify' | 'delete';

/** Filesystem event emitted by watch() */
export interface FsEvent {
  type: FsEventType;
  path: string;
}

/** Directory entry returned by listDirectory() */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

/** File metadata */
export interface FileStat {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt: Date;
  createdAt: Date;
}

/** Workspace configuration passed to initialize() */
export interface WorkspaceConfig {
  name: string;
  icon?: string;
  defaultPage?: string;
}

/** Capabilities that vary by backend type */
export interface BackendCapabilities {
  /** Can browse past versions (Git log) */
  history: boolean;
  /** Can do real-time multi-user editing */
  collaboration: boolean;
  /** Can push/pull to remote */
  sync: boolean;
  /** Can create/merge branches */
  branching: boolean;
  /** Files editable outside Cept (local/git only) */
  externalEditing: boolean;
  /** Can detect changes made outside Cept */
  watchForExternalChanges: boolean;
}

/**
 * Core storage interface. Every backend implements these methods.
 * The editor, database engine, knowledge graph, search index, and template
 * system interact with storage ONLY through this interface.
 */
export interface StorageBackend {
  readonly type: 'browser' | 'local' | 'git';
  readonly capabilities: BackendCapabilities;

  // Core CRUD
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDirectory(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe;

  // Metadata
  stat(path: string): Promise<FileStat | null>;

  // Workspace lifecycle
  initialize(config: WorkspaceConfig): Promise<void>;
  close(): Promise<void>;
}

/** Hash of a Git commit */
export type CommitHash = string;

/** Result of a push operation */
export interface PushResult {
  ok: boolean;
  refs: Record<string, { ok: boolean; error?: string }>;
}

/** Result of a merge/pull operation */
export interface MergeResult {
  ok: boolean;
  conflicts: string[];
  mergeCommit?: CommitHash;
}

/** Options for log queries */
export interface LogOptions {
  limit?: number;
  since?: Date;
  until?: Date;
}

/** Information about a single commit */
export interface CommitInfo {
  hash: CommitHash;
  message: string;
  author: { name: string; email: string; timestamp: number };
  parent: CommitHash[];
}

/** Result of a diff operation */
export interface DiffResult {
  files: Array<{
    path: string;
    type: 'add' | 'modify' | 'delete';
    hunks: string[];
  }>;
}

/** Branch information */
export interface Branch {
  name: string;
  current: boolean;
  remote?: string;
}

/** Branch operations */
export interface BranchOperations {
  create(name: string, from?: string): Promise<void>;
  switch(name: string): Promise<void>;
  merge(source: string, target?: string): Promise<MergeResult>;
  list(): Promise<Branch[]>;
  current(): Promise<string>;
  delete(name: string): Promise<void>;
}

/** Remote operations */
export interface RemoteOperations {
  add(name: string, url: string): Promise<void>;
  remove(name: string): Promise<void>;
  list(): Promise<Array<{ name: string; url: string }>>;
}

/**
 * GitStorageBackend extends StorageBackend with Git-specific methods.
 * Only available when the workspace uses GitBackend.
 */
export interface GitStorageBackend extends StorageBackend {
  readonly type: 'git';

  // Git operations
  clone(url: string, options?: { ref?: string; depth?: number; singleBranch?: boolean }): Promise<void>;
  fetch(branch?: string): Promise<void>;
  commit(message: string, paths?: string[]): Promise<CommitHash>;
  push(branch?: string): Promise<PushResult>;
  pull(branch?: string): Promise<MergeResult>;
  log(path?: string, options?: LogOptions): Promise<CommitInfo[]>;
  diff(commitA: string, commitB: string, path?: string): Promise<DiffResult>;
  branch: BranchOperations;
  remote: RemoteOperations;
}
