import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MobileAuthAdapter,
  generateState,
  parseCallbackUrl,
} from './mobile-auth.js';
import type { DeepLinkHandler, CodeExchangeFn, MobileAuthEvent } from './mobile-auth.js';

function createMockDeepLinkHandler(): DeepLinkHandler & {
  _triggerDeepLink: (url: string) => void;
} {
  const callbacks: Array<(url: string) => void> = [];
  return {
    openUrl: vi.fn(async () => {}),
    onDeepLink: vi.fn((cb: (url: string) => void) => {
      callbacks.push(cb);
      return () => {
        const idx = callbacks.indexOf(cb);
        if (idx >= 0) callbacks.splice(idx, 1);
      };
    }),
    _triggerDeepLink(url: string) {
      for (const cb of callbacks) cb(url);
    },
  };
}

describe('generateState', () => {
  it('returns a 64-character hex string', () => {
    const state = generateState();
    expect(state.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(state)).toBe(true);
  });

  it('generates unique values', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe('parseCallbackUrl', () => {
  it('extracts code and state from callback URL', () => {
    const result = parseCallbackUrl('cept://oauth/callback?code=abc123&state=xyz');
    expect(result).toBeDefined();
    expect(result!.code).toBe('abc123');
    expect(result!.state).toBe('xyz');
  });

  it('returns null when code is missing', () => {
    const result = parseCallbackUrl('cept://oauth/callback?state=xyz');
    expect(result).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    const result = parseCallbackUrl('not a url');
    expect(result).toBeNull();
  });

  it('handles callback without state', () => {
    const result = parseCallbackUrl('cept://oauth/callback?code=abc123');
    expect(result).toBeDefined();
    expect(result!.code).toBe('abc123');
    expect(result!.state).toBeUndefined();
  });
});

describe('MobileAuthAdapter', () => {
  let handler: ReturnType<typeof createMockDeepLinkHandler>;
  let exchangeCode: ReturnType<typeof vi.fn<CodeExchangeFn>>;
  let adapter: MobileAuthAdapter;

  beforeEach(() => {
    handler = createMockDeepLinkHandler();
    exchangeCode = vi.fn<CodeExchangeFn>(async () => ({ accessToken: 'token-123' }));
    adapter = new MobileAuthAdapter(handler, exchangeCode);
  });

  const config = {
    authorizationUrl: 'https://github.com/login/oauth/authorize?client_id=test',
    redirectUri: 'cept://oauth/callback',
    timeoutMs: 5000,
  };

  it('starts in idle state', () => {
    expect(adapter.getState()).toBe('idle');
  });

  it('opens authorization URL in native browser', async () => {
    const promise = adapter.authorize(config);

    // Simulate the callback
    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const url = new URL(openCall);
    const state = url.searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=test-code&state=${state}`);

    await promise;
    expect(handler.openUrl).toHaveBeenCalled();
    expect(openCall).toContain('github.com/login/oauth/authorize');
  });

  it('adds state and redirect_uri to authorization URL', async () => {
    const promise = adapter.authorize(config);

    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const url = new URL(openCall);
    expect(url.searchParams.get('state')).toBeDefined();
    expect(url.searchParams.get('redirect_uri')).toBe('cept://oauth/callback');

    const state = url.searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=c&state=${state}`);
    await promise;
  });

  it('exchanges code for token on callback', async () => {
    const promise = adapter.authorize(config);

    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const state = new URL(openCall).searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=my-code&state=${state}`);

    const result = await promise;
    expect(exchangeCode).toHaveBeenCalledWith('my-code', state);
    expect(result.accessToken).toBe('token-123');
  });

  it('transitions through states correctly', async () => {
    const events: MobileAuthEvent[] = [];
    adapter.on((e) => events.push(e));

    const promise = adapter.authorize(config);

    expect(adapter.getState()).toBe('authorizing');

    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const state = new URL(openCall).searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=c&state=${state}`);

    await promise;

    const states = events.map((e) => e.state);
    expect(states).toContain('authorizing');
    expect(states).toContain('exchanging');
    expect(states).toContain('authenticated');
  });

  it('rejects on state mismatch (CSRF protection)', async () => {
    const promise = adapter.authorize(config);

    // Send callback with wrong state
    handler._triggerDeepLink('cept://oauth/callback?code=c&state=wrong-state');

    await expect(promise).rejects.toThrow('state mismatch');
    expect(adapter.getState()).toBe('error');
  });

  it('rejects on timeout', async () => {
    vi.useFakeTimers();
    const promise = adapter.authorize({ ...config, timeoutMs: 100 });
    // Attach catch handler before advancing timers to prevent unhandled rejection
    const caught = promise.catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(150);
    const error = await caught;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('timed out');
    expect(adapter.getState()).toBe('error');
    adapter.dispose();
    vi.useRealTimers();
  });

  it('rejects on code exchange failure', async () => {
    exchangeCode.mockRejectedValueOnce(new Error('exchange failed'));
    const promise = adapter.authorize(config);

    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const state = new URL(openCall).searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=c&state=${state}`);

    await expect(promise).rejects.toThrow('exchange failed');
    expect(adapter.getState()).toBe('error');
  });

  it('rejects if openUrl fails', async () => {
    (handler.openUrl as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('cannot open browser'),
    );
    await expect(adapter.authorize(config)).rejects.toThrow('cannot open browser');
    expect(adapter.getState()).toBe('error');
  });

  it('prevents concurrent authorization', async () => {
    const promise = adapter.authorize(config);

    await expect(adapter.authorize(config)).rejects.toThrow('already in progress');

    // Clean up
    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const state = new URL(openCall).searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=c&state=${state}`);
    await promise;
  });

  it('cancel resets to idle', () => {
    // Catch the unhandled promise to prevent unhandled rejection
    adapter.authorize(config).catch(() => {});
    expect(adapter.getState()).toBe('authorizing');

    adapter.cancel();
    adapter.dispose(); // Clean up the timeout
    expect(adapter.getState()).toBe('idle');
  });

  it('unsubscribe stops event delivery', async () => {
    const events: MobileAuthEvent[] = [];
    const unsub = adapter.on((e) => events.push(e));
    unsub();

    const promise = adapter.authorize(config);
    const openCall = (handler.openUrl as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const state = new URL(openCall).searchParams.get('state');
    handler._triggerDeepLink(`cept://oauth/callback?code=c&state=${state}`);
    await promise;

    expect(events.length).toBe(0);
  });

  it('dispose cleans up all resources', () => {
    adapter.dispose();
    expect(adapter.getState()).toBe('idle');
  });
});
