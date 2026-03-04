/**
 * RoomManager — Manages document collaboration rooms.
 *
 * Each room corresponds to a document being collaboratively edited.
 * The manager tracks which clients are in each room, their awareness
 * state, and routes messages between room members.
 *
 * This class is transport-agnostic: it works with abstract ClientConnection
 * objects rather than raw WebSocket instances, making it easy to test.
 */

import type { AwarenessUser } from '@cept/core';
import type {
  ClientMessage,
  ServerMessage,
} from './protocol.js';

/** Abstract connection — could be a WebSocket, test mock, etc. */
export interface ClientConnection {
  readonly id: string;
  send(message: ServerMessage): void;
}

/** A room for a single document */
interface Room {
  documentId: string;
  clients: Map<string, { connection: ClientConnection; user: AwarenessUser }>;
}

export type RoomEventType =
  | 'room-created'
  | 'room-destroyed'
  | 'client-joined'
  | 'client-left';

export interface RoomEvent {
  type: RoomEventType;
  documentId: string;
  clientId?: string;
  user?: AwarenessUser;
}

export type RoomListener = (event: RoomEvent) => void;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private clientRooms = new Map<string, Set<string>>();
  private listeners: RoomListener[] = [];

  /** Handle an incoming message from a client */
  handleMessage(connection: ClientConnection, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        this.joinRoom(connection, message.documentId, message.user);
        break;
      case 'leave':
        this.leaveRoom(connection.id, message.documentId);
        break;
      case 'awareness-update':
        this.updateAwareness(connection.id, message.documentId, message.user);
        break;
      case 'sync':
        this.broadcastSync(connection.id, message.documentId, message.payload);
        break;
    }
  }

  /** Handle a client disconnecting (leaves all rooms) */
  handleDisconnect(connectionId: string): void {
    const rooms = this.clientRooms.get(connectionId);
    if (!rooms) return;

    for (const documentId of Array.from(rooms)) {
      this.leaveRoom(connectionId, documentId);
    }
    this.clientRooms.delete(connectionId);
  }

  /** Get the list of users in a room */
  getRoomUsers(documentId: string): AwarenessUser[] {
    const room = this.rooms.get(documentId);
    if (!room) return [];
    return Array.from(room.clients.values()).map((c) => c.user);
  }

  /** Get all active room IDs */
  getActiveRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /** Get the number of clients in a room */
  getRoomSize(documentId: string): number {
    return this.rooms.get(documentId)?.clients.size ?? 0;
  }

  /** Get all rooms a client is in */
  getClientRooms(connectionId: string): string[] {
    const rooms = this.clientRooms.get(connectionId);
    return rooms ? Array.from(rooms) : [];
  }

  /** Subscribe to room events */
  on(listener: RoomListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Dispose and clear all state */
  dispose(): void {
    this.rooms.clear();
    this.clientRooms.clear();
    this.listeners = [];
  }

  private joinRoom(
    connection: ClientConnection,
    documentId: string,
    user: AwarenessUser,
  ): void {
    let room = this.rooms.get(documentId);
    if (!room) {
      room = { documentId, clients: new Map() };
      this.rooms.set(documentId, room);
      this.emit({ type: 'room-created', documentId });
    }

    // Already in room? Update user info
    if (room.clients.has(connection.id)) {
      room.clients.get(connection.id)!.user = user;
      this.broadcastAwareness(documentId);
      return;
    }

    room.clients.set(connection.id, { connection, user });

    // Track which rooms this client is in
    let clientRoomSet = this.clientRooms.get(connection.id);
    if (!clientRoomSet) {
      clientRoomSet = new Set();
      this.clientRooms.set(connection.id, clientRoomSet);
    }
    clientRoomSet.add(documentId);

    // Send room-joined to the new client with current users
    connection.send({
      type: 'room-joined',
      documentId,
      users: this.getRoomUsers(documentId),
    });

    // Broadcast user-joined to others
    for (const [clientId, client] of room.clients) {
      if (clientId !== connection.id) {
        client.connection.send({
          type: 'user-joined',
          documentId,
          user,
        });
      }
    }

    this.emit({ type: 'client-joined', documentId, clientId: connection.id, user });
  }

  private leaveRoom(connectionId: string, documentId: string): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const entry = room.clients.get(connectionId);
    if (!entry) return;

    room.clients.delete(connectionId);

    // Update client room tracking
    const clientRoomSet = this.clientRooms.get(connectionId);
    if (clientRoomSet) {
      clientRoomSet.delete(documentId);
      if (clientRoomSet.size === 0) {
        this.clientRooms.delete(connectionId);
      }
    }

    // Broadcast user-left to remaining clients
    for (const client of room.clients.values()) {
      client.connection.send({
        type: 'user-left',
        documentId,
        user: entry.user,
      });
    }

    this.emit({ type: 'client-left', documentId, clientId: connectionId, user: entry.user });

    // Clean up empty rooms
    if (room.clients.size === 0) {
      this.rooms.delete(documentId);
      this.emit({ type: 'room-destroyed', documentId });
    }
  }

  private updateAwareness(
    connectionId: string,
    documentId: string,
    user: AwarenessUser,
  ): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const entry = room.clients.get(connectionId);
    if (!entry) return;

    entry.user = user;
    this.broadcastAwareness(documentId);
  }

  private broadcastAwareness(documentId: string): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const users = this.getRoomUsers(documentId);
    for (const client of room.clients.values()) {
      client.connection.send({
        type: 'awareness',
        documentId,
        users,
      });
    }
  }

  private broadcastSync(
    senderId: string,
    documentId: string,
    payload: string,
  ): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    for (const [clientId, client] of room.clients) {
      if (clientId !== senderId) {
        client.connection.send({
          type: 'sync-broadcast',
          documentId,
          payload,
          senderId,
        });
      }
    }
  }

  private emit(event: RoomEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
