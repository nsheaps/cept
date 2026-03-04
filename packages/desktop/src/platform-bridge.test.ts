import { describe, it, expect, vi } from 'vitest';
import { WebPlatformBridge } from './platform-bridge.js';

describe('WebPlatformBridge', () => {
  it('has web platform identifier', () => {
    const bridge = new WebPlatformBridge();
    expect(bridge.platform).toBe('web');
  });

  it('reports limited capabilities', () => {
    const bridge = new WebPlatformBridge();
    expect(bridge.capabilities.fileSystem).toBe(false);
    expect(bridge.capabilities.fileDialogs).toBe(false);
    expect(bridge.capabilities.nativeMenu).toBe(false);
    expect(bridge.capabilities.globalShortcuts).toBe(false);
    expect(bridge.capabilities.fileWatcher).toBe(false);
  });

  it('initialize is a no-op', async () => {
    const bridge = new WebPlatformBridge();
    await expect(bridge.initialize()).resolves.toBeUndefined();
  });

  it('createLocalBackend throws on web', async () => {
    const bridge = new WebPlatformBridge();
    await expect(bridge.createLocalBackend('/tmp')).rejects.toThrow(
      'Local backends are not supported on web',
    );
  });

  it('showOpenDialog returns canceled', async () => {
    const bridge = new WebPlatformBridge();
    const result = await bridge.showOpenDialog({ title: 'Open' });
    expect(result.canceled).toBe(true);
    expect(result.filePaths).toHaveLength(0);
  });

  it('showSaveDialog returns canceled', async () => {
    const bridge = new WebPlatformBridge();
    const result = await bridge.showSaveDialog({ title: 'Save' });
    expect(result.canceled).toBe(true);
    expect(result.filePaths).toHaveLength(0);
  });

  it('getWindowState returns current state', () => {
    const bridge = new WebPlatformBridge();
    const state = bridge.getWindowState();
    expect(state).toHaveProperty('focused');
    expect(state).toHaveProperty('maximized');
    expect(state).toHaveProperty('width');
    expect(state).toHaveProperty('height');
    expect(state.maximized).toBe(false);
    expect(state.minimized).toBe(false);
  });

  it('setTitle updates document title', () => {
    const bridge = new WebPlatformBridge();
    bridge.setTitle('Test Title');
    expect(document.title).toBe('Test Title');
  });

  it('setMenu is a no-op', () => {
    const bridge = new WebPlatformBridge();
    // Should not throw
    bridge.setMenu([{ id: 'file', label: 'File' }]);
  });

  it('onMenuAction returns unsubscribe function', () => {
    const bridge = new WebPlatformBridge();
    const unsub = bridge.onMenuAction(() => {});
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });

  it('onWindowStateChange subscribes to window events', () => {
    const bridge = new WebPlatformBridge();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const unsub = bridge.onWindowStateChange(() => {});
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function));

    unsub();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('dispose is a no-op', async () => {
    const bridge = new WebPlatformBridge();
    await expect(bridge.dispose()).resolves.toBeUndefined();
  });

  it('showNotification handles missing Notification API', () => {
    const bridge = new WebPlatformBridge();
    // In jsdom, Notification may not be available or permission won't be granted
    // Should not throw
    bridge.showNotification({ title: 'Test', body: 'Hello' });
  });
});
