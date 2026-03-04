/**
 * @cept/signaling — Yjs WebSocket signaling server
 *
 * Manages collaboration rooms for real-time document editing.
 * Clients connect via WebSocket and join document rooms to
 * exchange sync updates and awareness (presence) information.
 */

export { RoomManager } from './room-manager.js';
export type {
  ClientConnection,
  RoomEvent,
  RoomEventType,
  RoomListener,
} from './room-manager.js';

export type {
  ClientMessage,
  ServerMessage,
  JoinMessage,
  LeaveMessage,
  AwarenessUpdateMessage,
  SyncMessage,
  RoomJoinedMessage,
  UserJoinedMessage,
  UserLeftMessage,
  AwarenessMessage,
  SyncBroadcastMessage,
  ErrorMessage,
} from './protocol.js';

