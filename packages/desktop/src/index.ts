/**
 * @cept/desktop — Desktop shell for Cept
 *
 * Provides platform bridges for Electrobun (macOS) and Electron (Win/Linux).
 * The UI communicates with native APIs exclusively through the PlatformBridge
 * interface — no direct Node.js or platform-specific imports in UI code.
 */

export { WebPlatformBridge } from './platform-bridge.js';
export type {
  PlatformBridge,
  PlatformCapabilities,
  FileFilter,
  FileDialogResult,
  WindowState,
  MenuItem,
  NotificationOptions,
} from './platform-bridge.js';

export { ElectronBridge, IPC_CHANNELS } from './electron-bridge.js';
export type { ElectronIPC } from './electron-bridge.js';

export { AutoUpdater, compareVersions } from './auto-updater.js';
export type {
  UpdateInfo,
  UpdateState,
  UpdateEvent,
  UpdateListener,
  AutoUpdaterConfig,
  FetchFunction,
} from './auto-updater.js';
