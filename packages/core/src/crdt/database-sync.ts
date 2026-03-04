/**
 * DatabaseSyncAdapter — Bridges database operations with real-time collaboration.
 *
 * Observes local database changes and broadcasts them to remote collaborators
 * through the signaling transport. Also applies incoming remote changes to
 * the local database engine.
 *
 * This adapter works with the abstract DatabaseEngine and SyncTransport
 * interfaces, keeping it platform-independent.
 */

import type { DatabaseRow } from '../models/index.js';

/** A database change operation that can be synced */
export interface DatabaseChange {
  /** Unique change ID for deduplication */
  changeId: string;
  /** Database this change belongs to */
  databaseId: string;
  /** Type of operation */
  operation: 'add-row' | 'update-row' | 'delete-row' | 'update-schema';
  /** Timestamp of the change */
  timestamp: number;
  /** User who made the change */
  userId: string;
  /** Row data for add/update operations */
  row?: DatabaseRow;
  /** Row ID for update/delete operations */
  rowId?: string;
  /** Property updates for update-row */
  properties?: Record<string, unknown>;
  /** Schema updates for update-schema */
  schemaUpdate?: Record<string, unknown>;
}

/** Callback for applying remote changes locally */
export type ApplyChangeCallback = (change: DatabaseChange) => Promise<void>;

export interface DatabaseSyncConfig {
  /** Current user ID */
  userId: string;
  /** Debounce outgoing changes (ms). Default: 50 */
  debounceMs?: number;
  /** Maximum batch size for outgoing changes. Default: 20 */
  maxBatchSize?: number;
}

export type DatabaseSyncEventType =
  | 'change-queued'
  | 'changes-sent'
  | 'changes-received'
  | 'change-applied'
  | 'conflict'
  | 'error';

export interface DatabaseSyncEvent {
  type: DatabaseSyncEventType;
  databaseId?: string;
  changeCount?: number;
  change?: DatabaseChange;
  error?: Error;
}

export type DatabaseSyncListener = (event: DatabaseSyncEvent) => void;

/** Broadcast function — sends serialized changes to remote peers */
export type BroadcastFn = (databaseId: string, changes: DatabaseChange[]) => void;

const DEFAULT_DEBOUNCE_MS = 50;
const DEFAULT_MAX_BATCH_SIZE = 20;

let changeIdCounter = 0;

export function generateChangeId(userId: string): string {
  changeIdCounter++;
  return `${userId}-${Date.now()}-${changeIdCounter}`;
}

export class DatabaseSyncAdapter {
  private config: Required<DatabaseSyncConfig>;
  private pendingChanges: DatabaseChange[] = [];
  private appliedChangeIds = new Set<string>();
  private listeners: DatabaseSyncListener[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastFn: BroadcastFn | null = null;
  private applyFn: ApplyChangeCallback | null = null;
  private _enabled = true;

  constructor(config: DatabaseSyncConfig) {
    this.config = {
      ...config,
      debounceMs: config.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE,
    };
  }

  /** Set the broadcast function for sending changes to remote peers */
  setBroadcast(fn: BroadcastFn): void {
    this.broadcastFn = fn;
  }

  /** Set the callback for applying remote changes locally */
  setApplyCallback(fn: ApplyChangeCallback): void {
    this.applyFn = fn;
  }

  /** Record a local database change for syncing */
  recordChange(
    databaseId: string,
    operation: DatabaseChange['operation'],
    data: {
      row?: DatabaseRow;
      rowId?: string;
      properties?: Record<string, unknown>;
      schemaUpdate?: Record<string, unknown>;
    },
  ): void {
    if (!this._enabled) return;

    const change: DatabaseChange = {
      changeId: generateChangeId(this.config.userId),
      databaseId,
      operation,
      timestamp: Date.now(),
      userId: this.config.userId,
      ...data,
    };

    this.appliedChangeIds.add(change.changeId);
    this.pendingChanges.push(change);
    this.emit({ type: 'change-queued', databaseId, change });

    if (this.pendingChanges.length >= this.config.maxBatchSize) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /** Receive changes from a remote peer */
  async receiveChanges(changes: DatabaseChange[]): Promise<void> {
    const newChanges = changes.filter(
      (c) => !this.appliedChangeIds.has(c.changeId),
    );

    if (newChanges.length === 0) return;

    this.emit({
      type: 'changes-received',
      changeCount: newChanges.length,
    });

    for (const change of newChanges) {
      this.appliedChangeIds.add(change.changeId);

      if (this.applyFn) {
        try {
          await this.applyFn(change);
          this.emit({
            type: 'change-applied',
            databaseId: change.databaseId,
            change,
          });
        } catch (e) {
          this.emit({
            type: 'error',
            databaseId: change.databaseId,
            change,
            error: e as Error,
          });
        }
      }
    }
  }

  /** Flush pending changes immediately */
  flush(): void {
    this.cancelDebounce();

    if (this.pendingChanges.length === 0) return;

    const changes = this.pendingChanges.splice(0);

    if (this.broadcastFn) {
      // Group by database
      const byDatabase = new Map<string, DatabaseChange[]>();
      for (const change of changes) {
        let list = byDatabase.get(change.databaseId);
        if (!list) {
          list = [];
          byDatabase.set(change.databaseId, list);
        }
        list.push(change);
      }

      for (const [databaseId, dbChanges] of byDatabase) {
        this.broadcastFn(databaseId, dbChanges);
        this.emit({
          type: 'changes-sent',
          databaseId,
          changeCount: dbChanges.length,
        });
      }
    }
  }

  /** Get the number of pending changes */
  getPendingCount(): number {
    return this.pendingChanges.length;
  }

  /** Check if a change has been applied (for deduplication) */
  hasApplied(changeId: string): boolean {
    return this.appliedChangeIds.has(changeId);
  }

  /** Enable/disable sync */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.cancelDebounce();
    }
  }

  /** Check if sync is enabled */
  isEnabled(): boolean {
    return this._enabled;
  }

  /** Subscribe to events */
  on(listener: DatabaseSyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Clean up */
  dispose(): void {
    this.cancelDebounce();
    this.pendingChanges = [];
    this.appliedChangeIds.clear();
    this.listeners = [];
    this.broadcastFn = null;
    this.applyFn = null;
  }

  private scheduleFlush(): void {
    this.cancelDebounce();
    this.debounceTimer = setTimeout(() => this.flush(), this.config.debounceMs);
  }

  private cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private emit(event: DatabaseSyncEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
