# Changelog

## 0.0.2 (2026-03-05)

### Bug Fixes

* restore dry-run debug output with git checkout cleanup ([3efb60f](https://github.com/nsheaps/cept/commit/3efb60f379ac3910ab380193195a26a12947174c))

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-04

### Added

- **Core Engine**: StorageBackend abstraction with BrowserFs, LocalFs, and Git backends
- **Markdown Parser**: CommonMark + GFM + Cept extensions with block tree model
- **Database Engine**: Schema, CRUD, filter, sort, group, formulas, relations, rollups
- **Search Index**: Client-side full-text search with relevance scoring
- **Template Engine**: 13 built-in templates across 5 categories
- **Editor**: TipTap-based block editor with 15+ block types
  - Slash command menu, inline formatting toolbar, drag-and-drop reordering
  - Column layouts, mentions, math equations (KaTeX), Mermaid diagrams
- **Navigation**: Sidebar page tree, breadcrumbs, command palette (Cmd+K)
- **Knowledge Graph**: D3 force-directed layout with local/global views, time-lapse animation
- **Databases**: Table, Board, Calendar, Map, Gallery, List views
  - Inline and linked database views
  - All property types with dedicated editors
- **Git Integration**: Auto-commit, branch strategies, conflict resolution, sync engine
- **Collaboration**: Yjs CRDT with signaling server, presence awareness, offline queue
- **Cross-Platform**: Web (PWA), Desktop (Electrobun/Electron), Mobile (Capacitor)
- **Import/Export**: Notion ZIP importer, Obsidian vault importer, Markdown/HTML exporter
- **Auto-Updater**: GitHub Releases-based update checking for desktop
- **CI/CD**: Release workflows for web, desktop, and mobile platforms
- **Documentation**: Getting started guides, keyboard shortcuts, migration guides
