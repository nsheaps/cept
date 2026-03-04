import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from './room-manager.js';
import type { ClientConnection, RoomEvent } from './room-manager.js';
import type { ServerMessage } from './protocol.js';
import type { AwarenessUser } from '@cept/core';

function createMockConnection(id: string): ClientConnection & { messages: ServerMessage[] } {
  const messages: ServerMessage[] = [];
  return {
    id,
    messages,
    send: vi.fn((msg: ServerMessage) => messages.push(msg)),
  };
}

function createUser(id: string, name: string): AwarenessUser {
  return { id, name, color: '#' + id.padStart(6, '0') };
}

describe('RoomManager', () => {
  it('starts with no rooms', () => {
    const manager = new RoomManager();
    expect(manager.getActiveRooms()).toHaveLength(0);
  });

  it('creates a room when first client joins', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    const user = createUser('u1', 'Alice');

    manager.handleMessage(conn, { type: 'join', documentId: 'doc-1', user });

    expect(manager.getActiveRooms()).toEqual(['doc-1']);
    expect(manager.getRoomSize('doc-1')).toBe(1);
  });

  it('sends room-joined to the joining client', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    const user = createUser('u1', 'Alice');

    manager.handleMessage(conn, { type: 'join', documentId: 'doc-1', user });

    expect(conn.messages).toHaveLength(1);
    expect(conn.messages[0].type).toBe('room-joined');
    if (conn.messages[0].type === 'room-joined') {
      expect(conn.messages[0].users).toHaveLength(1);
      expect(conn.messages[0].users[0].name).toBe('Alice');
    }
  });

  it('broadcasts user-joined to existing members', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });

    // conn1 should have received: room-joined + user-joined(Bob)
    expect(conn1.messages).toHaveLength(2);
    expect(conn1.messages[1].type).toBe('user-joined');

    // conn2 should have received: room-joined (with both users)
    expect(conn2.messages).toHaveLength(1);
    expect(conn2.messages[0].type).toBe('room-joined');
    if (conn2.messages[0].type === 'room-joined') {
      expect(conn2.messages[0].users).toHaveLength(2);
    }
  });

  it('returns room users', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });

    const users = manager.getRoomUsers('doc-1');
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.name)).toContain('Alice');
    expect(users.map((u) => u.name)).toContain('Bob');
  });

  it('returns empty for unknown room', () => {
    const manager = new RoomManager();
    expect(manager.getRoomUsers('unknown')).toHaveLength(0);
    expect(manager.getRoomSize('unknown')).toBe(0);
  });

  it('handles leave message', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });
    manager.handleMessage(conn1, { type: 'leave', documentId: 'doc-1' });

    expect(manager.getRoomSize('doc-1')).toBe(1);
    // conn2 received user-left
    const userLeftMsg = conn2.messages.find((m) => m.type === 'user-left');
    expect(userLeftMsg).toBeDefined();
  });

  it('destroys room when last client leaves', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');

    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn, { type: 'leave', documentId: 'doc-1' });

    expect(manager.getActiveRooms()).toHaveLength(0);
  });

  it('handleDisconnect removes client from all rooms', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    const user = createUser('u1', 'Alice');

    manager.handleMessage(conn, { type: 'join', documentId: 'doc-1', user });
    manager.handleMessage(conn, { type: 'join', documentId: 'doc-2', user });

    expect(manager.getClientRooms('c1')).toHaveLength(2);

    manager.handleDisconnect('c1');

    expect(manager.getClientRooms('c1')).toHaveLength(0);
    expect(manager.getActiveRooms()).toHaveLength(0);
  });

  it('broadcasts user-left on disconnect', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });

    manager.handleDisconnect('c1');

    const userLeftMsg = conn2.messages.find((m) => m.type === 'user-left');
    expect(userLeftMsg).toBeDefined();
  });

  it('handles disconnect for unknown connection', () => {
    const manager = new RoomManager();
    // Should not throw
    manager.handleDisconnect('unknown');
    expect(manager.getActiveRooms()).toHaveLength(0);
  });

  it('updates awareness and broadcasts to all', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });

    // Alice updates cursor position
    manager.handleMessage(conn1, {
      type: 'awareness-update',
      documentId: 'doc-1',
      user: { id: 'u1', name: 'Alice', color: '#f00', cursor: { anchor: 10, head: 15 } },
    });

    const awarenessMessages = conn2.messages.filter((m) => m.type === 'awareness');
    expect(awarenessMessages.length).toBeGreaterThan(0);
  });

  it('awareness update for unknown room is a no-op', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    // Should not throw
    manager.handleMessage(conn, {
      type: 'awareness-update',
      documentId: 'unknown',
      user: createUser('u1', 'Alice'),
    });
  });

  it('broadcasts sync to other clients only', () => {
    const manager = new RoomManager();
    const conn1 = createMockConnection('c1');
    const conn2 = createMockConnection('c2');
    const conn3 = createMockConnection('c3');

    manager.handleMessage(conn1, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });
    manager.handleMessage(conn2, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u2', 'Bob'),
    });
    manager.handleMessage(conn3, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u3', 'Carol'),
    });

    const payload = 'base64-encoded-yjs-update';
    manager.handleMessage(conn1, {
      type: 'sync',
      documentId: 'doc-1',
      payload,
    });

    // conn1 (sender) should NOT receive sync-broadcast
    expect(conn1.messages.filter((m) => m.type === 'sync-broadcast')).toHaveLength(0);

    // conn2 and conn3 should receive sync-broadcast
    const conn2Sync = conn2.messages.find((m) => m.type === 'sync-broadcast');
    expect(conn2Sync).toBeDefined();
    if (conn2Sync?.type === 'sync-broadcast') {
      expect(conn2Sync.payload).toBe(payload);
      expect(conn2Sync.senderId).toBe('c1');
    }

    const conn3Sync = conn3.messages.find((m) => m.type === 'sync-broadcast');
    expect(conn3Sync).toBeDefined();
  });

  it('sync to unknown room is a no-op', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    // Should not throw
    manager.handleMessage(conn, {
      type: 'sync',
      documentId: 'unknown',
      payload: 'data',
    });
  });

  it('re-joining room updates user info', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');

    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });

    // Re-join with updated name
    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: { id: 'u1', name: 'Alice (updated)', color: '#f00' },
    });

    // Should still be 1 client, not 2
    expect(manager.getRoomSize('doc-1')).toBe(1);
    const users = manager.getRoomUsers('doc-1');
    expect(users[0].name).toBe('Alice (updated)');
  });

  it('emits room lifecycle events', () => {
    const manager = new RoomManager();
    const events: RoomEvent[] = [];
    manager.on((e) => events.push(e));

    const conn = createMockConnection('c1');
    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });

    expect(events.some((e) => e.type === 'room-created')).toBe(true);
    expect(events.some((e) => e.type === 'client-joined')).toBe(true);

    manager.handleMessage(conn, { type: 'leave', documentId: 'doc-1' });

    expect(events.some((e) => e.type === 'client-left')).toBe(true);
    expect(events.some((e) => e.type === 'room-destroyed')).toBe(true);
  });

  it('unsubscribes from events', () => {
    const manager = new RoomManager();
    const events: RoomEvent[] = [];
    const unsub = manager.on((e) => events.push(e));

    unsub();
    const conn = createMockConnection('c1');
    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });

    expect(events).toHaveLength(0);
  });

  it('dispose clears all state', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    manager.handleMessage(conn, {
      type: 'join',
      documentId: 'doc-1',
      user: createUser('u1', 'Alice'),
    });

    manager.dispose();

    expect(manager.getActiveRooms()).toHaveLength(0);
    expect(manager.getClientRooms('c1')).toHaveLength(0);
  });

  it('clients can join multiple rooms', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    const user = createUser('u1', 'Alice');

    manager.handleMessage(conn, { type: 'join', documentId: 'doc-1', user });
    manager.handleMessage(conn, { type: 'join', documentId: 'doc-2', user });

    expect(manager.getClientRooms('c1')).toEqual(['doc-1', 'doc-2']);
    expect(manager.getActiveRooms()).toHaveLength(2);
  });

  it('leave from non-existent room is a no-op', () => {
    const manager = new RoomManager();
    const conn = createMockConnection('c1');
    // Should not throw
    manager.handleMessage(conn, { type: 'leave', documentId: 'unknown' });
  });
});
