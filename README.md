# Cept

A fully-featured Notion clone backed by Git. Client-only. Offline-first. Collaborative.

[![CI](https://github.com/nsheaps/cept/actions/workflows/ci.yml/badge.svg)](https://github.com/nsheaps/cept/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is Cept?

Cept is a **Notion-like workspace** with a **flexible, multi-backend storage architecture**. No server, no proprietary database, no SaaS dependency. You choose how to store your data:

- **Browser** — Open the web app and start writing immediately. Zero setup, zero accounts. Data persists in IndexedDB.
- **Local Folder** — Point Cept at any directory on disk. Files are plain Markdown, editable with any text editor.
- **Git Repository** — The most powerful option. Get version history, real-time collaboration, multi-device sync, branching, and conflict resolution — all automatic.

## Key Features

- Full block editor with slash commands, drag-and-drop, and inline formatting
- Databases with 6 view types: Table, Board (Kanban), Calendar, Map, Gallery, List
- 18 database property types including relations, rollups, and formulas
- Knowledge graph visualization (global and local views)
- Mermaid diagram support (20+ diagram types with live preview)
- Templates system with built-in starter templates
- Full-text search across all content
- Real-time collaboration via CRDTs (Git backend)
- Import from Notion and Obsidian
- Cross-platform: Desktop (macOS/Windows/Linux), Web (PWA), Mobile (iOS/Android)

## Quick Start

```bash
# Prerequisites: mise (https://mise.jdx.dev)
mise install          # Install bun and node
bun install           # Install dependencies
bun run dev:web       # Start the web app
```

## Development

```bash
bun run dev           # Dev mode (all packages)
bun run test          # Run all tests
bun run lint          # Lint everything
bun run typecheck     # Type check everything
bun run validate      # Full quality gate (lint + typecheck + test)
nx graph              # Visualize project dependency graph
```

## Architecture

Cept is a monorepo with the following packages:

| Package | Description |
|---|---|
| `@cept/core` | Business logic, storage backends, database engine, parsers |
| `@cept/ui` | Shared React components, hooks, stores |
| `@cept/web` | Vite SPA + PWA |
| `@cept/desktop` | Electrobun (macOS) + Electron (Win/Linux) |
| `@cept/mobile` | Capacitor (iOS/Android) |
| `@cept/signaling` | WebSocket signaling server for real-time collaboration |

## Storage Backends

| Backend | Persistence | Collaboration | History | Sync |
|---|---|---|---|---|
| **Browser** | IndexedDB | No | No | No |
| **Local Folder** | Filesystem | No | No | No |
| **Git** | Git repo | Yes (CRDTs) | Yes (Git log) | Yes (push/pull) |

All backends support the complete editing, database, graph, and template experience. Git adds collaboration, history, and sync as additive capabilities.

## Documentation

See the [full specification](docs/SPECIFICATION.md) for detailed architecture and feature requirements.

## License

[MIT](LICENSE)
