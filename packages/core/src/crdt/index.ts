/**
 * CRDT interface for real-time collaborative editing.
 *
 * Only active when using GitBackend with a remote + signaling server.
 * Uses Yjs for conflict-free collaborative editing.
 */

/** User awareness state */
export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    anchor: number;
    head: number;
  };
}

/** Sync transport interface (WebSocket, WebRTC, etc.) */
export interface SyncTransport {
  readonly connected: boolean;

  /** Connect to the signaling server for a specific document */
  connect(documentId: string): Promise<void>;

  /** Disconnect from the signaling server */
  disconnect(): Promise<void>;

  /** Get currently connected users */
  getUsers(): AwarenessUser[];

  /** Subscribe to user presence changes */
  onUsersChange(callback: (users: AwarenessUser[]) => void): () => void;
}

export {
  CollaborationProvider,
} from './collaboration-provider.js';
export type {
  CollaborationConfig,
  CollaborationState,
  CollaborationEvent,
  CollaborationListener,
  DocumentState,
} from './collaboration-provider.js';

export {
  DatabaseSyncAdapter,
  generateChangeId,
} from './database-sync.js';
export type {
  DatabaseChange,
  ApplyChangeCallback,
  DatabaseSyncConfig,
  DatabaseSyncEvent,
  DatabaseSyncEventType,
  DatabaseSyncListener,
  BroadcastFn,
} from './database-sync.js';

export { OfflineQueue } from './offline-queue.js';
export type {
  ConnectionState,
  OfflineQueueConfig,
  OfflineQueueEvent,
  OfflineQueueEventType,
  OfflineQueueListener,
  SendFn,
} from './offline-queue.js';
