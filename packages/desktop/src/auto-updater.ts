/**
 * AutoUpdater — Checks for and applies application updates.
 *
 * Implements a simple update check mechanism that works with
 * GitHub Releases. The actual update installation is delegated
 * to the platform shell (Electron's autoUpdater or Electrobun's
 * native updater).
 */

export interface UpdateInfo {
  /** Version string (semver) */
  version: string;
  /** Release notes (markdown) */
  releaseNotes: string;
  /** Download URL for the platform */
  downloadUrl: string;
  /** Release date (ISO string) */
  releaseDate: string;
  /** Whether this is a mandatory update */
  mandatory: boolean;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'up-to-date';

export interface UpdateEvent {
  type: 'state-change' | 'progress' | 'error';
  state: UpdateState;
  info?: UpdateInfo;
  progress?: number;
  error?: Error;
}

export type UpdateListener = (event: UpdateEvent) => void;

export interface AutoUpdaterConfig {
  /** Current application version */
  currentVersion: string;
  /** URL to check for updates (GitHub Releases API) */
  updateUrl: string;
  /** Check interval in ms. Default: 3600000 (1 hour) */
  checkIntervalMs?: number;
  /** Whether to auto-download updates. Default: false */
  autoDownload?: boolean;
}

export type FetchFunction = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const DEFAULT_CHECK_INTERVAL = 3_600_000; // 1 hour

/**
 * Compare two semver version strings.
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export class AutoUpdater {
  private _state: UpdateState = 'idle';
  private listeners: UpdateListener[] = [];
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private config: Required<AutoUpdaterConfig>;
  private latestUpdate: UpdateInfo | null = null;
  private fetchFn: FetchFunction;

  constructor(config: AutoUpdaterConfig, fetchFn?: FetchFunction) {
    this.config = {
      ...config,
      checkIntervalMs: config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL,
      autoDownload: config.autoDownload ?? false,
    };
    this.fetchFn = fetchFn ?? (globalThis.fetch.bind(globalThis) as FetchFunction);
  }

  /** Get current update state */
  getState(): UpdateState {
    return this._state;
  }

  /** Get latest available update info */
  getLatestUpdate(): UpdateInfo | null {
    return this.latestUpdate;
  }

  /** Check for updates */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this._state === 'checking' || this._state === 'downloading') {
      return this.latestUpdate;
    }

    this.setState('checking');

    try {
      const response = await this.fetchFn(this.config.updateUrl);
      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }

      const data = (await response.json()) as {
        tag_name: string;
        body: string;
        published_at: string;
        assets: Array<{ browser_download_url: string; name: string }>;
      };

      const latestVersion = data.tag_name.replace(/^v/, '');
      const currentVersion = this.config.currentVersion.replace(/^v/, '');

      if (compareVersions(latestVersion, currentVersion) > 0) {
        const downloadAsset = data.assets[0];
        this.latestUpdate = {
          version: latestVersion,
          releaseNotes: data.body,
          downloadUrl: downloadAsset?.browser_download_url ?? '',
          releaseDate: data.published_at,
          mandatory: false,
        };
        this.setState('available', this.latestUpdate);
        return this.latestUpdate;
      }

      this.setState('up-to-date');
      return null;
    } catch (e) {
      this.emitError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }

  /** Start periodic update checks */
  startAutoCheck(): void {
    this.stopAutoCheck();
    this.checkForUpdates();
    this.checkTimer = setInterval(
      () => this.checkForUpdates(),
      this.config.checkIntervalMs,
    );
  }

  /** Stop periodic update checks */
  stopAutoCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /** Subscribe to update events */
  on(listener: UpdateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Clean up */
  dispose(): void {
    this.stopAutoCheck();
    this.listeners = [];
    this._state = 'idle';
    this.latestUpdate = null;
  }

  private setState(state: UpdateState, info?: UpdateInfo): void {
    this._state = state;
    for (const listener of this.listeners) {
      listener({ type: 'state-change', state, info });
    }
  }

  private emitError(error: Error): void {
    this._state = 'error';
    for (const listener of this.listeners) {
      listener({ type: 'error', state: 'error', error });
    }
  }
}
