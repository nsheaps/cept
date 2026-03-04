/**
 * MobileAuthAdapter — Native OAuth flow adapter for mobile platforms.
 *
 * On mobile, OAuth uses an in-app browser (ASWebAuthenticationSession on iOS,
 * Custom Tabs on Android) that can capture redirect URIs back to the app.
 *
 * This adapter orchestrates the flow:
 * 1. Open the authorization URL in the native browser
 * 2. Capture the redirect with the authorization code
 * 3. Exchange the code for a token
 *
 * It wraps any AuthProvider that supports code exchange (like GitHubAuthProvider)
 * and adds mobile-specific browser and deep link handling.
 */

export interface DeepLinkHandler {
  /** Open a URL in the native in-app browser */
  openUrl(url: string): Promise<void>;
  /** Register a listener for deep link callbacks. Returns unsubscribe. */
  onDeepLink(callback: (url: string) => void): () => void;
}

export interface MobileAuthConfig {
  /** OAuth authorization URL (full URL with client_id, scope, etc.) */
  authorizationUrl: string;
  /** The redirect URI registered with the OAuth app (e.g., cept://oauth/callback) */
  redirectUri: string;
  /** Maximum time to wait for the OAuth callback in ms. Default: 300000 (5 min) */
  timeoutMs?: number;
}

export interface CodeExchangeFn {
  /** Exchange an authorization code for a token */
  (code: string, state?: string): Promise<{ accessToken: string }>;
}

export type MobileAuthState = 'idle' | 'authorizing' | 'exchanging' | 'authenticated' | 'error';

export interface MobileAuthEvent {
  type: 'state-change' | 'error' | 'authenticated';
  state: MobileAuthState;
  error?: Error;
}

export type MobileAuthListener = (event: MobileAuthEvent) => void;

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Generate a random state parameter for CSRF protection.
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse an OAuth callback URL to extract code and state parameters.
 */
export function parseCallbackUrl(url: string): { code: string; state?: string } | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    if (!code) return null;
    const state = parsed.searchParams.get('state') ?? undefined;
    return { code, state };
  } catch {
    return null;
  }
}

export class MobileAuthAdapter {
  private _state: MobileAuthState = 'idle';
  private listeners: MobileAuthListener[] = [];
  private pendingState: string | null = null;
  private deepLinkUnsub: (() => void) | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private deepLinkHandler: DeepLinkHandler,
    private exchangeCode: CodeExchangeFn,
  ) {}

  /** Get current auth state */
  getState(): MobileAuthState {
    return this._state;
  }

  /**
   * Start the OAuth flow.
   * Opens the authorization URL in the native browser and waits for the callback.
   */
  async authorize(config: MobileAuthConfig): Promise<{ accessToken: string }> {
    if (this._state === 'authorizing' || this._state === 'exchanging') {
      throw new Error('Authorization already in progress');
    }

    const state = generateState();
    this.pendingState = state;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Build the full authorization URL with state
    const url = new URL(config.authorizationUrl);
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', config.redirectUri);

    this.setState('authorizing');

    return new Promise<{ accessToken: string }>((resolve, reject) => {
      // Set up timeout
      this.timeoutTimer = setTimeout(() => {
        this.cleanup();
        this.setState('error');
        reject(new Error('OAuth flow timed out'));
      }, timeoutMs);

      // Listen for the deep link callback
      this.deepLinkUnsub = this.deepLinkHandler.onDeepLink((callbackUrl: string) => {
        const result = parseCallbackUrl(callbackUrl);
        if (!result) return; // Not our callback

        // Validate state for CSRF protection
        if (result.state !== this.pendingState) {
          this.cleanup();
          this.setState('error');
          reject(new Error('OAuth state mismatch ��� possible CSRF attack'));
          return;
        }

        this.cleanup();
        this.setState('exchanging');

        this.exchangeCode(result.code, result.state)
          .then((token) => {
            this.setState('authenticated');
            resolve(token);
          })
          .catch((err: unknown) => {
            this.setState('error');
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      });

      // Open the authorization URL
      this.deepLinkHandler.openUrl(url.toString()).catch((err: unknown) => {
        this.cleanup();
        this.setState('error');
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /** Cancel an in-progress authorization */
  cancel(): void {
    if (this._state === 'authorizing' || this._state === 'exchanging') {
      this.cleanup();
      this.setState('idle');
    }
  }

  /** Subscribe to state changes */
  on(listener: MobileAuthListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Clean up all resources */
  dispose(): void {
    this.cleanup();
    this.listeners = [];
    this._state = 'idle';
  }

  private setState(state: MobileAuthState): void {
    this._state = state;
    const event: MobileAuthEvent = { type: 'state-change', state };
    if (state === 'authenticated') event.type = 'authenticated';
    if (state === 'error') event.type = 'error';
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private cleanup(): void {
    if (this.deepLinkUnsub) {
      this.deepLinkUnsub();
      this.deepLinkUnsub = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.pendingState = null;
  }
}
