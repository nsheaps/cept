# CEPT — Continuation Development Prompt

> **Repository:** `github.com/nsheaps/cept`
> **Predecessor prompt:** `.claude/prompts/init.md` (the bootstrap prompt — read it for full architectural context)
> **Full spec (human-readable):** `docs/SPECIFICATION.md`
> **This prompt:** `.claude/prompts/continue.md`

---

## Table of Contents

1. [Context & Current State](#1-context--current-state)
2. [What Has Been Built](#2-what-has-been-built)
3. [What Remains To Be Built](#3-what-remains-to-be-built)
4. [Revised Roadmap (Prioritized)](#4-revised-roadmap-prioritized)
5. [Detailed Phase Specifications](#5-detailed-phase-specifications)
6. [Autonomous Development Protocol](#6-autonomous-development-protocol)
7. [Quality Gates & Self-Evaluation](#7-quality-gates--self-evaluation)
8. [Session Management](#8-session-management)
9. [Critical Architecture Rules](#9-critical-architecture-rules)
10. [Reference Documents](#10-reference-documents)

---

## 1. Context & Current State

### 1.1 What Is Cept?

Cept is a **fully-featured Notion clone** with a **flexible, multi-backend storage architecture**. Users choose how they store their workspace: Browser (IndexedDB), Local Folder (filesystem), or Git Repository (with collaboration, history, and sync). The full spec is in `.claude/prompts/init.md` — **read Sections 1-5 of that document** for the complete vision, data model, and feature requirements.

### 1.2 Work Completed So Far

The project was bootstrapped and developed through 10 phases in the original init.md plan (Phases -1 through 10). All tasks in `TASKS.md` are marked complete (all on 2026-03-04). The reality is nuanced:

**What was built is a working v0.1.0 with ~33,000 lines of real TypeScript.** The implementations are substantive — not stubs. However, many modules exist as **isolated, well-implemented components that are not connected to the running application**. The app shell (`packages/ui/src/App.tsx`) uses **raw localStorage** for persistence rather than the `StorageBackend` interface. The actual `BrowserFsBackend` (lightning-fs/IndexedDB), `LocalFsBackend`, and `GitBackend` implementations exist and have tests, but they aren't wired to the UI.

**What works end-to-end today:**
- TipTap editor with all 20+ block types
- Sidebar page tree with infinite nesting
- localStorage persistence (survives page reloads)
- Search, command palette, breadcrumbs
- Settings modal, dark mode
- Built-in docs space
- Mobile-responsive UI

**What exists as real code but is NOT accessible from the running app:**
- Database views (table, board, calendar, gallery, list) — components exist, not routed
- Knowledge graph (D3 force-directed) — component exists, no graph builder feeds it data
- Git integration (commit, push, pull, branch, merge) — GitBackend exists, not wired to UI
- GitHub OAuth — complete implementation, not wired to any UI flow
- Collaboration (Yjs abstraction) — provider exists, no concrete Yjs binding
- Conflict resolver, history viewer, repo picker — components exist, not in app shell
- Presence (avatar stack, cursor overlay) — components exist, not wired to Yjs
- Notion/Obsidian importers — complete implementations, no UI to drive them
- Signaling server — RoomManager complete, no WebSocket server entry point
- Desktop shell — Electron bridge exists, no main process/BrowserWindow
- Mobile — interface/fallback exists, no Capacitor project files

### 1.3 Key Commits & History

The complete git history tells the story. Key milestones:

| Commit | Description |
|--------|-------------|
| `16fd326` | Phase -1 complete: Claude Code infrastructure bootstrap |
| `0439217` | Phase 0: Monorepo initialized (Nx, Bun, TypeScript) |
| `2a8bf2f` | T1.1: BrowserFsBackend and LocalFsBackend implementations |
| `b6d7e07` | T1.2: GitBackend with isomorphic-git |
| `4aeef8a` | T1.3+T1.4: Markdown parser and YAML front matter |
| `e11238a` | T1.5: Database engine with CRUD, filter, sort, group |
| `efc54b0` | T2.1: TipTap editor with basic blocks |
| `04dddee` | T3.9: Knowledge Graph — global view with D3 |
| `7eb3f5f` | T4.1: Database schema UI |
| `60e65f5` | T5.1: GitHub OAuth flow |
| `ff9e409` | T6.1: Collaboration provider (Yjs) |
| `b6480a6` | T7.1: Desktop shell with PlatformBridge |
| `06d704e` | T8.1: Notion export ZIP importer |
| `c967f91` | T9.1: Documentation site setup |
| `ad8b4c3` | T10.4: First release preparation (v0.1.0) |
| `97c82b0` | Fix: Wire up App integration layer, Tailwind build, layout |
| `867939d` | Add localStorage persistence, service worker types, App integration tests |
| `d3203a6` | Add dark mode CSS, mobile sidebar backdrop, 49 new tests |
| `98b35f0` | Fix persistence, sidebar, trash/favorites discoverability |
| `d572437` | Add Settings modal, rename workspace to space, SVG icons |
| `3d90b75` | Add built-in docs space, move app menu to sidebar |
| `d313398` | Add inline space renaming, fix review issues |

**Post-release polish work** (commits after `ad8b4c3`) focused on:
- Wiring up the actual App integration layer (connecting stores to components)
- localStorage persistence (making data survive page reloads)
- Dark mode CSS implementation
- Mobile-responsive UI (sidebar backdrop, auto-close)
- Settings modal with tabs
- Built-in documentation space
- Inline title editing, page headers
- UX discoverability improvements (context menus for trash/favorites)
- Space renaming

### 1.4 Current Codebase Statistics

- **~18,900 lines** of non-test TypeScript/TSX source code
- **~14,300 lines** of test code
- **1,418 tests** all passing
- **7 packages** in the monorepo (core, ui, web, desktop, mobile, signaling-server, docs)
- **Lint, typecheck, and all tests pass** (`bun run validate` is green)

### 1.5 What "Done" Actually Means

The current Phase 1 (from `docs/content/reference/roadmap.md`) is genuinely complete and functional:
- Block editor with 20+ block types (TipTap-based)
- Slash command menu with search/filter
- Page management (create, rename, delete, duplicate, move)
- Sidebar with page tree, favorites, recent, trash
- Command palette (Cmd+K)
- Full-text search
- Settings modal
- Dark mode
- Mobile-responsive UI
- GitHub Pages deployment + PWA service worker
- localStorage persistence
- Built-in documentation space

**What exists as code but needs to be elevated to production quality:**
- Storage backends exist as interfaces + localStorage-based implementations, but `BrowserFsBackend` (lightning-fs/IndexedDB), `LocalFsBackend` (real filesystem), and `GitBackend` (isomorphic-git) need to be wired up as the actual persistence layer
- Database engine exists in `@cept/core` with tests, but the UI views (table, board, calendar, etc.) exist as components but aren't fully integrated with real data flow
- Knowledge graph components exist but use in-memory data
- Markdown parser exists but roundtrip serialization needs hardening
- Git, collaboration, desktop, and mobile code exists as implementations but hasn't been integration-tested with real backends

---

## 2. What Has Been Built

### 2.1 Packages Overview

| Package | Path | Lines | State |
|---------|------|-------|-------|
| `@cept/core` | `packages/core/` | ~5,000 | Real implementations: storage backends (BrowserFsBackend uses lightning-fs, GitBackend uses isomorphic-git), database engine, markdown parser, search index (TF-IDF), formula evaluator (hand-written lexer+parser), template engine, Git sync/commit/merge engines, GitHub OAuth. **Gap:** Graph builder missing (types only, no page scanner). GitBackend's `diff` has empty hunks. |
| `@cept/ui` | `packages/ui/` | ~10,000 | Real implementations: TipTap editor with all custom extensions, sidebar, all database view components, knowledge graph (D3 force-directed), slash menu, command palette, settings, conflict resolver, history viewer, repo picker, presence UI. **Gap:** App.tsx uses localStorage not StorageBackend. Database views, graph, git UI, collab UI not routed in app shell. Map view has no Leaflet — shows placeholder. |
| `@cept/web` | `packages/web/` | ~1,500 | Working Vite SPA (13-line main.tsx mounting App). PWA service worker. Deployed to GitHub Pages. |
| `@cept/desktop` | `packages/desktop/` | ~800 | ElectronBridge with IPC channel definitions, PlatformBridge interface, AutoUpdater. **Gap:** No Electron main process, no BrowserWindow, no preload script. Bridge exists but shell doesn't. |
| `@cept/mobile` | `packages/mobile/` | ~600 | MobileBridge interface, WebMobileBridge fallback, MobileAuth. **Gap:** No Capacitor project files, no iOS/Android folders. |
| `@cept/signaling` | `packages/signaling-server/` | ~400 | RoomManager (~257 lines) — complete room join/leave/disconnect, awareness broadcasting, sync message forwarding. **Gap:** No WebSocket server entry point (no HTTP listener). |
| `@cept/docs` | `docs/` | ~2,000 | 11 real Markdown docs (intro, quick-start, features, platform support, migration guides, shortcuts, roadmap, comparisons). Rendered in app as built-in docs space. |

### 2.2 What Works End-to-End Today

Open `bun run dev:web`, and you get a working note-taking app:
- Create/edit/delete pages with rich block editing
- Slash commands to insert any block type
- Sidebar navigation with page tree
- Favorites and recent pages
- Trash with restore
- Command palette search
- Full-text search
- Settings (auto-save, themes)
- Dark mode
- Mobile-responsive layout
- Data persists in localStorage across reloads

### 2.3 Key Architecture Already In Place

- **StorageBackend interface** (`packages/core/src/storage/backend.ts`) — the core abstraction
- **BackendCapabilities** pattern — UI checks `backend.capabilities.history` etc., never `backend.type`
- **Zustand stores** — workspace, page, editor, search, settings stores
- **TipTap extensions** — custom nodes for callout, toggle, columns, mermaid, math, etc.
- **D3 force-directed graph** — KnowledgeGraph component with physics simulation
- **Database engine** — schema, CRUD, filter, sort, group, formula evaluation
- **All 6 database view components** — table, board, calendar, map, gallery, list (as UI components)

### 2.4 Known Bugs & Architectural Issues

These were discovered during code audit and must be fixed early in Phase 2:

1. **App.tsx uses localStorage directly** — The core `App.tsx` reads/writes pages as JSON to localStorage instead of using the `StorageBackend` interface. Comments in the code say `// Future: backend.writeFile(...)`. This is the #1 issue.

2. **GitBackend hardcodes `node:fs`** — The `initialize()` method in `git-backend.ts` imports `node:fs` directly instead of using the injected filesystem backend. This means GitBackend breaks in the browser where `node:fs` doesn't exist.

3. **GitBackend `diff` returns empty hunks** — The diff method detects which files changed (added/modified/deleted) but always returns `hunks: []`. No line-level diff content.

4. **No graph builder in core** — `packages/core/src/graph/index.ts` is ~64 lines of type definitions only. There is no implementation that scans pages and extracts links/mentions/relations to build `GraphData`. The D3 graph component in UI is real but has no data source.

5. **Map view has no Leaflet** �� `MapView` component parses location data but renders a placeholder div saying "Map view" with a count instead of an actual Leaflet map. The `renderMap` prop is optional and defaults to nothing.

6. **CRDT layer is abstract** — `CollaborationProvider` manages sessions and reconnects through an injected `SyncTransport`, but there's no concrete Yjs/y-prosemirror binding anywhere in the codebase. The abstraction exists; the implementation doesn't.

7. **Signaling server has no entry point** — `RoomManager` is complete but there's no WebSocket server (no `Bun.serve()` or equivalent) that creates a listener and wires it to the RoomManager.

8. **Markdown parser drops inline formatting** — `extractText()` converts rich text to plain text, losing bold/italic/etc. markers. This affects search indexing and text display.

9. **Onboarding "Open a folder" and "Connect a Git repo" buttons** — Currently disabled with "coming soon" text. These need to be enabled when LocalFsBackend and GitBackend are wired up.

---

## 3. What Remains To Be Built

### 3.1 The Gap: localStorage → Real Backends

The single biggest piece of remaining work is replacing the localStorage persistence layer with the real storage backends:

1. **BrowserFsBackend** — Use `lightning-fs` (IndexedDB) for proper file-based storage in the browser. This is the zero-setup path.
2. **LocalFsBackend** — Use the File System Access API (or Node `fs` in Electron/desktop). This is the "Open Folder" experience.
3. **GitBackend** — Layer `isomorphic-git` on top of the filesystem backends. This enables history, sync, collaboration.

### 3.2 Feature Gaps (Organized by Phase)

See the full roadmap in Section 4, but the high-level gaps are:

| Area | Gap |
|------|-----|
| **Storage** | Real IndexedDB, filesystem, and Git backends replacing localStorage |
| **Data Persistence** | Markdown file roundtripping (not just in-memory blocks) |
| **Databases** | Full integration of DB engine → UI views with real data |
| **Knowledge Graph** | Real link extraction from pages, not sample data |
| **Templates** | Integration with storage backend (load/save .cept/templates/) |
| **Import/Export** | Notion ZIP and Obsidian vault importers need real file I/O |
| **Git** | Auto-commit, auto-branch, sync engine with real isomorphic-git |
| **Collaboration** | Yjs CRDTs wired to TipTap with real signaling server |
| **Desktop** | Electron/Electrobun shells tested and packaged |
| **Mobile** | Capacitor builds tested |
| **MCP Server** | New feature — expose Cept spaces to AI assistants |
| **Public Rendering** | New feature — read-only GitHub Pages renderer |

---

## 4. Revised Roadmap (Prioritized)

The roadmap has been reorganized from the original init.md's 10 phases into a more realistic 8-phase plan. The current state is documented in `docs/content/reference/roadmap.md`. **Phase 1 is complete. Phases 2-8 are planned.**

### Phase 2: Storage & Persistence (NEXT — Highest Priority)

This is the foundational work that everything else depends on. The core insight: **the backend implementations already exist and have tests**. The gap is wiring them to the app shell.

**Tasks:**
- P2.1: Fix known bugs — GitBackend `node:fs` hardcode, diff empty hunks, signaling server entry point
- P2.2: Harden Markdown parser/serializer roundtrip — fuzz-test with all block types, fix `extractText` inline formatting loss
- P2.3: **Replace App.tsx localStorage with BrowserFsBackend** — this is the keystone task. Wire workspace store → `BrowserFsBackend` → real Markdown files in virtual IndexedDB filesystem
- P2.4: Wire page CRUD to storage backend — `readFile('pages/...md')` → parse → editor; editor → serialize → `writeFile('pages/...md')`
- P2.5: Wire database persistence to storage backend — load/save `.cept/databases/*.yaml` through `StorageBackend`
- P2.6: Wire search index to storage backend — index real file contents, not localStorage JSON
- P2.7: Implement `LocalFsBackend` using File System Access API (browser `showDirectoryPicker()`) / Node `fs` (desktop)
- P2.8: Fix GitBackend to use injected filesystem (not hardcoded `node:fs`) — make it work on top of both BrowserFsBackend and LocalFsBackend
- P2.9: Multi-space support (create, switch, delete spaces)
- P2.10: Wire Notion importer UI — the importer logic exists, add a UI trigger (settings or onboarding)
- P2.11: Wire Obsidian importer UI — same, wire existing importer to a UI trigger
- P2.12: Wire exporter UI — connect existing export logic to a menu/action

### Phase 3: Databases (High Priority)

The database engine in `@cept/core` is complete (CRUD, filter, sort, group, formulas, relations, rollups all have tests). All 5 view components exist in `@cept/ui` (table ~282 LOC, board ~196 LOC, calendar ~256 LOC, gallery, list). **The gap is routing them into the app shell and connecting them to real data via StorageBackend.**

**Tasks:**
- P3.1: Add database navigation — create database button in sidebar, database list section, route to database views
- P3.2: Wire database engine to StorageBackend (already done in P2.5, validate it works)
- P3.3: Wire TableView to real database data — connect the existing component to the engine's CRUD/filter/sort
- P3.4: Wire BoardView to real data — connect drag-and-drop to engine updates
- P3.5: Wire CalendarView to real data — connect date properties, drag to reschedule
- P3.6: Wire GalleryView to real data
- P3.7: Wire ListView to real data
- P3.8: **Integrate Leaflet into MapView** — the component currently shows a placeholder; add the actual Leaflet + OpenStreetMap rendering
- P3.9: Add property type editors for all 18 types — `PropertyEditor` component exists but verify all types work
- P3.10: Wire relations & rollups to real cross-database data
- P3.11: Wire InlineDatabase TipTap extension to real database engine (extension exists)
- P3.12: Wire LinkedDatabaseView to real database engine (component exists)

### Phase 4: Knowledge Graph & Templates (Medium Priority)

The D3 KnowledgeGraph component is a real force-directed graph implementation (~400 LOC) with zoom, drag, global/local mode, depth slider, and color groups. The template engine is complete (~204 LOC) with variable substitution. **The gap: no graph builder exists to scan pages and extract links, and templates aren't accessible from the app.**

**Tasks:**
- P4.1: **Implement graph builder** in `packages/core/src/graph/` — scan all pages via StorageBackend, extract internal links from Markdown, extract `<!-- cept:mention -->` references, extract database relations, build `GraphData` (this is the biggest gap)
- P4.2: Wire KnowledgeGraph component into app shell — add route/panel to navigate to it
- P4.3: Implement backlinks panel (pages that link to the current page — derived from graph data)
- P4.4: Support `[[wiki-links]]` syntax in TipTap editor + Markdown parser
- P4.5: Graph filters UI already exists — verify it works with real graph data
- P4.6: Graph time-lapse animation — verify with real page creation dates
- P4.7: Wire template engine to StorageBackend (load/save `.cept/templates/`)
- P4.8: Add template gallery UI to app shell — "New from template" in sidebar
- P4.9: "Save as template" action on page context menu

### Phase 5: Git & Collaboration (Medium-High Priority)

All Git subsystem implementations exist in `@cept/core`: sync engine (~280 LOC), auto-commit (~200 LOC), merge engine (~250 LOC), branch strategy (~180 LOC), GitHub OAuth (~543 LOC). UI components for repo picker, conflict resolver, history viewer, avatar stack, cursor overlay all exist. **The gap: none of this is accessible from the app shell, and the CRDT layer has no concrete Yjs binding.**

**Tasks:**
- P5.1: Wire GitHub OAuth into app — enable the "Connect a Git repo" onboarding flow
- P5.2: Wire RepoPicker component into settings/onboarding
- P5.3: Wire auto-commit engine to the app — trigger on page saves when using GitBackend
- P5.4: Wire sync engine — pull on open, push after commit, periodic background sync
- P5.5: Wire HistoryViewer component into page context menu (requires GitBackend capabilities check)
- P5.6: Wire ConflictResolver UI into merge engine notifications
- P5.7: **Implement concrete Yjs binding** — create the actual y-prosemirror integration for TipTap, connecting the abstract CollaborationProvider to real Yjs documents
- P5.8: **Create signaling server entry point** — `Bun.serve()` WebSocket listener wiring to existing RoomManager
- P5.9: Wire AvatarStack and CursorOverlay to Yjs awareness
- P5.10: Wire OfflineQueue to sync engine reconnect logic
- P5.11: Add signaling server Dockerfile and self-hosting documentation

### Phase 6: Desktop & Mobile (Lower Priority)

ElectronBridge exists (~157 LOC) with IPC channel definitions. MobileBridge interface and WebMobileBridge fallback exist. **The gap: no Electron main process/BrowserWindow, no Capacitor project files.**

**Tasks:**
- P6.1: **Create Electron main process** — `main.ts` with BrowserWindow, preload script, IPC handlers connecting to ElectronBridge
- P6.2: Wire native "Open Folder" dialog → LocalFsBackend
- P6.3: Test Electron packaging (electron-builder) — `.exe`, `.dmg`, `.AppImage`
- P6.4: Electrobun shell — evaluate stability, implement if viable, fall back to Electron-only if not
- P6.5: System tray, deep linking, auto-updater (AutoUpdater implementation exists, wire it)
- P6.6: **Create Capacitor project** — `capacitor.config.ts`, iOS/Android project files, native plugin wiring
- P6.7: Test Capacitor iOS + Android builds
- P6.8: Mobile-specific UI polish (responsive UI already done, add native gestures)

### Phase 7: Polish & Ecosystem (Lower Priority)

**Tasks:**
- P7.1: Drag-and-drop page reordering in sidebar (real persistence)
- P7.2: Page cover images
- P7.3: Page icons (emoji picker + custom upload)
- P7.4: Undo/redo with proper history stack
- P7.5: Keyboard shortcut customization
- P7.6: Theming (custom colors, fonts beyond light/dark)
- P7.7: Plugin system architecture (`.cept/plugins/`)
- P7.8: API documentation (auto-generated from TypeScript)

### Phase 8: Integration & Public Rendering (New Features)

**Tasks:**
- P8.1: MCP server — expose Cept spaces to AI assistants (tools: CRUD pages/databases, search)
- P8.2: MCP resources — page content, database schemas, space metadata
- P8.3: MCP prompts — pre-built prompts for common tasks
- P8.4: GitHub Pages renderer — pre-built JS bundle for read-only public page rendering
- P8.5: Embeddable `<script>` tag for static site rendering
- P8.6: SEO-friendly server-rendered output
- P8.7: Custom domain support for published spaces

---

## 5. Detailed Phase Specifications

### 5.1 Phase 2 Deep Dive: Storage & Persistence

This is the most critical phase. Every subsequent feature depends on real file-based persistence.

#### P2.1: BrowserFsBackend with lightning-fs (IndexedDB)

**What:** Replace the current localStorage-based persistence with `lightning-fs`, which provides a POSIX-like filesystem API backed by IndexedDB. This is the zero-setup browser storage path.

**Why:** localStorage has a 5-10MB limit and no file/directory semantics. lightning-fs gives us a proper virtual filesystem that works with isomorphic-git.

**Implementation:**
- The existing `BrowserFsBackend` already uses `@isomorphic-git/lightning-fs` (~241 LOC). The issue is that `App.tsx` bypasses it and uses raw localStorage. Wire the existing backend implementation into the app.
- File paths follow the workspace layout from init.md Section 4.6
- Pages stored as Markdown files in `pages/`
- Databases stored as YAML in `.cept/databases/`
- Assets stored in `.cept/assets/`

**Ref:** init.md Sections 2.3, 5.10.1, 5.10.6

#### Storage Backend Tiers — Important Architecture Note

The storage system has three tiers that use different browser APIs:

1. **BrowserFsBackend (lightning-fs/IndexedDB)** — Virtual filesystem in IndexedDB. No user interaction needed. This is the zero-setup "Start writing" path. Data persists across sessions but is invisible to the user's real filesystem. This is also what isomorphic-git uses in the browser for its Git object store.

2. **LocalFsBackend (File System Access API)** — Uses the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) via `showDirectoryPicker()` to get a real `FileSystemDirectoryHandle` to a user-selected folder. Files are plain Markdown on the user's disk, editable with any text editor. Directory handles can be persisted to IndexedDB for re-requesting permission on return visits (see [Chrome persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)). This is the "Open Folder" experience.

3. **Origin Private File System (OPFS)** — An alternative browser-native filesystem via `navigator.storage.getDirectory()`. Unlike lightning-fs, this is a real browser-native filesystem with synchronous access in Web Workers. Consider using OPFS as an alternative to lightning-fs for better performance, especially for Git operations that benefit from synchronous I/O. **Research whether isomorphic-git can use OPFS** — if so, this may be a better foundation than lightning-fs for BrowserFsBackend. See [web.dev OPFS article](https://web.dev/articles/origin-private-file-system) and [MDN OPFS docs](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

**Ref:** [Stack Overflow: File System Access API](https://stackoverflow.com/a/67352361), [Chrome File System Access docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)

#### P2.2: Markdown Roundtrip

**What:** The parser in `packages/core/src/markdown/parser.ts` needs to be battle-tested for roundtrip fidelity: parse a Markdown file into a Block tree, serialize back to Markdown, and get the same file content.

**Why:** If roundtripping is lossy, user data gets corrupted on every save.

**Key concerns:**
- `<!-- cept:block -->` HTML comments must be preserved exactly
- YAML front matter must survive roundtrip
- GFM extensions (tables, task lists, strikethrough) must be handled
- Whitespace sensitivity (indentation in lists, blank lines between blocks)

**Ref:** init.md Section 4.1-4.2

#### P2.3-P2.5: Storage Integration

**What:** Replace the Zustand stores' direct localStorage access with `StorageBackend` calls.

**Flow:**
1. App boots → creates `BrowserFsBackend` instance
2. Workspace store calls `backend.listDirectory('pages/')` to discover pages
3. Page store calls `backend.readFile('pages/my-page.md')` → parse Markdown → populate editor
4. Editor changes → serialize to Markdown → `backend.writeFile('pages/my-page.md', data)`
5. Database store calls `backend.readFile('.cept/databases/tasks.yaml')` → parse YAML

**Ref:** init.md Section 5.10.6

#### P2.6: LocalFsBackend (File System Access API / Node fs)

**What:** Enable the "Open Folder" experience where users point Cept at a directory on disk.

**Browser implementation — File System Access API:**
- Use `window.showDirectoryPicker()` to prompt the user to select a folder
- Returns a `FileSystemDirectoryHandle` — use it for all file I/O
- **Persist the handle to IndexedDB** so the user doesn't have to re-pick on every visit
- On return visit, retrieve the handle from IndexedDB and call `handle.requestPermission({ mode: 'readwrite' })` — the browser will show a re-authorization prompt
- Use `FileSystemDirectoryHandle.getFileHandle()`, `getDirectoryHandle()`, etc. for navigation
- Use `FileSystemWritableFileStream` for writing
- This is Chromium-only for now (Chrome, Edge, Opera). Firefox and Safari support OPFS but not the picker API. Degrade gracefully.

**Desktop implementation — Node fs:**
- Use Node `fs` via Electron/Electrobun IPC through the `PlatformBridge`
- The `ElectronBridge` already has IPC channel stubs for this

**Key rule:** Opening a folder MUST NOT modify existing files unless the user explicitly edits them in Cept. Only the `.cept/` metadata directory is created automatically.

**Ref:** init.md Sections 5.10.1, 5.10.4 (Flow 2, Flow 5), [Chrome File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [MDN File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)

#### P2.7: GitBackend

**What:** Layer `isomorphic-git` on top of `BrowserFsBackend` or `LocalFsBackend` to add Git operations.

**Ref:** init.md Sections 6.1-6.6 for full Git operation specifications

### 5.2 Phase 3 Deep Dive: Databases

The database engine in `@cept/core` already implements CRUD, filter, sort, group, and formulas. The gap is wiring it to real storage and completing the UI integration.

**Data format:** init.md Section 4.3 (YAML schema)
**Property types:** init.md Section 4.4 (all 18 types)
**View types:** init.md Section 4.5 (table, board, calendar, map, gallery, list)

### 5.3 Phase 5 Deep Dive: Git & Collaboration

**Auto-commit:** init.md Section 6.2
**Auto-branch:** init.md Section 6.3
**Conflict resolution:** init.md Section 6.4 (graduated strategy: CRDT → section → LWW → UI)
**Sync engine:** init.md Section 6.5
**Signaling server:** init.md Section 6.6
**Auth:** init.md Section 7

### 5.4 Phase 8 Deep Dive: MCP Server & Public Rendering

These are **new features** not in the original init.md. Specifications from `docs/content/reference/roadmap.md`:

**MCP Server:**
- Tools: CRUD pages, CRUD database records, search across spaces, manage properties/views
- Resources: page content, database schemas, space metadata
- Prompts: "summarize this page", "create meeting notes page", etc.

**GitHub Pages Renderer:**
- Pre-built JS bundle that renders Cept Markdown files as read-only pages
- Drop-in `<script>` tag — zero build step
- Full Cept UI in read-only mode (sidebar, search, all block types)
- Works with any public Git-backed Cept space

---

## 6. Autonomous Development Protocol

### 6.1 The Development Loop

For EVERY task, follow this loop rigorously. **Do not skip steps. Do not batch multiple tasks without completing the loop for each.**

```
┌─────────────────────────────────────────────────┐
│  1. SPEC & RESEARCH                             │
│     • Read the relevant spec (init.md section)  │
│     • Research library APIs you'll use           │
│     • Check existing code for patterns           │
│     • Write/update feature spec if needed        │
├─────────────────────────────────────────────────┤
│  2. RED — Write Failing Tests First              │
│     • Write unit tests for the new function/class│
│     • Write component tests for new UI           │
│     • Write E2E test if user-facing feature      │
│     • Confirm tests FAIL (red)                   │
├─────────────────────────────────────────────────┤
│  3. GREEN — Implement Minimum Code               │
│     • Write the minimum code to pass tests       │
│     • Don't over-engineer, don't gold-plate      │
│     • Stay focused on the current task only      │
├─────────────────────────────────────────────────┤
│  4. REFACTOR                                     │
│     • Clean up code while tests stay green       │
│     • Extract shared logic if repeated 3+ times  │
│     • Ensure TypeScript strict compliance        │
├─────────────────────────────────────────────────┤
│  5. VALIDATE                                     │
│     • Run: bun run lint                          │
│     • Run: bun run typecheck                     │
│     • Run: bun run test                          │
│     • ALL must pass. If not, fix before moving on│
├─────────────────────────────────────────────────┤
│  6. REVIEW                                       │
│     • Self-review: Does this match the spec?     │
│     • Check architecture rules (Section 9)       │
│     • Check for any `any` types introduced       │
│     • Check for security issues                  │
│     • Update feature spec status if applicable   │
├─────────────────────────────────────────────────┤
│  7. COMMIT & PUSH                                │
│     • git add <specific files>                   │
│     • git commit with descriptive message + task │
│     • git push to preserve work                  │
│     • Update TASKS.md to mark task complete      │
├─────────────────────────────────────────────────┤
│  8. NEXT TASK — loop back to step 1              │
└─────────────────────────────────────────────────┘
```

### 6.2 The Self-Evaluation Checklist

After EVERY commit, ask yourself:

- [ ] Does `bun run validate` pass? (lint + typecheck + test)
- [ ] Did I write tests BEFORE implementation? (TDD discipline)
- [ ] Does the implementation match the spec in init.md?
- [ ] Did I check `backend.capabilities` instead of `backend.type`?
- [ ] Did I import only through the `StorageBackend` interface (not specific backends)?
- [ ] Is there any `any` type or `@ts-ignore`?
- [ ] Is there any platform-specific import in `@cept/core` or `@cept/ui`?
- [ ] Did I add proper error handling for user-facing operations?
- [ ] Would this work with `BrowserFsBackend` alone (no Git, no filesystem)?

### 6.3 Research-Before-Assumption Rule

**Before implementing anything non-trivial:**

1. **Read the relevant init.md section** — it has specific requirements
2. **Read existing code** — check how similar features were implemented
3. **Research the library API** — don't guess, verify the API exists
4. **Document findings** — add a "Research:" comment for non-obvious decisions

### 6.4 When to Ask for Help

If you encounter:
- An ambiguous requirement in the spec
- A library limitation that prevents the specified approach
- A test that seems impossible to make pass
- An architecture decision that contradicts the rules

**Don't guess. Don't hack around it.** State the problem clearly and ask for guidance.

---

## 7. Quality Gates & Self-Evaluation

### 7.1 Per-Task Gate

Every task must pass before moving to the next:
```bash
bun run lint       # Zero errors
bun run typecheck  # Zero errors
bun run test       # All tests pass, no regressions
```

### 7.2 Per-Phase Gate

Before starting a new phase, run the full `/phase-gate` command:
1. All tasks in the current phase marked `[x]` in TASKS.md
2. `bun run validate` passes
3. No TODO/FIXME comments related to the completed phase
4. Feature specs updated to "Implemented" or "Verified" status
5. E2E tests capture screenshots for documentation
6. Commit with `milestone: complete Phase X` message
7. Push to remote

### 7.3 Regression Prevention

- **Never delete existing tests** (unless the feature they test was intentionally removed)
- **If a test breaks**, fix the code, not the test (unless the test was wrong)
- **Run the full test suite** after every change, not just the tests for the file you changed
- **If the test count goes DOWN**, explain why in the commit message

### 7.4 Test Writing Standards

```typescript
// Unit test pattern
describe("BrowserFsBackend", () => {
  describe("readFile", () => {
    it("should return file contents as Uint8Array", async () => {
      // Arrange
      const backend = new BrowserFsBackend();
      await backend.initialize({ name: "test" });
      await backend.writeFile("test.md", new TextEncoder().encode("# Hello"));

      // Act
      const result = await backend.readFile("test.md");

      // Assert
      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result!)).toBe("# Hello");
    });

    it("should return null for non-existent files", async () => {
      const backend = new BrowserFsBackend();
      await backend.initialize({ name: "test" });
      const result = await backend.readFile("nope.md");
      expect(result).toBeNull();
    });
  });
});

// E2E test pattern (with screenshots)
test("creating a page with slash commands", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "docs/screenshots/slash-menu-01-empty.png" });

  await page.click('[data-testid="new-page"]');
  await page.keyboard.type("/heading1");
  await page.screenshot({ path: "docs/screenshots/slash-menu-02-filtered.png" });

  await page.keyboard.press("Enter");
  await page.keyboard.type("My New Page");
  await page.screenshot({ path: "docs/screenshots/slash-menu-03-inserted.png" });
});
```

---

## 8. Session Management

### 8.1 Session Start Protocol

When starting a new session with this prompt:

1. **Read `CLAUDE.md`** for project knowledge and commands
2. **Read `TASKS.md`** to find the current phase and next task
3. **Read `docs/content/reference/roadmap.md`** for the current roadmap
4. **Run `bun run validate`** to verify repo health
5. **If validation fails**, fix issues before starting new work
6. **Announce** what you're going to work on
7. **Begin the development loop** (Section 6.1)

### 8.2 Updating TASKS.md

The current `TASKS.md` has all original tasks marked complete. **Create a new task section** for the continuation phases:

```markdown
## Phase 2: Storage & Persistence (Continuation)

- [ ] P2.1: Implement BrowserFsBackend with lightning-fs (IndexedDB)
- [ ] P2.2: Harden Markdown parser/serializer roundtrip
...
```

### 8.3 Committing and Pushing

- **Commit after EVERY completed task** — don't batch
- **Push after EVERY commit** — ephemeral containers lose uncommitted work
- **Commit message format:** `feat(<scope>): <description> [P<X>.<Y>]`
- **If interrupted mid-task:** commit WIP to a `wip/P<X>.<Y>` branch and push

### 8.4 Multi-Session Continuity

All work happens on `main`. Push frequently. Each session:
1. `git pull` to get latest
2. Check for `wip/` branches → rebase onto main, merge, delete
3. Read TASKS.md → find next task
4. Continue

---

## 9. Critical Architecture Rules

These rules are **inviolable**. Read init.md Section 2.4 and Section 5.10.6 for full context.

1. **`@cept/ui` and `@cept/core` must NEVER import platform-specific modules** (electron, @capacitor/*, node:fs)
2. **All persistence goes through `StorageBackend`** — never read/write files directly
3. **`@cept/core` and `@cept/ui` depend ONLY on `StorageBackend` interface**, never on a specific implementation
4. **Git-specific UI is gated by `backend.capabilities`**, never by `backend.type === "git"`
5. **No module outside `GitBackend` may import `isomorphic-git`**
6. **The app MUST boot to fully functional state with `BrowserFsBackend` alone** — zero Git, zero filesystem
7. **All auth goes through `AuthProvider` abstraction**
8. **Prefer isomorphic-git over GitHub API** for Git operations
9. **Markdown files use `<!-- cept:block -->` HTML comments** for extended blocks
10. **Database schemas are YAML files** in `.cept/databases/`
11. **Opening a local folder MUST NOT modify existing files** unless the user explicitly edits them

---

## 10. Reference Documents

### 10.1 Must-Read Before Starting

| Document | Location | What It Contains |
|----------|----------|-----------------|
| **Init prompt** | `.claude/prompts/init.md` | Full spec: architecture, data model, feature requirements, testing strategy |
| **CLAUDE.md** | `CLAUDE.md` | Project knowledge, key commands, architecture rules |
| **TASKS.md** | `TASKS.md` | Task tracker — update this as you work |
| **Roadmap** | `docs/content/reference/roadmap.md` | Current phase status and planned features |

### 10.2 Key init.md Sections by Phase

| Phase | Relevant init.md Sections |
|-------|--------------------------|
| Phase 2 (Storage) | 2.3 (libraries), 2.4 (abstractions), 4.1-4.7 (data model), 5.10 (storage backends) |
| Phase 3 (Databases) | 4.3-4.5 (schema, property types, views), 5.1 (editor DB blocks) |
| Phase 4 (Graph) | 5.8 (knowledge graph spec with D3/3d-force-graph details) |
| Phase 5 (Git) | 6.1-6.6 (Git ops, auto-commit, branching, conflicts, sync), 7 (auth) |
| Phase 6 (Desktop/Mobile) | 8.1-8.5 (platform specs, NativeShell) |
| Phase 7 (Polish) | 5.2-5.5 (sidebar, pages, templates, command palette) |
| Phase 8 (MCP/Rendering) | roadmap.md Phase 8 section |

### 10.3 Key Source Files

| File | Purpose |
|------|---------|
| `packages/core/src/storage/backend.ts` | `StorageBackend` interface + `BackendCapabilities` |
| `packages/core/src/storage/browser-fs.ts` | Current BrowserFsBackend (needs lightning-fs upgrade) |
| `packages/core/src/storage/git-backend.ts` | Current GitBackend (needs real isomorphic-git) |
| `packages/core/src/database/engine.ts` | Database engine (CRUD, filter, sort, group) |
| `packages/core/src/markdown/parser.ts` | Markdown ↔ Block tree parser |
| `packages/core/src/search/index.ts` | Search index |
| `packages/core/src/graph/index.ts` | Knowledge graph builder |
| `packages/ui/src/stores/` | Zustand stores (workspace, page, editor, settings) |
| `packages/ui/src/components/editor/CeptEditor.tsx` | TipTap editor wrapper |
| `packages/ui/src/components/sidebar/Sidebar.tsx` | Navigation sidebar |

### 10.4 Testing Infrastructure

| Tool | Config | Purpose |
|------|--------|---------|
| Vitest | `packages/*/vitest.config.ts` | Unit + integration tests |
| Playwright | `e2e/playwright.config.ts` | E2E tests |
| @amiceli/vitest-cucumber | `features/` | BDD Gherkin feature files |

### 10.5 CI/CD

| Workflow | Path | Triggers |
|----------|------|----------|
| CI | `.github/workflows/ci.yml` | Push, PR |
| Preview Deploy | `.github/workflows/preview-deploy.yml` | PR |
| Release Desktop | `.github/workflows/release-desktop.yml` | Release published |
| Release Web | `.github/workflows/release-web.yml` | Release published |
| Release Mobile | `.github/workflows/release-mobile.yml` | Release published |

---

## 11. Installed Plugins & Ralph Loop Requirement

### 11.1 Installed Plugins

The following plugins are configured in `.claude/settings.json`:

1. **ralph-wiggum** (from `claude-plugins-official`) — Provides `/ralph-loop` and `/cancel-ralph` commands for iterative autonomous development loops
2. **scm-utils** (from `nsheaps/ai-mktpl`) — Provides `/commit`, `/update-branch` commands and auth-user skill for git workflow automation
3. **git-spice** (from `nsheaps/ai-mktpl`) — Manages stacked Git branches with the `gs` CLI

### 11.2 Ralph Loop Requirement

**A Ralph loop MUST be used for each phase of development.** The Ralph loop is the mechanism by which the agent runs autonomously, iterating on the same task until it is satisfactorily completed.

**How to use:**
```
/ralph-loop "Complete Phase 2 tasks P2.1 through P2.4. For each task: read the spec, write failing tests, implement, refactor, validate with bun run validate, self-review against architecture rules, commit and push. Stop when all 4 tasks pass validation." --max-iterations 20 --completion-promise "PHASE_2_BATCH_COMPLETE"
```

**Ralph loop rules for this project:**
1. Each Ralph iteration must complete at least one sub-task or make meaningful progress
2. The completion promise should only be output when ALL tasks in the batch pass `bun run validate`
3. If an iteration fails validation, the next iteration must fix the issue before proceeding
4. Use `--max-iterations` as a safety net (20 iterations per batch of 3-4 tasks)
5. After the Ralph loop completes, verify the full test suite still passes

**Recommended batching for Ralph loops:**
- Phase 2: Run 3 Ralph loops (P2.1-P2.4, P2.5-P2.8, P2.9-P2.12)
- Phase 3: Run 2 Ralph loops (P3.1-P3.6, P3.7-P3.12)
- Phase 4: Run 2 Ralph loops (P4.1-P4.5, P4.6-P4.9)
- Phase 5: Run 2 Ralph loops (P5.1-P5.6, P5.7-P5.11)
- Phases 6-8: Size Ralph loops based on task complexity

### 11.3 SCM-Utils Review Process

Use the scm-utils plugin's review process for all commits:
- Use `/commit` from scm-utils instead of manual `git add && git commit` — it handles staging, message generation, and validation
- Use `/update-branch` when rebasing or updating the working branch

---

## Appendix: Quick Start for a New Session

```
1. Read this prompt (you're doing it now)
2. Read CLAUDE.md
3. Read TASKS.md — find the next incomplete task
4. Run: bun run validate
5. If green: start the development loop (Section 6.1)
6. If red: fix issues first
7. Start a Ralph loop for the current batch of tasks
8. After Ralph loop completes, verify and push
```

**The first task should be P2.1: Fix known bugs.** This cleans up architectural issues before wiring the real storage backends.
