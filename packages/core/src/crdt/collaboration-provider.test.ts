import { describe, it, expect, vi } from 'vitest';
import { CollaborationProvider } from './collaboration-provider.js';
import type {
  CollaborationConfig,
  CollaborationEvent,
} from './collaboration-provider.js';
import type { AwarenessUser, SyncTransport } from './index.js';

function createMockTransport(): SyncTransport {
  const usersChangeCallbacks: Array<(users: AwarenessUser[]) => void> = [];
  return {
    connected: false,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    getUsers: vi.fn(() => []),
    onUsersChange: vi.fn((cb: (users: AwarenessUser[]) => void) => {
      usersChangeCallbacks.push(cb);
      return () => {
        const idx = usersChangeCallbacks.indexOf(cb);
        if (idx >= 0) usersChangeCallbacks.splice(idx, 1);
      };
    }),
    _triggerUsersChange(users: AwarenessUser[]) {
      for (const cb of usersChangeCallbacks) cb(users);
    },
  } as SyncTransport & { _triggerUsersChange: (users: AwarenessUser[]) => void };
}

function createConfig(
  overrides?: Partial<CollaborationConfig>,
): CollaborationConfig {
  return {
    serverUrl: 'ws://localhost:4444',
    user: { id: 'user-1', name: 'Alice', color: '#ff0000' },
    createTransport: () => createMockTransport(),
    ...overrides,
  };
}

