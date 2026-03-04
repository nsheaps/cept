/**
 * OfflineQueue — Buffers operations while offline and replays them on reconnect.
 *
 * When the network connection drops, operations are queued in memory
 * (and optionally persisted). On reconnect, queued operations are
 * replayed in order through the provided send function.
 *
 * Works with any serializable operation type via generics.
 */

export type ConnectionState = 'online' | 'offline' | 'reconnecting';

export interface OfflineQueueConfig {
  /** Maximum queue size. Operations are dropped (oldest first) when exceeded. Default: 1000 */
  maxQueueSize?: number;
  /** Batch size for replay. Default: 10 */
  replayBatchSize?: number;
  /** Delay between replay batches in ms. Default: 100 */
  replayDelayMs?: number;
}

export type OfflineQueueEventType =
  | 'queued'
  | 'online'
  | 'offline'
  | 'replay-start'
  | 'replay-batch'
  | 'replay-complete'
  | 'replay-error'
  | 'queue-overflow';

export interface OfflineQueueEvent<T = unknown> {
  type: OfflineQueueEventType;
  queueSize?: number;
  operation?: T;
  batchSize?: number;
  droppedCount?: number;
  error?: Error;
}

export type OfflineQueueListener<T = unknown> = (event: OfflineQueueEvent<T>) => void;

/** Function that sends an operation to the server. Throws on failure. */
export type SendFn<T> = (operation: T) => Promise<void>;

const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_REPLAY_BATCH_SIZE = 10;
const DEFAULT_REPLAY_DELAY_MS = 100;

export class OfflineQueue<T> {
  private config: Required<OfflineQueueConfig>;
  private queue: T[] = [];
  private _state: ConnectionState = 'online';
  private listeners: OfflineQueueListener<T>[] = [];
  private sendFn: SendFn<T> | null = null;
  private replaying = false;
  private replayTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: OfflineQueueConfig) {
    this.config = {
      maxQueueSize: config?.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      replayBatchSize: config?.replayBatchSize ?? DEFAULT_REPLAY_BATCH_SIZE,
      replayDelayMs: config?.replayDelayMs ?? DEFAULT_REPLAY_DELAY_MS,
    };
  }

  /** Set the send function used during replay */
  setSendFn(fn: SendFn<T>): void {
    this.sendFn = fn;
  }

  /** Enqueue an operation. If online and send function set, sends immediately. */
  async enqueue(operation: T): Promise<boolean> {
    if (this._state === 'online' && this.sendFn && !this.replaying) {
      try {
        await this.sendFn(operation);
        return true;
      } catch {
        // Failed to send — go offline and queue
        this.goOffline();
      }
    }

    this.addToQueue(operation);
    return false;
  }

  /** Signal that the connection is back online and start replay */
  async goOnline(): Promise<void> {
    if (this._state === 'online' && !this.hasQueued()) return;

    this._state = 'online';
    this.emit({ type: 'online', queueSize: this.queue.length });

    if (this.queue.length > 0 && this.sendFn) {
      await this.replay();
    }
  }

  /** Signal that the connection is offline */
  goOffline(): void {
    if (this._state === 'offline') return;

    this._state = 'offline';
    this.cancelReplay();
    this.emit({ type: 'offline', queueSize: this.queue.length });
  }

  /** Get the current connection state */
  getState(): ConnectionState {
    return this._state;
  }

  /** Get the number of queued operations */
  getQueueSize(): number {
    return this.queue.length;
  }

  /** Check if there are queued operations */
  hasQueued(): boolean {
    return this.queue.length > 0;
  }

  /** Get a copy of the current queue */
  getQueue(): ReadonlyArray<T> {
    return [...this.queue];
  }

  /** Clear the queue */
  clearQueue(): void {
    this.queue = [];
  }

  /** Check if currently replaying */
  isReplaying(): boolean {
    return this.replaying;
  }

  /** Subscribe to events */
  on(listener: OfflineQueueListener<T>): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Clean up */
  dispose(): void {
    this.cancelReplay();
    this.queue = [];
    this.listeners = [];
    this.sendFn = null;
  }

  private isOffline(): boolean {
    return this._state === 'offline';
  }

  private addToQueue(operation: T): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      const dropped = this.queue.shift();
      this.emit({ type: 'queue-overflow', operation: dropped, droppedCount: 1 });
    }
    this.queue.push(operation);
    this.emit({ type: 'queued', operation, queueSize: this.queue.length });
  }

  private async replay(): Promise<void> {
    if (this.replaying || !this.sendFn) return;

    this.replaying = true;
    this._state = 'reconnecting';
    this.emit({ type: 'replay-start', queueSize: this.queue.length });

    try {
      while (this.queue.length > 0 && !this.isOffline()) {
        const batch = this.queue.splice(0, this.config.replayBatchSize);

        for (const operation of batch) {
          await this.sendFn!(operation);
        }

        this.emit({ type: 'replay-batch', batchSize: batch.length, queueSize: this.queue.length });

        if (this.queue.length > 0 && this.config.replayDelayMs > 0) {
          await this.delay(this.config.replayDelayMs);
        }
      }

      if (!this.isOffline()) {
        this._state = 'online';
        this.emit({ type: 'replay-complete', queueSize: 0 });
      }
    } catch (e) {
      this.emit({ type: 'replay-error', error: e as Error, queueSize: this.queue.length });
      this._state = 'offline';
    } finally {
      this.replaying = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.replayTimer = setTimeout(resolve, ms);
    });
  }

  private cancelReplay(): void {
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
      this.replayTimer = null;
    }
  }

  private emit(event: OfflineQueueEvent<T>): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
