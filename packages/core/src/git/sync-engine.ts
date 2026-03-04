/**
 * SyncEngine — Manages the pull/push cycle for Git-backed workspaces.
 *
 * Coordinates auto-commit, branch strategy, and merge resolution
 * into a unified sync loop that keeps local and remote in sync.
 */

import type { GitStorageBackend, PushResult, MergeResult } from '../storage/backend.js';

export interface SyncConfig {
  /** Sync interval in milliseconds. Default: 30000 (30s) */
  intervalMs?: number;
  /** Whether to auto-push after successful pull. Default: true */
  autoPush?: boolean;
  /** Whether to auto-pull before push. Default: true */
  autoPull?: boolean;
  /** Maximum retry attempts for push/pull. Default: 3 */
  maxRetries?: number;
  /** Whether sync is enabled. Default: true */
  enabled?: boolean;
}

export type SyncState =
  | 'idle'
  | 'pulling'
  | 'pushing'
  | 'synced'
  | 'conflict'
  | 'error'
  | 'offline';

export interface SyncStatus {
  state: SyncState;
  enabled: boolean;
  lastSyncTime: number | null;
  lastError: string | null;
  pendingPush: boolean;
  conflicts: string[];
}

export type SyncEventType =
  | 'sync-start'
  | 'pull-start'
  | 'pull-complete'
  | 'push-start'
  | 'push-complete'
  | 'sync-complete'
  | 'conflict'
  | 'error'
  | 'offline'
  | 'online';

export interface SyncEvent {
  type: SyncEventType;
  error?: Error;
  conflicts?: string[];
  pushResult?: PushResult;
  mergeResult?: MergeResult;
}

export type SyncListener = (event: SyncEvent) => void;

const DEFAULT_INTERVAL_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;

export class SyncEngine {
  private backend: GitStorageBackend;
  private config: Required<SyncConfig>;
  private listeners: SyncListener[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private _state: SyncState = 'idle';
  private _lastSyncTime: number | null = null;
  private _lastError: string | null = null;
  private _pendingPush = false;
  private _conflicts: string[] = [];
  private _syncing = false;

  constructor(backend: GitStorageBackend, config?: SyncConfig) {
    this.backend = backend;
    this.config = {
      intervalMs: config?.intervalMs ?? DEFAULT_INTERVAL_MS,
      autoPush: config?.autoPush ?? true,
      autoPull: config?.autoPull ?? true,
      maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
      enabled: config?.enabled ?? true,
    };
  }

  /** Start the sync loop */
  start(): void {
    if (this.timer) return;
    if (!this.config.enabled) return;

    this.timer = setInterval(() => {
      this.sync();
    }, this.config.intervalMs);
  }

  /** Stop the sync loop */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run a single sync cycle (pull then push) */
  async sync(): Promise<SyncStatus> {
    if (this._syncing) return this.getStatus();

    this._syncing = true;
    this.setState('pulling');
    this.emit({ type: 'sync-start' });

    try {
      // Pull
      if (this.config.autoPull) {
        this.emit({ type: 'pull-start' });
        const mergeResult = await this.pullWithRetry();

        if (!mergeResult.ok) {
          this._conflicts = mergeResult.conflicts;
          this.setState('conflict');
          this.emit({ type: 'conflict', conflicts: mergeResult.conflicts, mergeResult });
          this._syncing = false;
          return this.getStatus();
        }

        this.emit({ type: 'pull-complete', mergeResult });
      }

      // Push
      if (this.config.autoPush || this._pendingPush) {
        this.setState('pushing');
        this.emit({ type: 'push-start' });

        const pushResult = await this.pushWithRetry();
        this._pendingPush = !pushResult.ok;

        this.emit({ type: 'push-complete', pushResult });

        if (!pushResult.ok) {
          this._lastError = 'Push failed';
          this.setState('error');
          this.emit({ type: 'error', error: new Error('Push failed') });
          this._syncing = false;
          return this.getStatus();
        }
      }

      this._lastSyncTime = Date.now();
      this._lastError = null;
      this._conflicts = [];
      this.setState('synced');
      this.emit({ type: 'sync-complete' });
    } catch (e) {
      const error = e as Error;
      this._lastError = error.message;

      if (this.isNetworkError(error)) {
        this.setState('offline');
        this.emit({ type: 'offline', error });
      } else {
        this.setState('error');
        this.emit({ type: 'error', error });
      }
    } finally {
      this._syncing = false;
    }

    return this.getStatus();
  }

  /** Mark that there are local changes to push */
  markDirty(): void {
    this._pendingPush = true;
  }

  /** Report that network is back online */
  reportOnline(): void {
    if (this._state === 'offline') {
      this.setState('idle');
      this.emit({ type: 'online' });
    }
  }

  /** Resolve conflicts (called after user resolves manually) */
  resolveConflicts(): void {
    this._conflicts = [];
    if (this._state === 'conflict') {
      this.setState('idle');
    }
  }

  /** Get current sync status */
  getStatus(): SyncStatus {
    return {
      state: this._state,
      enabled: this.config.enabled,
      lastSyncTime: this._lastSyncTime,
      lastError: this._lastError,
      pendingPush: this._pendingPush,
      conflicts: [...this._conflicts],
    };
  }

  /** Enable or disable sync */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /** Subscribe to sync events */
  on(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Clean up */
  dispose(): void {
    this.stop();
    this.listeners = [];
  }

  private setState(state: SyncState): void {
    this._state = state;
  }

  private emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async pullWithRetry(): Promise<MergeResult> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.backend.pull();
      } catch (e) {
        lastError = e as Error;
        if (!this.isRetryable(lastError)) throw lastError;
      }
    }
    throw lastError ?? new Error('Pull failed after retries');
  }

  private async pushWithRetry(): Promise<PushResult> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.backend.push();
      } catch (e) {
        lastError = e as Error;
        if (!this.isRetryable(lastError)) throw lastError;
      }
    }
    throw lastError ?? new Error('Push failed after retries');
  }

  private isNetworkError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('timeout') ||
      msg.includes('offline')
    );
  }

  private isRetryable(error: Error): boolean {
    return this.isNetworkError(error) || error.message.includes('503');
  }
}
