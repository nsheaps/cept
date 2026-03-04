# Platform Support

Cept runs on every major platform with a consistent experience across all of them.

## Supported Platforms

| Platform | Technology | Status | Notes |
|----------|-----------|--------|-------|
| **Web** | Vite SPA + PWA | Available | Works in any modern browser. PWA for offline use. |
| **macOS** | Electrobun | Coming soon | Native macOS app with system integration |
| **Windows** | Electron | Coming soon | Native Windows app |
| **Linux** | Electron | Coming soon | Native Linux app (AppImage, deb, rpm) |
| **iOS** | Capacitor | Coming soon | Native iOS app via App Store |
| **Android** | Capacitor | Coming soon | Native Android app via Play Store |

## Web Browser Support

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome / Chromium | 90+ | Full support including PWA install |
| Firefox | 90+ | Full support |
| Safari | 15+ | Full support including iOS Safari |
| Edge | 90+ | Full support (Chromium-based) |

## PWA (Progressive Web App)

The web version includes a service worker for offline support:

- **Install as app** — Add to home screen on mobile, or install as desktop app from Chrome/Edge
- **Offline editing** — All features work without an internet connection
- **Auto-update** — New versions are cached automatically

## Architecture

Each platform shell wraps the same `@cept/ui` and `@cept/core` packages:

```
@cept/core   — Business logic, storage, databases, parsers
@cept/ui     — React components and hooks (platform-agnostic)
@cept/web    — Vite SPA + PWA service worker
@cept/desktop — Electrobun (macOS) + Electron (Win/Linux) shells
@cept/mobile  — Capacitor iOS + Android shells
```

This means:

- The editor, databases, and graph work identically everywhere
- Platform-specific code is isolated to shell packages
- `@cept/ui` and `@cept/core` never import platform-specific modules
- All persistence goes through the `StorageBackend` interface

## Storage Backend Availability by Platform

| Backend | Web | Desktop | Mobile |
|---------|-----|---------|--------|
| Browser (IndexedDB/localStorage) | Yes | Yes | Yes |
| Local Folder (filesystem) | No* | Yes | No |
| Git Repository | Yes** | Yes | Yes** |

\* Web has limited filesystem access via the File System Access API (Chrome only).

\** Git operations use isomorphic-git, which runs entirely in the browser/app. No server-side Git required.

## Desktop-Specific Features (Coming Soon)

- Native file system access for Local Folder backend
- System tray / menu bar integration
- Global keyboard shortcuts
- Auto-updates via built-in updater
- Deep linking (`cept://` protocol)

## Mobile-Specific Features (Coming Soon)

- Share extension for quick capture
- Widget support
- Push notifications for collaboration
- Biometric authentication
