/**
 * Signaling protocol — message types exchanged between clients and the
 * signaling server over WebSocket.
 *
 * The server acts as a thin relay: it routes messages between clients
 * that have joined the same document room. It also manages awareness
 * (presence) state so new joiners can see who's online.
 */

import type { AwarenessUser } from '@cept/core';

/** Client → Server messages */
export type ClientMessage =
  | JoinMessage
  | LeaveMessage
  | AwarenessUpdateMessage
  | SyncMessage;

export interface JoinMessage {
  type: 'join';
  documentId: string;
  user: AwarenessUser;
}

export interface LeaveMessage {
  type: 'leave';
  documentId: string;
}

export interface AwarenessUpdateMessage {
  type: 'awareness-update';
  documentId: string;
  user: AwarenessUser;
}

export interface SyncMessage {
  type: 'sync';
  documentId: string;
  /** Opaque binary payload (Yjs update, etc.) encoded as base64 */
  payload: string;
}

/** Server �� Client messages */
export type ServerMessage =
  | RoomJoinedMessage
  | UserJoinedMessage
  | UserLeftMessage
  | AwarenessMessage
  | SyncBroadcastMessage
  | ErrorMessage;

export interface RoomJoinedMessage {
  type: 'room-joined';
  documentId: string;
  users: AwarenessUser[];
}

export interface UserJoinedMessage {
  type: 'user-joined';
  documentId: string;
  user: AwarenessUser;
}

export interface UserLeftMessage {
  type: 'user-left';
  documentId: string;
  user: AwarenessUser;
}

export interface AwarenessMessage {
  type: 'awareness';
  documentId: string;
  users: AwarenessUser[];
}

export interface SyncBroadcastMessage {
  type: 'sync-broadcast';
  documentId: string;
  payload: string;
  senderId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}
