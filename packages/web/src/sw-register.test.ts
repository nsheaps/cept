import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consumeUpdateFlag, registerServiceWorker, UPDATE_FLAG_KEY } from './sw-register.js';

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

describe('registerServiceWorker install outcome', () => {
  /** A registration whose installing worker the test drives through its states. */
  function setup() {
    const worker = Object.assign(new EventTarget(), { state: 'installing' });
    const registration = Object.assign(new EventTarget(), {
      installing: worker,
      waiting: null,
      active: null,
    });
    const container = Object.assign(new EventTarget(), {
      controller: {},
      register: async () => registration,
    });
    Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
    const move = (state: string) => {
      worker.state = state;
      worker.dispatchEvent(new Event('statechange'));
    };
    const start = async () => {
      const errors: Error[] = [];
      await registerServiceWorker('/sw.js', { onError: (error) => errors.push(error) });
      registration.dispatchEvent(new Event('updatefound'));
      return errors;
    };
    return { move, start };
  }

  it('reports an install that goes straight to redundant as a failure', async () => {
    const { move, start } = setup();
    const errors = await start();
    move('redundant');
    expect(errors).toHaveLength(1);
  });

  it('does not report a worker that was installed and then superseded', async () => {
    const { move, start } = setup();
    const errors = await start();
    move('installed');
    move('redundant');
    expect(errors).toHaveLength(0);
  });
});
