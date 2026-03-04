import { describe, it, expect, vi } from 'vitest';
import { WebMobileBridge } from './mobile-bridge.js';

describe('WebMobileBridge', () => {
  it('has web platform identifier', () => {
    const bridge = new WebMobileBridge();
    expect(bridge.platform).toBe('web');
  });

  it('reports limited capabilities', () => {
    const bridge = new WebMobileBridge();
    expect(bridge.capabilities.haptics).toBe(false);
    expect(bridge.capabilities.biometrics).toBe(false);
    expect(bridge.capabilities.fileSystem).toBe(false);
    expect(bridge.capabilities.pushNotifications).toBe(false);
    expect(bridge.capabilities.keyboard).toBe(false);
    expect(bridge.capabilities.statusBar).toBe(false);
  });

  it('initialize is a no-op', async () => {
    const bridge = new WebMobileBridge();
    await expect(bridge.initialize()).resolves.toBeUndefined();
  });

  it('createStorageBackend throws on web', async () => {
    const bridge = new WebMobileBridge();
    await expect(bridge.createStorageBackend()).rejects.toThrow(
      'Use BrowserFsBackend directly on web',
    );
  });

  it('hapticImpact is a no-op', () => {
    const bridge = new WebMobileBridge();
    bridge.hapticImpact('medium');
    bridge.hapticNotification('success');
    // Should not throw
  });

  it('getSafeAreaInsets returns zero insets', () => {
    const bridge = new WebMobileBridge();
    const insets = bridge.getSafeAreaInsets();
    expect(insets.top).toBe(0);
    expect(insets.right).toBe(0);
    expect(insets.bottom).toBe(0);
    expect(insets.left).toBe(0);
  });

  it('setStatusBarStyle is a no-op', () => {
    const bridge = new WebMobileBridge();
    bridge.setStatusBarStyle('dark');
    // Should not throw
  });

  it('onKeyboardShow returns unsubscribe', () => {
    const bridge = new WebMobileBridge();
    const unsub = bridge.onKeyboardShow(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('onKeyboardHide returns unsubscribe', () => {
    const bridge = new WebMobileBridge();
    const unsub = bridge.onKeyboardHide(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('showAlert with single button uses alert', async () => {
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    const bridge = new WebMobileBridge();
    const result = await bridge.showAlert({ title: 'Info', message: 'Hello' });
    expect(result).toBe(0);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('showAlert with multiple buttons uses confirm', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const bridge = new WebMobileBridge();
    const result = await bridge.showAlert({
      title: 'Question',
      message: 'Continue?',
      buttons: ['OK', 'Cancel'],
    });
    expect(result).toBe(0);
    confirmSpy.mockRestore();
  });

  it('showAlert returns 1 when confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const bridge = new WebMobileBridge();
    const result = await bridge.showAlert({
      title: 'Q',
      message: 'M',
      buttons: ['Yes', 'No'],
    });
    expect(result).toBe(1);
    confirmSpy.mockRestore();
  });

  it('dispose is a no-op', async () => {
    const bridge = new WebMobileBridge();
    await expect(bridge.dispose()).resolves.toBeUndefined();
  });
});
