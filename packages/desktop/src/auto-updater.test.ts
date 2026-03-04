import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoUpdater, compareVersions } from './auto-updater.js';
import type { UpdateEvent, FetchFunction } from './auto-updater.js';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('returns 1 for newer version', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
  });

  it('returns -1 for older version', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('handles v prefix', () => {
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
  });

  it('handles different length versions', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
  });
});

describe('AutoUpdater', () => {
  let mockFetch: ReturnType<typeof vi.fn<FetchFunction>>;

  const releaseResponse = {
    tag_name: 'v2.0.0',
    body: 'Release notes',
    published_at: '2026-03-01T00:00:00Z',
    assets: [{ browser_download_url: 'https://example.com/download', name: 'app.dmg' }],
  };

  beforeEach(() => {
    mockFetch = vi.fn<FetchFunction>(async () => ({
      ok: true,
      json: async () => releaseResponse,
    }));
  });

  it('starts in idle state', () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );
    expect(updater.getState()).toBe('idle');
  });

  it('detects available update', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    const info = await updater.checkForUpdates();
    expect(info).toBeDefined();
    expect(info!.version).toBe('2.0.0');
    expect(updater.getState()).toBe('available');
  });

  it('reports up-to-date when no update available', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '3.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    const info = await updater.checkForUpdates();
    expect(info).toBeNull();
    expect(updater.getState()).toBe('up-to-date');
  });

  it('handles fetch errors', async () => {
    const errorFetch = vi.fn<FetchFunction>(async () => ({
      ok: false,
      json: async () => ({}),
    }));
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      errorFetch,
    );

    const info = await updater.checkForUpdates();
    expect(info).toBeNull();
    expect(updater.getState()).toBe('error');
  });

  it('emits events on state changes', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    const events: UpdateEvent[] = [];
    updater.on((e) => events.push(e));

    await updater.checkForUpdates();

    const states = events.map((e) => e.state);
    expect(states).toContain('checking');
    expect(states).toContain('available');
  });

  it('stores latest update info', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    expect(updater.getLatestUpdate()).toBeNull();
    await updater.checkForUpdates();

    const update = updater.getLatestUpdate();
    expect(update).toBeDefined();
    expect(update!.version).toBe('2.0.0');
    expect(update!.releaseNotes).toBe('Release notes');
    expect(update!.downloadUrl).toBe('https://example.com/download');
  });

  it('unsubscribes from events', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    const events: UpdateEvent[] = [];
    const unsub = updater.on((e) => events.push(e));
    unsub();

    await updater.checkForUpdates();
    expect(events.length).toBe(0);
  });

  it('dispose cleans up', () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    updater.dispose();
    expect(updater.getState()).toBe('idle');
    expect(updater.getLatestUpdate()).toBeNull();
  });

  it('does not duplicate checks when already checking', async () => {
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      mockFetch,
    );

    const p1 = updater.checkForUpdates();
    const p2 = updater.checkForUpdates();
    await Promise.all([p1, p2]);

    // Second call should return immediately without fetching again
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles network errors gracefully', async () => {
    const errorFetch = vi.fn<FetchFunction>(async () => {
      throw new Error('Network error');
    });
    const updater = new AutoUpdater(
      { currentVersion: '1.0.0', updateUrl: 'https://api.github.com/repos/test/releases/latest' },
      errorFetch,
    );

    const events: UpdateEvent[] = [];
    updater.on((e) => events.push(e));

    await updater.checkForUpdates();
    expect(updater.getState()).toBe('error');
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });
});
