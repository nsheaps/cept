/**
 * Service Worker Registration — Handles registering the SW and
 * notifying the app about updates. When a new SW version is detected,
 * it automatically activates the new SW and reloads the page so the
 * user always sees the latest content.
 */

import { namespacedKey } from './deploy-namespace.js';

/** Key used in sessionStorage to signal a post-update reload */
export const UPDATE_FLAG_KEY = namespacedKey(import.meta.env.BASE_URL, 'cept-sw-updated');

export interface SWRegistrationCallbacks {
  /** Called when a new service worker is waiting to activate */
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  /** Called when the app is ready for offline use */
  onReady?: (registration: ServiceWorkerRegistration) => void;
  /** Called on registration error */
  onError?: (error: Error) => void;
}

export async function registerServiceWorker(
  swUrl: string,
  callbacks?: SWRegistrationCallbacks,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker) {
    return null;
  }

  const sw = navigator.serviceWorker;

  // Listen for controller changes (a new SW activated). Reload once so
  // the page is served by the fresh SW.
  let refreshing = false;
  sw.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // Mark that an update just occurred so the app can show a toast after reload
    sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
    window.location.reload();
  });

  try {
    const registration = await sw.register(swUrl);

    // If a waiting worker already exists (e.g. from a previous visit), activate it
    if (registration.waiting) {
      callbacks?.onUpdate?.(registration);
      skipWaiting(registration);
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (sw.controller) {
            // New update available — activate it immediately
            callbacks?.onUpdate?.(registration);
            skipWaiting(registration);
          } else {
            // First install — app is cached for offline
            callbacks?.onReady?.(registration);
          }
        }
      });
    });

    return registration;
  } catch (error) {
    callbacks?.onError?.(error as Error);
    return null;
  }
}

export function skipWaiting(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Check whether the page just reloaded due to a SW update.
 * Consumes the flag so it only returns true once.
 */
export function consumeUpdateFlag(): boolean {
  const flag = sessionStorage.getItem(UPDATE_FLAG_KEY);
  if (flag) {
    sessionStorage.removeItem(UPDATE_FLAG_KEY);
    return true;
  }
  return false;
}
