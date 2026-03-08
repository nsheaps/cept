import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consumeUpdateFlag, UPDATE_FLAG_KEY } from './sw-register.js';

describe('consumeUpdateFlag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns false when no flag is set', () => {
    expect(consumeUpdateFlag()).toBe(false);
  });

  it('returns true and clears the flag when set', () => {
    sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
    expect(consumeUpdateFlag()).toBe(true);
    // Second call should return false (consumed)
    expect(consumeUpdateFlag()).toBe(false);
  });

  it('removes the flag from sessionStorage', () => {
    sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
    consumeUpdateFlag();
    expect(sessionStorage.getItem(UPDATE_FLAG_KEY)).toBeNull();
  });
});

describe('registerServiceWorker', () => {
  it('exports registerServiceWorker and skipWaiting functions', async () => {
    const mod = await import('./sw-register.js');
    expect(typeof mod.registerServiceWorker).toBe('function');
    expect(typeof mod.skipWaiting).toBe('function');
    expect(typeof mod.consumeUpdateFlag).toBe('function');
  });

  it('returns null when serviceWorker is not supported', async () => {
    const original = navigator.serviceWorker;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    const { registerServiceWorker } = await import('./sw-register.js');
    const result = await registerServiceWorker('/sw.js');
    expect(result).toBeNull();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: original,
      configurable: true,
    });
  });
});
