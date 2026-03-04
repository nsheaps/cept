/**
 * MobileBridge — Abstraction for Capacitor native plugin access.
 *
 * Similar to PlatformBridge for desktop, MobileBridge provides a
 * typed interface for mobile-specific capabilities (haptics, share,
 * biometrics, etc.). The actual Capacitor plugins are injected,
 * keeping this module free of direct @capacitor/* imports.
 */

import type { StorageBackend } from '@cept/core';

/** Mobile platform capabilities */
export interface MobileCapabilities {
  /** Can share content via native share sheet */
  share: boolean;
  /** Can access haptic feedback */
  haptics: boolean;
  /** Can use biometric authentication */
  biometrics: boolean;
  /** Can access local filesystem */
  fileSystem: boolean;
  /** Can show native toasts/alerts */
  nativeAlerts: boolean;
  /** Supports push notifications */
  pushNotifications: boolean;
  /** Can access device keyboard info */
  keyboard: boolean;
  /** Can access status bar */
  statusBar: boolean;
}

/** Share options */
export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/** Keyboard event info */
export interface KeyboardInfo {
  keyboardHeight: number;
}

/** Status bar style */
export type StatusBarStyle = 'dark' | 'light' | 'default';

/** Safe area insets */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MobileBridge {
  /** Platform ('ios' | 'android' | 'web') */
  readonly platform: 'ios' | 'android' | 'web';
  /** Available capabilities */
  readonly capabilities: MobileCapabilities;

  /** Initialize the bridge */
  initialize(): Promise<void>;

  /** Create a storage backend for mobile (usually SQLite or filesystem) */
  createStorageBackend(): Promise<StorageBackend>;

  /** Share content via native share sheet */
  share(options: ShareOptions): Promise<void>;

  /** Trigger haptic feedback */
  hapticImpact(style: 'light' | 'medium' | 'heavy'): void;
  hapticNotification(type: 'success' | 'warning' | 'error'): void;

  /** Get safe area insets */
  getSafeAreaInsets(): SafeAreaInsets;

  /** Set status bar style */
  setStatusBarStyle(style: StatusBarStyle): void;

  /** Subscribe to keyboard show/hide */
  onKeyboardShow(callback: (info: KeyboardInfo) => void): () => void;
  onKeyboardHide(callback: () => void): () => void;

  /** Show a native alert */
  showAlert(options: {
    title: string;
    message: string;
    buttons?: string[];
  }): Promise<number>;

  /** Clean up */
  dispose(): Promise<void>;
}

/**
 * WebMobileBridge — Fallback bridge for running on web (non-native).
 * Most operations are no-ops.
 */
export class WebMobileBridge implements MobileBridge {
  readonly platform = 'web' as const;
  readonly capabilities: MobileCapabilities = {
    share: 'share' in (globalThis.navigator ?? {}),
    haptics: false,
    biometrics: false,
    fileSystem: false,
    nativeAlerts: true,
    pushNotifications: false,
    keyboard: false,
    statusBar: false,
  };

  async initialize(): Promise<void> {}

  async createStorageBackend(): Promise<StorageBackend> {
    throw new Error('Use BrowserFsBackend directly on web');
  }

  async share(options: ShareOptions): Promise<void> {
    if (this.capabilities.share && navigator.share) {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
    }
  }

  hapticImpact(): void {}
  hapticNotification(): void {}

  getSafeAreaInsets(): SafeAreaInsets {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  setStatusBarStyle(): void {}

  onKeyboardShow(): () => void {
    return () => {};
  }

  onKeyboardHide(): () => void {
    return () => {};
  }

  async showAlert(options: {
    title: string;
    message: string;
    buttons?: string[];
  }): Promise<number> {
    if (options.buttons && options.buttons.length > 1) {
      const result = confirm(`${options.title}\n\n${options.message}`);
      return result ? 0 : 1;
    }
    alert(`${options.title}\n\n${options.message}`);
    return 0;
  }

  async dispose(): Promise<void> {}
}
