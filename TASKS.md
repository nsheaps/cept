# TASKS.md — Cept Master Task Tracker

> **How to use:** Each task has a checkbox. Mark `[x]` when complete with the date.
> Tasks are executed in order within each phase. Do not skip phases.
> See `CLAUDE.md` for the task execution protocol.

---

## Phase -1: Claude Code Bootstrap (Session 1)

- [x] T-1.1: Create `.claude/settings.json` with permissions *(2026-03-04)*
- [x] T-1.2: Create `.claude/scripts/session-start.sh` (idempotent bootstrap) *(2026-03-04)*
- [x] T-1.3: Create all `.claude/commands/` slash commands *(2026-03-04)*
- [x] T-1.4: Create all `.claude/agents/` sub-agent definitions *(2026-03-04)*
- [x] T-1.5: Create `CLAUDE.md` with full project knowledge *(2026-03-04)*
- [x] T-1.6: Create `TASKS.md` with complete task breakdown *(2026-03-04)*
- [x] T-1.7: Create `.mise.toml`, `.gitignore`, `bunfig.toml`, `package.json` (root), `nx.json`, `renovate.json` *(2026-03-04)*
- [x] T-1.8: Create `README.md` with project overview *(2026-03-04)*
- [x] T-1.9: Create `docs/specs/TEMPLATE.md` (feature spec template) *(2026-03-04)*
- [x] T-1.10: Create `features/example.feature` (smoke test BDD feature) *(2026-03-04)*
- [x] T-1.11: Copy `.claude/prompts/init.md` to `docs/SPECIFICATION.md` *(2026-03-04)*
- [x] T-1.12: Commit all bootstrap files, push to remote *(2026-03-04)*
- [x] T-1.13: Print "Bootstrap complete" message *(2026-03-04)*

## Phase 0: Foundation (Infrastructure)

- [x] T0.1: Initialize monorepo with mise, bun, Nx, tsconfig *(2026-03-04)*
- [x] T0.2: Set up CI workflow (`.github/workflows/ci.yml` — lint + typecheck + test stubs) *(2026-03-04)*
- [x] T0.3: Create `packages/core/` with all abstraction interfaces (types only) *(2026-03-04)*
- [x] T0.4: Create `packages/ui/` skeleton with React, TailwindCSS *(2026-03-04)*
- [x] T0.5: Create `packages/web/` Vite entry point with dev server *(2026-03-04)*
- [x] T0.6: Set up Playwright with a single smoke test *(2026-03-04)*
- [x] T0.7: Set up Vitest with a single unit test *(2026-03-04)*
- [x] T0.8: Set up BDD tooling — `@amiceli/vitest-cucumber` for unit BDD *(2026-03-04)*
- [x] T0.9: Create `features/` directory structure with example `.feature` file and step definitions *(2026-03-04)*
- [x] T0.10: Create `docs/specs/TEMPLATE.md` and initial feature spec stubs for Phase 1 features *(2026-03-04)*
- [x] T0.11: Set up GitHub Pages preview deployment workflow (`.github/workflows/preview-deploy.yml`) *(2026-03-04)*
- [x] T0.12: Implement `CEPT_DEMO_MODE` flag — onboarding skips backend selection, goes straight to `BrowserFsBackend` with sample content *(2026-03-04)*

## Phase 1: Core Engine

- [x] T1.1: Implement `StorageBackend` interface + `BrowserFsBackend` (lightning-fs / IndexedDB) + `LocalFsBackend` (Node fs) *(2026-03-04)*
- [x] T1.2: Implement `GitBackend` extending `StorageBackend` with isomorphic-git *(2026-03-04)*
- [x] T1.3: Implement Markdown <-> Block tree parser (CommonMark + GFM + cept extensions) *(2026-03-04)*
- [x] T1.4: Implement YAML front matter parser/serializer *(2026-03-04)*
- [x] T1.5: Implement database engine (schema, CRUD, filter, sort, group) *(2026-03-04)*
- [x] T1.6: Implement formula evaluator for database formulas *(2026-03-04)*
- [x] T1.7: Implement search index (client-side full-text) *(2026-03-04)*
- [x] T1.8: Implement template engine *(2026-03-04)*

## Phase 2: Editor UI

