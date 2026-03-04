/**
 * CollaborationProvider — Manages real-time collaborative editing sessions.
 *
 * Coordinates Yjs documents with TipTap editors and sync transports.
 * Platform-agnostic: the actual Yjs/WebSocket wiring is injected via config.
 *
 * This module does NOT import Yjs directly — it works through abstractions
 * so the core package stays platform-independent.
 */

import type { AwarenessUser, SyncTransport } from './index.js';

/** Collaboration configuration */
export interface CollaborationConfig {
  /** URL of the signaling/sync server */
  serverUrl: string;
  /** Current user info */
  user: AwarenessUser;
  /** Sync transport factory �� creates transport for a given document */
  createTransport: (serverUrl: string, documentId: string) => SyncTransport;
  /** Auto-reconnect on disconnect. Default: true */
  autoReconnect?: boolean;
  /** Reconnect delay in ms. Default: 2000 */
  reconnectDelayMs?: number;
  /** Maximum reconnect attempts. Default: 10 */
  maxReconnectAttempts?: number;
}

/** State of the collaboration provider */
export type CollaborationState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/** State of a single collaborative document */
export interface DocumentState {
  documentId: string;
  connected: boolean;
  users: AwarenessUser[];
  transport: SyncTransport | null;
}

/** Events emitted by the collaboration provider */
export interface CollaborationEvent {
  type:
    | 'connected'
    | 'disconnected'
    | 'reconnecting'
    | 'error'
    | 'user-joined'
    | 'user-left'
    | 'users-changed'
    | 'document-opened'
    | 'document-closed';
  documentId?: string;
  user?: AwarenessUser;
  users?: AwarenessUser[];
  error?: Error;
}

export type CollaborationListener = (event: CollaborationEvent) => void;

const DEFAULT_RECONNECT_DELAY = 2000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

export class CollaborationProvider {
  private config: Required<CollaborationConfig>;
  private _state: CollaborationState = 'disconnected';
  private documents = new Map<string, DocumentState>();
  private listeners: CollaborationListener[] = [];
  private userChangeUnsubscribers = new Map<string, () => void>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: CollaborationConfig) {
    this.config = {
      ...config,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelayMs: config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY,
      maxReconnectAttempts: config.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
    };
  }

  /** Open a collaborative document */
  async openDocument(documentId: string): Promise<DocumentState> {
    if (this.documents.has(documentId)) {
      return this.documents.get(documentId)!;
    }

    const transport = this.config.createTransport(this.config.serverUrl, documentId);

    const docState: DocumentState = {
      documentId,
      connected: false,
      users: [],
      transport,
    };
    this.documents.set(documentId, docState);

    try {
      this._state = 'connecting';
      await transport.connect(documentId);
      docState.connected = true;
      docState.users = transport.getUsers();
      this._state = 'connected';
      this.reconnectAttempts = 0;

      // Subscribe to user changes
      const unsub = transport.onUsersChange((users) => {
        const prevUsers = docState.users;
        docState.users = users;
        this.handleUsersChanged(documentId, prevUsers, users);
      });
      this.userChangeUnsubscribers.set(documentId, unsub);

      this.emit({ type: 'connected', documentId });
      this.emit({ type: 'document-opened', documentId, users: docState.users });
    } catch (e) {
      this._state = 'error';
      this.emit({ type: 'error', documentId, error: e as Error });

      if (this.config.autoReconnect) {
        this.scheduleReconnect(documentId);
      }
    }

    return docState;
  }

  /** Close a collaborative document */
  async closeDocument(documentId: string): Promise<void> {
    const docState = this.documents.get(documentId);
    if (!docState) return;

    // Unsubscribe from user changes
    const unsub = this.userChangeUnsubscribers.get(documentId);
    if (unsub) {
      unsub();
      this.userChangeUnsubscribers.delete(documentId);
    }

    if (docState.transport) {
      await docState.transport.disconnect();
    }

    this.documents.delete(documentId);
    this.emit({ type: 'document-closed', documentId });

    if (this.documents.size === 0) {
      this._state = 'disconnected';
      this.emit({ type: 'disconnected' });
    }
  }

  /** Get the state of a specific document */
  getDocumentState(documentId: string): DocumentState | null {
    return this.documents.get(documentId) ?? null;
  }

  /** Get all open documents */
  getOpenDocuments(): string[] {
    return Array.from(this.documents.keys());
  }

  /** Get all connected users across all documents */
  getAllUsers(): AwarenessUser[] {
    const userMap = new Map<string, AwarenessUser>();
    for (const doc of this.documents.values()) {
      for (const user of doc.users) {
        userMap.set(user.id, user);
      }
    }
    return Array.from(userMap.values());
  }

  /** Get the current user */
  getCurrentUser(): AwarenessUser {
    return this.config.user;
  }

  /** Update the current user info */
  updateUser(updates: Partial<AwarenessUser>): void {
    Object.assign(this.config.user, updates);
  }

  /** Get the provider state */
  getState(): CollaborationState {
    return this._state;
  }

  /** Subscribe to events */
  on(listener: CollaborationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Disconnect all documents and clean up */
  async dispose(): Promise<void> {
    this.cancelReconnect();

    for (const documentId of this.documents.keys()) {
      await this.closeDocument(documentId);
    }

    this.listeners = [];
    this._state = 'disconnected';
  }

  private handleUsersChanged(
    documentId: string,
    prevUsers: AwarenessUser[],
    nextUsers: AwarenessUser[],
  ): void {
    const prevIds = new Set(prevUsers.map((u) => u.id));
    const nextIds = new Set(nextUsers.map((u) => u.id));

    for (const user of nextUsers) {
      if (!prevIds.has(user.id)) {
        this.emit({ type: 'user-joined', documentId, user });
      }
    }

    for (const user of prevUsers) {
      if (!nextIds.has(user.id)) {
        this.emit({ type: 'user-left', documentId, user });
      }
    }

    this.emit({ type: 'users-changed', documentId, users: nextUsers });
  }

  private scheduleReconnect(documentId: string): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this._state = 'error';
      return;
    }

    this._state = 'reconnecting';
    this.reconnectAttempts++;
    this.emit({ type: 'reconnecting', documentId });

    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    this.reconnectTimer = setTimeout(async () => {
      const docState = this.documents.get(documentId);
      if (!docState?.transport) return;

      try {
        await docState.transport.connect(documentId);
        docState.connected = true;
        docState.users = docState.transport.getUsers();
        this._state = 'connected';
        this.reconnectAttempts = 0;
        this.emit({ type: 'connected', documentId });
      } catch {
        this.scheduleReconnect(documentId);
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emit(event: CollaborationEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