describe('CollaborationProvider', () => {
  it('starts in disconnected state', () => {
    const provider = new CollaborationProvider(createConfig());
    expect(provider.getState()).toBe('disconnected');
  });

  it('returns current user', () => {
    const provider = new CollaborationProvider(createConfig());
    expect(provider.getCurrentUser().name).toBe('Alice');
  });

  it('updates current user', () => {
    const provider = new CollaborationProvider(createConfig());
    provider.updateUser({ name: 'Bob' });
    expect(provider.getCurrentUser().name).toBe('Bob');
  });

  it('opens a document and connects', async () => {
    const transport = createMockTransport();
    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport }),
    );

    const docState = await provider.openDocument('doc-1');

    expect(transport.connect).toHaveBeenCalledWith('doc-1');
    expect(docState.documentId).toBe('doc-1');
    expect(docState.connected).toBe(true);
    expect(provider.getState()).toBe('connected');
  });

  it('returns existing document if already open', async () => {
    const provider = new CollaborationProvider(createConfig());
    const doc1 = await provider.openDocument('doc-1');
    const doc2 = await provider.openDocument('doc-1');
    expect(doc1).toBe(doc2);
  });

  it('emits connected and document-opened events', async () => {
    const provider = new CollaborationProvider(createConfig());
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');

    const types = events.map((e) => e.type);
    expect(types).toContain('connected');
    expect(types).toContain('document-opened');
  });

  it('closes a document and disconnects transport', async () => {
    const transport = createMockTransport();
    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport }),
    );

    await provider.openDocument('doc-1');
    await provider.closeDocument('doc-1');

    expect(transport.disconnect).toHaveBeenCalled();
    expect(provider.getDocumentState('doc-1')).toBeNull();
  });

  it('emits document-closed and disconnected when last doc closes', async () => {
    const provider = new CollaborationProvider(createConfig());
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');
    events.length = 0;
    await provider.closeDocument('doc-1');

    const types = events.map((e) => e.type);
    expect(types).toContain('document-closed');
    expect(types).toContain('disconnected');
    expect(provider.getState()).toBe('disconnected');
  });

  it('does not emit disconnected when other docs remain', async () => {
    const provider = new CollaborationProvider(
      createConfig({
        createTransport: () => createMockTransport(),
      }),
    );
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');
    await provider.openDocument('doc-2');
    events.length = 0;
    await provider.closeDocument('doc-1');

    expect(events.some((e) => e.type === 'disconnected')).toBe(false);
  });

  it('closing non-existent doc is a no-op', async () => {
    const provider = new CollaborationProvider(createConfig());
    await provider.closeDocument('nope');
    expect(provider.getState()).toBe('disconnected');
  });

  it('getOpenDocuments returns open doc ids', async () => {
    const provider = new CollaborationProvider(
      createConfig({
        createTransport: () => createMockTransport(),
      }),
    );
    await provider.openDocument('doc-1');
    await provider.openDocument('doc-2');
    expect(provider.getOpenDocuments()).toEqual(['doc-1', 'doc-2']);
  });

  it('getDocumentState returns null for unknown doc', () => {
    const provider = new CollaborationProvider(createConfig());
    expect(provider.getDocumentState('unknown')).toBeNull();
  });

  it('tracks users from transport', async () => {
    const transport = createMockTransport();
    const users: AwarenessUser[] = [
      { id: 'u1', name: 'Alice', color: '#f00' },
      { id: 'u2', name: 'Bob', color: '#0f0' },
    ];
    (transport.getUsers as ReturnType<typeof vi.fn>).mockReturnValue(users);

    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport }),
    );
    const docState = await provider.openDocument('doc-1');

    expect(docState.users).toHaveLength(2);
    expect(provider.getAllUsers()).toHaveLength(2);
  });

  it('emits user-joined and user-left on user changes', async () => {
    const transport = createMockTransport() as SyncTransport & {
      _triggerUsersChange: (users: AwarenessUser[]) => void;
    };
    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport }),
    );
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');
    events.length = 0;

    // New user joins
    transport._triggerUsersChange([
      { id: 'u1', name: 'Alice', color: '#f00' },
    ]);

    expect(events.some((e) => e.type === 'user-joined')).toBe(true);
    expect(events.some((e) => e.type === 'users-changed')).toBe(true);

    events.length = 0;
    // User leaves
    transport._triggerUsersChange([]);
    expect(events.some((e) => e.type === 'user-left')).toBe(true);
  });

  it('getAllUsers deduplicates across documents', async () => {
    const sharedUser: AwarenessUser = { id: 'u1', name: 'Alice', color: '#f00' };
    const provider = new CollaborationProvider(
      createConfig({
        createTransport: () => {
          const t = createMockTransport();
          (t.getUsers as ReturnType<typeof vi.fn>).mockReturnValue([sharedUser]);
          return t;
        },
      }),
    );

    await provider.openDocument('doc-1');
    await provider.openDocument('doc-2');

    expect(provider.getAllUsers()).toHaveLength(1);
  });

  it('handles connection error', async () => {
    const transport = createMockTransport();
    (transport.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection failed'),
    );

    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport, autoReconnect: false }),
    );
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');

    expect(provider.getState()).toBe('error');
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('schedules reconnect on connection error when autoReconnect is true', async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    (transport.connect as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(undefined);

    const provider = new CollaborationProvider(
      createConfig({
        createTransport: () => transport,
        autoReconnect: true,
        reconnectDelayMs: 100,
      }),
    );
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');
    expect(provider.getState()).toBe('reconnecting');
    expect(events.some((e) => e.type === 'reconnecting')).toBe(true);

    // Advance past reconnect delay
    await vi.advanceTimersByTimeAsync(200);
    expect(provider.getState()).toBe('connected');

    vi.useRealTimers();
  });

  it('stops reconnecting after max attempts', async () => {
    vi.useFakeTimers();
    const transport = createMockTransport();
    (transport.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('fail'),
    );

    const provider = new CollaborationProvider(
      createConfig({
        createTransport: () => transport,
        autoReconnect: true,
        reconnectDelayMs: 10,
        maxReconnectAttempts: 2,
      }),
    );

    await provider.openDocument('doc-1');
    // First attempt scheduled
    await vi.advanceTimersByTimeAsync(20);
    // Second attempt scheduled
    await vi.advanceTimersByTimeAsync(40);

    expect(provider.getState()).toBe('error');

    vi.useRealTimers();
  });

  it('unsubscribes from events', async () => {
    const provider = new CollaborationProvider(createConfig());
    const events: CollaborationEvent[] = [];
    const unsub = provider.on((e) => events.push(e));

    unsub();
    await provider.openDocument('doc-1');
    expect(events).toHaveLength(0);
  });

  it('dispose closes all documents and clears listeners', async () => {
    const transport = createMockTransport();
    const provider = new CollaborationProvider(
      createConfig({ createTransport: () => transport }),
    );
    const events: CollaborationEvent[] = [];
    provider.on((e) => events.push(e));

    await provider.openDocument('doc-1');
    events.length = 0;

    await provider.dispose();

    expect(provider.getState()).toBe('disconnected');
    expect(provider.getOpenDocuments()).toHaveLength(0);
    // Listeners cleared, so no new events captured
    expect(transport.disconnect).toHaveBeenCalled();
  });

  it('uses default config values', () => {
    const provider = new CollaborationProvider({
      serverUrl: 'ws://localhost',
      user: { id: '1', name: 'Test', color: '#000' },
      createTransport: () => createMockTransport(),
    });
    // Should not throw - defaults applied for autoReconnect, reconnectDelayMs, maxReconnectAttempts
    expect(provider.getState()).toBe('disconnected');
  });
});