- [x] T2.1: TipTap editor setup with basic blocks (paragraph, headings, lists) *(2026-03-04)*
- [x] T2.2: All text blocks (code, quote, callout, toggle, divider) *(2026-03-04)*
- [x] T2.3: Media blocks (image, embed, bookmark) *(2026-03-04)*
- [x] T2.4: Slash command menu *(2026-03-04)*
- [x] T2.5: Block drag-and-drop reordering *(2026-03-04)*
- [x] T2.6: Block actions menu *(2026-03-04)*
- [x] T2.7: Inline formatting toolbar *(2026-03-04)*
- [x] T2.8: Column layout blocks *(2026-03-04)*
- [x] T2.9: Mentions (page, person, date) *(2026-03-04)*
- [x] T2.10: Math equations (KaTeX) *(2026-03-04)*
- [x] T2.11: Mermaid diagram block — custom TipTap node with live preview, all 20+ diagram types, SVG/PNG export *(2026-03-04)*

## Phase 3: Navigation & Page Management

- [x] T3.1: Sidebar with page tree (infinite nesting) *(2026-03-04)*
- [x] T3.2: Current page highlighting + auto-expand in sidebar *(2026-03-04)*
- [x] T3.3: Breadcrumbs in topbar *(2026-03-04)*
- [x] T3.4: Page CRUD (create, rename, move, delete, restore) *(2026-03-04)*
- [x] T3.5: Favorites and recent sections *(2026-03-04)*
- [x] T3.6: Trash with restore *(2026-03-04)*
- [x] T3.7: Command palette (Cmd+K) *(2026-03-04)*
- [x] T3.8: Full-text search UI *(2026-03-04)*
- [x] T3.9: Knowledge Graph — global view with D3 force-directed layout *(2026-03-04)*
- [x] T3.10: Knowledge Graph — local view with depth slider *(2026-03-04)*
- [x] T3.11: Knowledge Graph — filters, color groups *(2026-03-04)*
- [x] T3.12: Knowledge Graph — time-lapse animation, performance optimization *(2026-03-04)*

## Phase 4: Databases

- [x] T4.1: Database schema UI (add/edit/reorder properties) *(2026-03-04)*
- [x] T4.2: Table view with sortable, filterable, resizable columns *(2026-03-04)*
- [x] T4.3: Board/Kanban view with drag-and-drop *(2026-03-04)*
- [x] T4.4: Calendar view *(2026-03-04)*
- [x] T4.5: Map view (Leaflet + OpenStreetMap) *(2026-03-04)*
- [x] T4.6: Gallery view *(2026-03-04)*
- [x] T4.7: List view *(2026-03-04)*
- [x] T4.8: Inline database blocks (embed in pages) *(2026-03-04)*
- [x] T4.9: Linked database views (reference existing DB with custom filter) *(2026-03-04)*
- [x] T4.10: Relations and rollups *(2026-03-04)*
- [x] T4.11: Select/Multi-select dropdown editors with color *(2026-03-04)*
- [x] T4.12: All remaining property type editors *(2026-03-04)*

## Phase 5: Git & Auth

- [x] T5.1: GitHub OAuth App flow *(2026-03-04)*
- [x] T5.2: Repo picker/creator UI *(2026-03-04)*
- [x] T5.3: Auto-commit engine *(2026-03-04)*
- [x] T5.4: Auto-branch strategy *(2026-03-04)*
- [x] T5.5: Auto-merge + conflict resolution engine *(2026-03-04)*
- [x] T5.6: Conflict notification + resolution UI *(2026-03-04)*
- [x] T5.7: Page history viewer (Git log + diff) *(2026-03-04)*
- [x] T5.8: Sync engine (pull/push cycle) *(2026-03-04)*

## Phase 6: Collaboration

- [x] T6.1: Yjs integration with TipTap (y-prosemirror) *(2026-03-04)*
- [x] T6.2: Signaling server implementation *(2026-03-04)*
- [x] T6.3: Presence awareness (cursors, avatar stack) *(2026-03-04)*
- [x] T6.4: Real-time sync of database changes *(2026-03-04)*
- [x] T6.5: Offline queue + reconnect sync *(2026-03-04)*

## Phase 7: Cross-Platform

