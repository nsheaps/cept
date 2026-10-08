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

| Backend                   | Web             | PWA (incl. phones) | Desktop app |
| ------------------------- | --------------- | ------------------ | ----------- |
| Browser (IndexedDB)       | Yes             | Yes                | No          |
| Folder (File System Access) | Where supported\* | Where supported\* | No          |
| Folder (native filesystem) | No             | No                 | Yes         |
| Git repository            | Yes\*\*         | Yes\*\*            | Yes         |
| In-memory demo            | Yes             | Yes                | No          |

\* The File System Access API exists in Chromium browsers on desktop. Phones and other browsers don't have it.

\*\* Git runs in the browser with isomorphic-git, through a CORS proxy for the network calls. No server-side Git is needed.

Browsers can clear a site's storage when the device runs low on space. When you create your first space, Cept asks the browser to keep its storage. If the browser says no, or if storage is almost full, Cept shows a warning: link your spaces to GitHub, or install Cept as an app (installed apps are usually allowed to keep their storage), so nothing is lost.

The Add Space dialog only offers the kinds of space that work on your device: it checks for IndexedDB and the File System Access API before showing those options. Native mobile apps come later; on phones, install the PWA.

## Opening a Folder in the Browser

In a Chromium-based browser on a computer, such as Chrome or Edge, choose **Local folder** on the start page, or **Local folder** in the Add Space dialog, and pick a folder:

- If the folder is a space (it has a `space.cept.yaml`), it opens right away.
- If it is not, Cept lists the spaces in its subfolders, and offers to make the folder itself a space. Only that choice writes to the folder, and it adds a single file, `space.cept.yaml`.
- If its `space.cept.yaml` cannot be read, Cept says why and opens nothing; it never overwrites that file. Fix the file, or pick a subfolder to open a space inside it.
- Opening a folder and reading its pages changes nothing in it. Cept writes a page's file only after you edit that page. Your recent pages, favorites and expanded folders are kept in the browser, not in the folder.
- Cept remembers the folder. After a reload or a new visit, the browser may ask for permission again: the space shows a **Reconnect folder** button, and the folder opens once you allow it. If you refuse, the button changes to **Pick the folder** so you can choose it again. If the browser has lost the folder, you pick it again; Cept checks that it holds the space, and asks before using a folder whose space has another name.
- Changes made to the folder outside Cept show after you reload the page; Cept does not watch the folder while it is open.

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
