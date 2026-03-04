/**
 * Service Worker Registration — Handles registering the SW and
 * notifying the app about updates.
 */

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
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/',
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New update available
            callbacks?.onUpdate?.(registration);
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