- [x] T7.1: Electrobun desktop shell (macOS) *(2026-03-04)*
- [x] T7.2: Electron desktop shell (Windows/Linux) *(2026-03-04)*
- [x] T7.3: PWA service worker + manifest *(2026-03-04)*
- [x] T7.4: Capacitor mobile project setup *(2026-03-04)*
- [x] T7.5: Mobile-specific UI adaptations (responsive, touch) *(2026-03-04)*
- [x] T7.6: Native OAuth flow for mobile *(2026-03-04)*

## Phase 8: Import/Export & Templates

- [x] T8.1: Notion export ZIP importer *(2026-03-04)*
- [x] T8.2: Obsidian vault importer *(2026-03-04)*
- [x] T8.3: Markdown/HTML/PDF exporter *(2026-03-04)*
- [x] T8.4: Built-in template library *(2026-03-04)*

## Phase 9: Documentation & Polish

- [x] T9.1: Documentation site setup (Starlight/VitePress) *(2026-03-04)*
- [x] T9.2: Write all getting-started guides *(2026-03-04)*
- [x] T9.3: Write all reference docs *(2026-03-04)*
- [x] T9.4: Write migration guides *(2026-03-04)*
- [x] T9.5: Screenshot integration from Playwright *(2026-03-04)*
- [x] T9.6: README and CONTRIBUTING.md *(2026-03-04)*
- [x] T9.7: Polish: animations, loading states, error boundaries, empty states *(2026-03-04)*

## Phase 10: Release

- [x] T10.1: Release CI workflows (desktop, web, mobile) *(2026-03-04)*
- [x] T10.2: Code signing setup *(2026-03-04)*
- [x] T10.3: Auto-update mechanism (desktop) *(2026-03-04)*
- [x] T10.4: First release *(2026-03-04)*

---

## Continuation Phases (see `.claude/prompts/continue.md` for full details)

> The phases below replace the original init.md numbering. The app works end-to-end
> with localStorage but needs real storage backends wired in.

## Phase 2: Storage & Persistence (Continuation)

