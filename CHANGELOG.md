# Changelog

## [0.1.11](https://github.com/nsheaps/cept/compare/v0.1.10...v0.1.11) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([b398225](https://github.com/nsheaps/cept/commit/b39822555ea6de58083d149617bb8fd1f2b8f9bc))

## [0.1.10](https://github.com/nsheaps/cept/compare/v0.1.9...v0.1.10) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([6e074af](https://github.com/nsheaps/cept/commit/6e074af24bf3565f6693b1a8ed4ba635579c6a2e))

## [0.1.9](https://github.com/nsheaps/cept/compare/v0.1.8...v0.1.9) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([b5e825d](https://github.com/nsheaps/cept/commit/b5e825d10f9890e0eea0ab89bda6f5a8afdc86c2))

## [0.1.8](https://github.com/nsheaps/cept/compare/v0.1.7...v0.1.8) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([b71610c](https://github.com/nsheaps/cept/commit/b71610c1004f183bfb6ad8732bc054daf20d8847))

## [0.1.7](https://github.com/nsheaps/cept/compare/v0.1.6...v0.1.7) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([d773ae6](https://github.com/nsheaps/cept/commit/d773ae6e66479e9c3e45191eb3261e9ca3aaf823))

## [0.1.6](https://github.com/nsheaps/cept/compare/v0.1.5...v0.1.6) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([edb80ca](https://github.com/nsheaps/cept/commit/edb80ca7e11b1f6d4d8866309f72538e10ac8fb4))

## [0.1.5](https://github.com/nsheaps/cept/compare/v0.1.4...v0.1.5) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([4e30503](https://github.com/nsheaps/cept/commit/4e30503176a3bfe12af8503da1537e6018e96888))

## [0.1.4](https://github.com/nsheaps/cept/compare/v0.1.3...v0.1.4) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([28f04ac](https://github.com/nsheaps/cept/commit/28f04ac00415e365033d4b69f315c649546d0c24))

## [0.1.3](https://github.com/nsheaps/cept/compare/v0.1.2...v0.1.3) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([58bb0b0](https://github.com/nsheaps/cept/commit/58bb0b02f698f12e328b453034e4e0db37a83ec8))

## [0.1.2](https://github.com/nsheaps/cept/compare/v0.1.1...v0.1.2) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([3e90690](https://github.com/nsheaps/cept/commit/3e90690b60f288eb019e92fdebe53ba0b3c60637))

## [0.1.1](https://github.com/nsheaps/cept/compare/v0.1.0...v0.1.1) (2026-03-09)

### Documentation

* **screenshots:** update feature screenshots ([eb56c41](https://github.com/nsheaps/cept/commit/eb56c41619301df0b77140addf91e7c642a315cf))

## [0.1.0](https://github.com/nsheaps/cept/compare/v0.0.2...v0.1.0) (2026-03-05)

### Features

* make commit hash on about page a clickable link to GitHub ([#21](https://github.com/nsheaps/cept/issues/21)) ([2f6b84a](https://github.com/nsheaps/cept/commit/2f6b84ad4a9e2fbfbdb7610e2f7309b4f9fc1c51))

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
