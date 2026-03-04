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

- [ ] T9.1: Documentation site setup (Starlight/VitePress)
- [ ] T9.2: Write all getting-started guides
- [ ] T9.3: Write all reference docs
- [ ] T9.4: Write migration guides
- [ ] T9.5: Screenshot integration from Playwright
- [ ] T9.6: README and CONTRIBUTING.md
- [ ] T9.7: Polish: animations, loading states, error boundaries, empty states

## Phase 10: Release

- [ ] T10.1: Release CI workflows (desktop, web, mobile)
- [ ] T10.2: Code signing setup
- [ ] T10.3: Auto-update mechanism (desktop)
- [ ] T10.4: First release
