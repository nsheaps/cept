/**
 * ElectronBridge — PlatformBridge implementation for Electron (Win/Linux).
 *
 * This module uses Electron's IPC to communicate between the renderer
 * and main process. The main process handles native operations
 * (file dialogs, menus, etc.) and sends results back via IPC.
 *
 * NOTE: This module imports Electron types only — it must be loaded
 * in an Electron context. The actual Electron API is accessed via
 * the contextBridge/ipcRenderer pattern.
 */

import type {
  PlatformBridge,
  PlatformCapabilities,
  FileFilter,
  FileDialogResult,
  WindowState,
  MenuItem,
  NotificationOptions,
} from './platform-bridge.js';
import type { StorageBackend } from '@cept/core';

/** IPC channel names for communication with the main process */
export const IPC_CHANNELS = {
  SHOW_OPEN_DIALOG: 'cept:show-open-dialog',
  SHOW_SAVE_DIALOG: 'cept:show-save-dialog',
  GET_WINDOW_STATE: 'cept:get-window-state',
  SET_TITLE: 'cept:set-title',
  SET_MENU: 'cept:set-menu',
  SHOW_NOTIFICATION: 'cept:show-notification',
  READ_CLIPBOARD: 'cept:read-clipboard',
  WRITE_CLIPBOARD: 'cept:write-clipboard',
  MENU_ACTION: 'cept:menu-action',
  WINDOW_STATE_CHANGE: 'cept:window-state-change',
  CREATE_LOCAL_BACKEND: 'cept:create-local-backend',
} as const;

/** Type for the IPC renderer interface exposed via contextBridge */
export interface ElectronIPC {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): () => void;
  send(channel: string, ...args: unknown[]): void;
}

export class ElectronBridge implements PlatformBridge {
  readonly platform = 'electron' as const;
  readonly capabilities: PlatformCapabilities = {
    fileSystem: true,
    fileDialogs: true,
    nativeMenu: true,
    notifications: true,
    clipboard: true,
    globalShortcuts: true,
    fileWatcher: true,
  };

  private ipc: ElectronIPC;
  private cleanupFns: Array<() => void> = [];

  constructor(ipc: ElectronIPC) {
    this.ipc = ipc;
  }

  async initialize(): Promise<void> {
    // Verify IPC is available
    if (!this.ipc) {
      throw new Error('Electron IPC not available');
    }
  }

  async createLocalBackend(directoryPath: string): Promise<StorageBackend> {
    return this.ipc.invoke(
      IPC_CHANNELS.CREATE_LOCAL_BACKEND,
      directoryPath,
    ) as Promise<StorageBackend>;
  }

  async showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }): Promise<FileDialogResult> {
    return this.ipc.invoke(
      IPC_CHANNELS.SHOW_OPEN_DIALOG,
      options,
    ) as Promise<FileDialogResult>;
  }

  async showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: FileFilter[];
  }): Promise<FileDialogResult> {
    return this.ipc.invoke(
      IPC_CHANNELS.SHOW_SAVE_DIALOG,
      options,
    ) as Promise<FileDialogResult>;
  }

  getWindowState(): WindowState {
    // Synchronous — uses cached state or sensible defaults
    return {
      focused: document.hasFocus(),
      maximized: false,
      minimized: false,
      fullscreen: false,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  setTitle(title: string): void {
    this.ipc.send(IPC_CHANNELS.SET_TITLE, title);
  }

  setMenu(template: MenuItem[]): void {
    this.ipc.send(IPC_CHANNELS.SET_MENU, template);
  }

  showNotification(options: NotificationOptions): void {
    this.ipc.send(IPC_CHANNELS.SHOW_NOTIFICATION, options);
  }

  async readClipboard(): Promise<string> {
    return this.ipc.invoke(IPC_CHANNELS.READ_CLIPBOARD) as Promise<string>;
  }

  async writeClipboard(text: string): Promise<void> {
    await this.ipc.invoke(IPC_CHANNELS.WRITE_CLIPBOARD, text);
  }

  onMenuAction(callback: (menuItemId: string) => void): () => void {
    const unsub = this.ipc.on(IPC_CHANNELS.MENU_ACTION, (...args: unknown[]) => {
      callback(args[0] as string);
    });
    this.cleanupFns.push(unsub);
    return unsub;
  }

  onWindowStateChange(callback: (state: WindowState) => void): () => void {
    const unsub = this.ipc.on(IPC_CHANNELS.WINDOW_STATE_CHANGE, (...args: unknown[]) => {
      callback(args[0] as WindowState);
    });
    this.cleanupFns.push(unsub);
    return unsub;
  }

  async dispose(): Promise<void> {
    for (const fn of this.cleanupFns) {
      fn();
    }
    this.cleanupFns = [];
  }
}
