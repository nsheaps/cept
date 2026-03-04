# Introduction

Cept is a fully-featured Notion clone that runs entirely on the client. It works offline-first, supports real-time collaboration, and uses Git as its sync and versioning layer.

## Why Cept?

- **Privacy first** — Your data stays on your device or your own Git repository. No third-party servers required.
- **Offline first** — Everything works without an internet connection. Changes sync when you're back online.
- **Git-native** — Every change is a Git commit. You get full version history, branching, and collaboration for free.
- **Cross-platform** — Web (PWA), desktop (macOS, Windows, Linux), and mobile (iOS, Android).
- **Open source** — MIT licensed. Fork it, modify it, self-host it.

## Key Features

- **Rich editor** — Block-based editor with slash commands, markdown shortcuts, drag-and-drop, and 20+ block types.
- **Databases** — Create structured data with table, board, calendar, gallery, list, and map views.
- **Knowledge graph** — Visualize connections between your pages with an interactive force-directed graph.
- **Templates** — Start from built-in templates or create your own.
- **Import/Export** — Import from Notion and Obsidian. Export to Markdown, HTML, or PDF.

## How It Works

Cept uses a **StorageBackend** abstraction that supports three modes:

1. **Browser** (IndexedDB) ��� Zero setup. Just open the app and start writing.
2. **Local folder** — Store your workspace as files on your computer.
3. **Git repository** — Full versioning, sync, and collaboration via any Git host.

The full editing and database experience works on any backend. Git adds collaboration, history, and sync — but it's never required.
