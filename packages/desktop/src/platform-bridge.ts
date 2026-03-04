/**
 * PlatformBridge — Abstraction layer between the UI and native desktop APIs.
 *
 * The bridge defines what native capabilities the desktop shell exposes
 * to the renderer process. Each platform (Electrobun, Electron) provides
 * its own implementation.
 *
 * The UI accesses native features ONLY through this bridge — never
 * through direct Node.js or platform-specific imports.
 */

import type { StorageBackend } from '@cept/core';

/** File dialog filter */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** File dialog result */
export interface FileDialogResult {
  canceled: boolean;
  filePaths: string[];
}

/** Window state */
export interface WindowState {
  focused: boolean;
  maximized: boolean;
  minimized: boolean;
  fullscreen: boolean;
  width: number;
  height: number;
}

/** Menu item definition */
export interface MenuItem {
  id: string;
  label: string;
  accelerator?: string;
  enabled?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
  type?: 'normal' | 'separator' | 'checkbox';
}

/** Native notification options */
export interface NotificationOptions {
  title: string;
  body: string;
  silent?: boolean;
}

/** Platform bridge capabilities */
export interface PlatformCapabilities {
  /** Can access local filesystem */
  fileSystem: boolean;
  /** Can show native file dialogs */
  fileDialogs: boolean;
  /** Can create native menus */
  nativeMenu: boolean;
  /** Can show native notifications */
  notifications: boolean;
  /** Can use native clipboard */
  clipboard: boolean;
  /** Can register global shortcuts */
  globalShortcuts: boolean;
  /** Can watch for file changes */
  fileWatcher: boolean;
}

/** The bridge interface each platform must implement */
export interface PlatformBridge {
  /** Platform identifier */
  readonly platform: 'electrobun' | 'electron' | 'web';
  /** What this platform can do */
  readonly capabilities: PlatformCapabilities;

  /** Initialize the bridge */
  initialize(): Promise<void>;

  /** Create a StorageBackend for a local directory */
  createLocalBackend(directoryPath: string): Promise<StorageBackend>;

  /** Show an open file/folder dialog */
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }): Promise<FileDialogResult>;

  /** Show a save dialog */
  showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
  }): Promise<FileDialogResult>;

  /** Get the current window state */
  getWindowState(): WindowState;

  /** Set the window title */
  setTitle(title: string): void;

  /** Set the application menu */
  setMenu(template: MenuItem[]): void;

  /** Show a native notification */
  showNotification(options: NotificationOptions): void;

  /** Read from clipboard */
  readClipboard(): Promise<string>;

  /** Write to clipboard */
  writeClipboard(text: string): Promise<void>;

  /** Subscribe to menu item clicks */
  onMenuAction(callback: (menuItemId: string) => void): () => void;

  /** Subscribe to window state changes */
  onWindowStateChange(callback: (state: WindowState) => void): () => void;

  /** Clean up */
  dispose(): Promise<void>;
}

/**
 * WebPlatformBridge — Fallback bridge for the web platform.
 * Provides no-op implementations for native features.
 */
export class WebPlatformBridge implements PlatformBridge {
  readonly platform = 'web' as const;
  readonly capabilities: PlatformCapabilities = {
    fileSystem: false,
    fileDialogs: false,
    nativeMenu: false,
    notifications: 'Notification' in globalThis,
    clipboard: 'clipboard' in (globalThis.navigator ?? {}),
    globalShortcuts: false,
    fileWatcher: false,
  };

  async initialize(): Promise<void> {
    // No-op for web
  }

  async createLocalBackend(): Promise<StorageBackend> {
    throw new Error('Local backends are not supported on web');
  }

  async showOpenDialog(): Promise<FileDialogResult> {
    return { canceled: true, filePaths: [] };
  }

  async showSaveDialog(): Promise<FileDialogResult> {
    return { canceled: true, filePaths: [] };
  }

  getWindowState(): WindowState {
    return {
      focused: document.hasFocus(),
      maximized: false,
      minimized: false,
      fullscreen: !!document.fullscreenElement,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  setTitle(title: string): void {
    document.title = title;
  }

  setMenu(): void {
    // No native menu on web
  }

  showNotification(options: NotificationOptions): void {
    if (this.capabilities.notifications && Notification.permission === 'granted') {
      new Notification(options.title, { body: options.body, silent: options.silent });
    }
  }

  async readClipboard(): Promise<string> {
    if (this.capabilities.clipboard) {
      return navigator.clipboard.readText();
    }
    return '';
  }

  async writeClipboard(text: string): Promise<void> {
    if (this.capabilities.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }

  onMenuAction(): () => void {
    return () => {};
  }

  onWindowStateChange(callback: (state: WindowState) => void): () => void {
    const handler = (): void => callback(this.getWindowState());
    window.addEventListener('resize', handler);
    window.addEventListener('focus', handler);
    window.addEventListener('blur', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('focus', handler);
      window.removeEventListener('blur', handler);
    };
  }

  async dispose(): Promise<void> {
    // No-op
  }
}