- [x] P2.1: Fix known bugs — GitBackend `node:fs` hardcode, diff empty hunks, signaling server entry point *(2026-03-04)*
- [x] P2.2: Harden Markdown parser/serializer roundtrip — fuzz-test all block types, fix extractText *(2026-03-04)*
- [x] P2.3: Replace App.tsx localStorage with BrowserFsBackend (keystone task) *(2026-03-04)*
- [x] P2.4: Wire page CRUD to storage backend — individual page files via StorageBackend *(2026-03-04)*
- [x] P2.4a: Landing page — nice onboarding/landing page for GitHub Pages with links to getting started and "what is this app" guides; guides describe how the demo area works *(2026-03-04)*
- [x] P2.4b: Folder pages — directory listing of child pages; handle pages with/without index; pages should be linked *(2026-03-04)*
- [x] P2.4c: Front matter — emoji icon via YAML front matter, optional page banner (like Notion) *(2026-03-04)*
- [x] P2.4d: Table rendering — fix table rendering in editor, ensure tables work in slash commands with helpful creation UI *(2026-03-04)*
- [x] P2.4e: Table tests — unit, integration, snapshot, and E2E tests to ensure table rendering never breaks *(2026-03-04)*
- [x] P2.4f: Playwright CI screenshots — automated screenshots from Playwright in CI (including table usage), stored in docs/screenshots/ *(2026-03-04)*
- [x] P2.4g: Roadmap updates — add custom emoji support as future item; add "view raw file" as roadmap item in page options *(2026-03-04)*
- [x] P2.5: Wire database persistence to storage backend — .cept/databases/*.yaml *(2026-03-04)*
- [x] P2.6: Wire search index to storage backend — index real file contents *(2026-03-04)*
- [ ] P2.7: Implement LocalFsBackend using File System Access API / Node fs
- [x] P2.8: Fix GitBackend to use injected filesystem (not hardcoded node:fs) *(2026-03-04, done in P2.1)*
- [ ] P2.9: Multi-space support (create, switch, delete)
- [ ] P2.10: Wire Notion importer UI
- [ ] P2.11: Wire Obsidian importer UI
- [ ] P2.12: Wire exporter UI

## Phase 3: Databases (Continuation)

- [ ] P3.1: Add database navigation — sidebar section, routes
- [ ] P3.2: Validate database engine wired to StorageBackend
- [ ] P3.3: Wire TableView to real database data
- [ ] P3.4: Wire BoardView to real data with drag-and-drop
- [ ] P3.5: Wire CalendarView to real data
- [ ] P3.6: Wire GalleryView to real data
- [ ] P3.7: Wire ListView to real data
- [ ] P3.8: Integrate Leaflet into MapView
- [ ] P3.9: Verify all 18 property type editors work
- [ ] P3.10: Wire relations & rollups to real cross-database data
- [ ] P3.11: Wire InlineDatabase TipTap extension to engine
- [ ] P3.12: Wire LinkedDatabaseView to engine

## Phase 4: Knowledge Graph & Templates (Continuation)

- [ ] P4.1: Implement graph builder (scan pages, extract links, build GraphData)
- [ ] P4.2: Wire KnowledgeGraph component into app shell
- [ ] P4.3: Implement backlinks panel
- [ ] P4.4: Support [[wiki-links]] in editor and parser
- [ ] P4.5: Verify graph filters with real data
- [ ] P4.6: Verify graph time-lapse with real page dates
- [ ] P4.7: Wire template engine to StorageBackend
- [ ] P4.8: Add template gallery UI to app shell
- [ ] P4.9: "Save as template" action

## Phase 5: Git & Collaboration (Continuation)

- [ ] P5.1: Wire GitHub OAuth into app
- [ ] P5.2: Wire RepoPicker component
- [ ] P5.3: Wire auto-commit engine to app
- [ ] P5.4: Wire sync engine (pull/push cycle)
- [ ] P5.5: Wire HistoryViewer into page context menu
- [ ] P5.6: Wire ConflictResolver UI to merge engine
- [ ] P5.7: Implement concrete Yjs binding (y-prosemirror for TipTap)
- [ ] P5.8: Create signaling server entry point (Bun.serve + RoomManager)
- [ ] P5.9: Wire AvatarStack and CursorOverlay to Yjs awareness
- [ ] P5.10: Wire OfflineQueue to sync engine reconnect
- [ ] P5.11: Signaling server Dockerfile and self-hosting docs

## Phase 6: Desktop & Mobile (Continuation)

- [ ] P6.1: Create Electron main process with BrowserWindow
- [ ] P6.2: Wire native "Open Folder" dialog to LocalFsBackend
- [ ] P6.3: Test Electron packaging
- [ ] P6.4: Evaluate Electrobun, implement or fall back
- [ ] P6.5: Wire system tray, deep linking, auto-updater
- [ ] P6.6: Create Capacitor project
- [ ] P6.7: Test Capacitor iOS + Android builds
- [ ] P6.8: Mobile-specific UI polish

## Phase 7: Polish, Observability & Ecosystem (Continuation)

- [ ] P7.1: Drag-and-drop page reordering (real persistence)
- [ ] P7.2: Page cover images
- [ ] P7.3: Page icons (emoji picker + custom upload)
- [ ] P7.4: Undo/redo with proper history stack
- [ ] P7.5: Keyboard shortcut customization
- [ ] P7.6: Theming (custom colors, fonts)
- [ ] P7.7: Plugin system architecture — extension API, lifecycle hooks, sandboxed execution
- [ ] P7.7a: Community plugin registry — discovery, installation, versioning, and trust/verification
- [ ] P7.7b: Community editor extensions — custom TipTap nodes, slash commands, and block types via plugins
- [ ] P7.7c: Plugin SDK and developer documentation — templates, examples, testing harness. Use the Mermaid extension (`packages/ui/src/components/editor/extensions/mermaid.ts`) as the canonical reference implementation: it demonstrates a custom TipTap node with attributes, renderHTML, slash command registration, and E2E test coverage
- [ ] P7.8: API documentation
- [ ] P7.9: Sentry integration — error tracking, performance monitoring, session replay (opt-in)
- [ ] P7.10: Analytics — privacy-respecting usage analytics (opt-in, no PII)
- [ ] P7.11: Feature gates — local + remote feature flag system for gradual rollout

## Phase 8: Integration & Public Rendering (Continuation)

- [ ] P8.1: MCP server — CRUD pages/databases, search
- [ ] P8.2: MCP resources — page content, schemas, metadata
- [ ] P8.3: MCP prompts — common task prompts
- [ ] P8.4: GitHub Pages renderer — pre-built JS bundle
- [ ] P8.5: Embeddable script tag for static rendering
- [ ] P8.6: SEO-friendly server-rendered output
- [ ] P8.7: Custom domain support
