# Introduction

Cept is a fully-featured Notion alternative that runs entirely on the client. It works offline-first, supports real-time collaboration, and uses Git as its sync and versioning layer.

## Why Cept?

- **Privacy first** — Your data stays on your device or your own Git repository. No third-party servers store your notes.
- **Offline first** — Everything works without an internet connection. Changes sync when you're back online.
- **Git-native** — Every change is a Git commit. You get full version history, branching, and collaboration for free.
- **Cross-platform** — Web (PWA), desktop (macOS, Windows, Linux), and mobile (iOS, Android).
- **Open source** — MIT licensed. Fork it, modify it, self-host it.
- **No lock-in** — Your data is plain Markdown and YAML. Open it with any text editor.

## Key Features

- **Rich block editor** — Block-based editor with slash commands, markdown shortcuts, and 20+ block types including code, math, diagrams, callouts, toggles, columns, and more.
- **Databases** — Create structured data with table, board, calendar, gallery, list, and map views. Supports 18 property types, formulas, relations, and rollups.
- **Knowledge graph** — Visualize connections between your pages with an interactive force-directed graph. See how your ideas relate to each other.
- **Full-text search** — Instant client-side search across all your pages and databases.
- **Templates** — Start from built-in templates (meeting notes, project tracker, journal, wiki, and more) or create your own.
- **Import/Export** — Import from Notion and Obsidian. Export to Markdown, HTML, or PDF.

## How It Works

Cept uses a **StorageBackend** abstraction that supports three modes:

1. **Browser** (IndexedDB) — Zero setup. Open the app and start writing. Data persists across sessions in your browser.
2. **Local folder** — Store your workspace as plain Markdown files on your computer. Edit them with any text editor alongside Cept.
3. **Git repository** — Full versioning, sync, and collaboration via any Git host (GitHub, GitLab, self-hosted). Every edit becomes a Git commit.

The full editing and database experience works identically on any backend. Git adds collaboration, history, and sync — but it's never required.

## Architecture

Cept is built as a monorepo with clear separation of concerns:

- **@cept/core** — Business logic, storage backends, database engine, CRDT, parsers, and graph algorithms. No UI dependencies.
- **@cept/ui** — React components, hooks, and stores. No platform-specific dependencies.
- **@cept/web** — Vite SPA with PWA support for offline use.
- **@cept/desktop** — Desktop shells using Electrobun (macOS) and Electron (Windows/Linux).
- **@cept/mobile** — Mobile apps using Capacitor for iOS and Android.

This architecture ensures that the editor, databases, and all features work identically across every platform.
