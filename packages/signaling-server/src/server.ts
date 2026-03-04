/**
 * Signaling server entry point — Bun.serve() WebSocket listener
 * wired to the existing RoomManager.
 *
 * Usage:
 *   bun run packages/signaling-server/src/server.ts
 *   PORT=4000 bun run packages/signaling-server/src/server.ts
 */

import { RoomManager } from './room-manager.js';
import type { ClientConnection } from './room-manager.js';
import type { ClientMessage, ServerMessage } from './protocol.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

const roomManager = new RoomManager();

/** Track WebSocket → connection ID mapping */
let nextId = 1;
const wsConnections = new WeakMap<object, string>();

function getConnectionId(ws: object): string {
  let id = wsConnections.get(ws);
  if (!id) {
    id = `conn-${nextId++}`;
    wsConnections.set(ws, id);
  }
  return id;
}

const server = Bun.serve({
  port: PORT,

  fetch(req, server) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        rooms: roomManager.getActiveRooms().length,
      }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Upgrade WebSocket connections on /ws path
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    return new Response('Cept Signaling Server', { status: 200 });
  },

  websocket: {
    open(ws) {
      const connId = getConnectionId(ws);
      console.log(`[signaling] Client connected: ${connId}`);
    },

    message(ws, message) {
      const connId = getConnectionId(ws);

      const connection: ClientConnection = {
        id: connId,
        send(msg: ServerMessage) {
          ws.send(JSON.stringify(msg));
        },
      };

      try {
        const parsed = JSON.parse(
          typeof message === 'string' ? message : new TextDecoder().decode(message),
        ) as ClientMessage;

        roomManager.handleMessage(connection, parsed);
      } catch {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    },

    close(ws) {
      const connId = getConnectionId(ws);
      console.log(`[signaling] Client disconnected: ${connId}`);
      roomManager.handleDisconnect(connId);
    },
  },
});

console.log(`[signaling] Cept signaling server listening on http://localhost:${server.port}`);

export { server };
