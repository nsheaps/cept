/**
 * AutoCommitEngine — Automatically commits changes to Git after a debounce period.
 *
 * Watches for file changes and batches them into commits.
 * Generates human-readable commit messages based on changed files.
 * Only operates when the backend supports Git operations.
 */

import type { GitStorageBackend, CommitHash } from '../storage/backend.js';

export interface AutoCommitConfig {
  /** Debounce delay in milliseconds before creating a commit. Default: 5000 */
  debounceMs?: number;
  /** Maximum number of changes to batch before forcing a commit. Default: 50 */
  maxBatchSize?: number;
  /** File patterns to exclude from auto-commit (glob-style). Default: ['.git/**'] */
  excludePatterns?: string[];
  /** Whether auto-commit is enabled. Default: true */
  enabled?: boolean;
  /** Custom commit message generator */
  messageGenerator?: (changes: FileChange[]) => string;
}

export interface FileChange {
  path: string;
  type: 'add' | 'modify' | 'delete';
  timestamp: number;
}

export interface AutoCommitStatus {
  enabled: boolean;
  pendingChanges: number;
  lastCommitHash: string | null;
  lastCommitTime: number | null;
}

export type AutoCommitListener = (event: AutoCommitEvent) => void;

export interface AutoCommitEvent {
  type: 'commit' | 'error' | 'batch-full' | 'change-detected';
  commitHash?: string;
  changes?: FileChange[];
  error?: Error;
}

const DEFAULT_DEBOUNCE_MS = 5000;
const DEFAULT_MAX_BATCH_SIZE = 50;
const DEFAULT_EXCLUDE = ['.git/**'];

/**
 * Checks if a path matches a simple glob pattern.
 * Supports only `**` (any directory depth) and `*` (any single segment).
 */
export function matchesPattern(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{DOUBLE_STAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(path);
}

/**
 * Generates a human-readable commit message from file changes.
 */
export function generateCommitMessage(changes: FileChange[]): string {
  if (changes.length === 0) return 'Empty commit';

  const adds = changes.filter((c) => c.type === 'add');
  const modifies = changes.filter((c) => c.type === 'modify');
  const deletes = changes.filter((c) => c.type === 'delete');

  const parts: string[] = [];

  if (adds.length === 1) {
    parts.push(`Add ${getShortPath(adds[0].path)}`);
  } else if (adds.length > 1) {
    parts.push(`Add ${adds.length} files`);
  }

  if (modifies.length === 1) {
    parts.push(`Update ${getShortPath(modifies[0].path)}`);
  } else if (modifies.length > 1) {
    parts.push(`Update ${modifies.length} files`);
  }

  if (deletes.length === 1) {
    parts.push(`Delete ${getShortPath(deletes[0].path)}`);
  } else if (deletes.length > 1) {
    parts.push(`Delete ${deletes.length} files`);
  }

  if (parts.length === 0) return 'Auto-save changes';

  return parts.join(', ');
}

function getShortPath(path: string): string {
  const parts = path.split('/');
  return parts.length > 2
    ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    : path;
}

export class AutoCommitEngine {
  private backend: GitStorageBackend;
  private config: Required<Omit<AutoCommitConfig, 'messageGenerator'>> & {
    messageGenerator: (changes: FileChange[]) => string;
  };
  private pendingChanges: FileChange[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: AutoCommitListener[] = [];
  private lastCommitHash: string | null = null;
  private lastCommitTime: number | null = null;
  private _enabled: boolean;

  constructor(backend: GitStorageBackend, config?: AutoCommitConfig) {
    this.backend = backend;
    this._enabled = config?.enabled ?? true;
    this.config = {
      debounceMs: config?.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxBatchSize: config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
      excludePatterns: config?.excludePatterns ?? DEFAULT_EXCLUDE,
      enabled: this._enabled,
      messageGenerator: config?.messageGenerator ?? generateCommitMessage,
    };
  }

  /** Record a file change to be auto-committed */
  recordChange(path: string, type: FileChange['type']): void {
    if (!this._enabled) return;

    if (this.isExcluded(path)) return;

    // Deduplicate: update existing change for same path
    const existing = this.pendingChanges.findIndex((c) => c.path === path);
    if (existing >= 0) {
      this.pendingChanges[existing] = { path, type, timestamp: Date.now() };
    } else {
      this.pendingChanges.push({ path, type, timestamp: Date.now() });
    }

    this.emit({ type: 'change-detected', changes: [{ path, type, timestamp: Date.now() }] });

    if (this.pendingChanges.length >= this.config.maxBatchSize) {
      this.emit({ type: 'batch-full', changes: [...this.pendingChanges] });
      this.flushNow();
      return;
    }

    this.scheduleCommit();
  }

  /** Force an immediate commit of pending changes */
  async flushNow(): Promise<CommitHash | null> {
    this.cancelTimer();

    if (this.pendingChanges.length === 0) return null;

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    try {
      const message = this.config.messageGenerator(changes);
      const paths = changes.map((c) => c.path);
      const hash = await this.backend.commit(message, paths);

      this.lastCommitHash = hash;
      this.lastCommitTime = Date.now();

      this.emit({ type: 'commit', commitHash: hash, changes });
      return hash;
    } catch (e) {
      // Re-add changes if commit fails
      this.pendingChanges.push(...changes);
      this.emit({ type: 'error', error: e as Error, changes });
      return null;
    }
  }

  /** Get current status */
  getStatus(): AutoCommitStatus {
    return {
      enabled: this._enabled,
      pendingChanges: this.pendingChanges.length,
      lastCommitHash: this.lastCommitHash,
      lastCommitTime: this.lastCommitTime,
    };
  }

  /** Enable or disable auto-commit */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    this.config.enabled = enabled;
    if (!enabled) {
      this.cancelTimer();
    }
  }

  /** Get pending changes */
  getPendingChanges(): ReadonlyArray<FileChange> {
    return this.pendingChanges;
  }

  /** Subscribe to auto-commit events */
  on(listener: AutoCommitListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Cancel any pending commit timer */
  dispose(): void {
    this.cancelTimer();
    this.listeners = [];
  }

  private isExcluded(path: string): boolean {
    return this.config.excludePatterns.some((p) => matchesPattern(path, p));
  }

  private scheduleCommit(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.flushNow();
    }, this.config.debounceMs);
  }

  private cancelTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emit(event: AutoCommitEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
