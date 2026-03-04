/**
 * @cept/mobile — Capacitor iOS + Android mobile shell
 *
 * Provides the MobileBridge abstraction for accessing native mobile
 * capabilities through Capacitor plugins. The UI accesses mobile
 * features only through this bridge.
 */

export { WebMobileBridge } from './mobile-bridge.js';
export type {
  MobileBridge,
  MobileCapabilities,
  ShareOptions,
  KeyboardInfo,
  StatusBarStyle,
  SafeAreaInsets,
} from './mobile-bridge.js';

export { MobileAuthAdapter, generateState, parseCallbackUrl } from './mobile-auth.js';
export type {
  DeepLinkHandler,
  MobileAuthConfig,
  CodeExchangeFn,
  MobileAuthState,
  MobileAuthEvent,
  MobileAuthListener,
} from './mobile-auth.js';
