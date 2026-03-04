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

- [ ] T0.1: Initialize monorepo with mise, bun, Nx, tsconfig
- [ ] T0.2: Set up CI workflow (`.github/workflows/ci.yml` — lint + typecheck + test stubs)
- [ ] T0.3: Create `packages/core/` with all abstraction interfaces (types only)
- [ ] T0.4: Create `packages/ui/` skeleton with React, TailwindCSS
- [ ] T0.5: Create `packages/web/` Vite entry point with dev server
- [ ] T0.6: Set up Playwright with a single smoke test
- [ ] T0.7: Set up Vitest with a single unit test
- [ ] T0.8: Set up BDD tooling — `@amiceli/vitest-cucumber` for unit BDD, `@cucumber/cucumber` + Playwright for E2E BDD
- [ ] T0.9: Create `features/` directory structure with example `.feature` file and step definitions
- [ ] T0.10: Create `docs/specs/TEMPLATE.md` and initial feature spec stubs for Phase 1 features
- [ ] T0.11: Set up GitHub Pages preview deployment workflow (`.github/workflows/preview-deploy.yml`)
- [ ] T0.12: Implement `CEPT_DEMO_MODE` flag — onboarding skips backend selection, goes straight to `BrowserFsBackend` with sample content

## Phase 1: Core Engine

- [ ] T1.1: Implement `StorageBackend` interface + `BrowserFsBackend` (lightning-fs / IndexedDB) + `LocalFsBackend` (Node fs)
- [ ] T1.2: Implement `GitBackend` extending `StorageBackend` with isomorphic-git
- [ ] T1.3: Implement Markdown <-> Block tree parser (CommonMark + GFM + cept extensions)
- [ ] T1.4: Implement YAML front matter parser/serializer
- [ ] T1.5: Implement database engine (schema, CRUD, filter, sort, group)
- [ ] T1.6: Implement formula evaluator for database formulas
- [ ] T1.7: Implement search index (client-side full-text)
- [ ] T1.8: Implement template engine

## Phase 2: Editor UI

- [ ] T2.1: TipTap editor setup with basic blocks (paragraph, headings, lists)
- [ ] T2.2: All text blocks (code, quote, callout, toggle, divider)
- [ ] T2.3: Media blocks (image, embed, bookmark)
- [ ] T2.4: Slash command menu
- [ ] T2.5: Block drag-and-drop reordering
- [ ] T2.6: Block actions menu
- [ ] T2.7: Inline formatting toolbar
- [ ] T2.8: Column layout blocks
- [ ] T2.9: Mentions (page, person, date)
- [ ] T2.10: Math equations (KaTeX)
- [ ] T2.11: Mermaid diagram block — custom TipTap node with live preview, all 20+ diagram types, SVG/PNG export

## Phase 3: Navigation & Page Management

- [ ] T3.1: Sidebar with page tree (infinite nesting)
- [ ] T3.2: Current page highlighting + auto-expand in sidebar
- [ ] T3.3: Breadcrumbs in topbar
- [ ] T3.4: Page CRUD (create, rename, move, delete, restore)
- [ ] T3.5: Favorites and recent sections
- [ ] T3.6: Trash with restore
- [ ] T3.7: Command palette (Cmd+K)
- [ ] T3.8: Full-text search UI
- [ ] T3.9: Knowledge Graph — global view with D3 force-directed layout
- [ ] T3.10: Knowledge Graph — local view with depth slider
- [ ] T3.11: Knowledge Graph — filters, color groups
- [ ] T3.12: Knowledge Graph — time-lapse animation, performance optimization

## Phase 4: Databases

- [ ] T4.1: Database schema UI (add/edit/reorder properties)
- [ ] T4.2: Table view with sortable, filterable, resizable columns
- [ ] T4.3: Board/Kanban view with drag-and-drop
- [ ] T4.4: Calendar view
- [ ] T4.5: Map view (Leaflet + OpenStreetMap)
- [ ] T4.6: Gallery view
- [ ] T4.7: List view
- [ ] T4.8: Inline database blocks (embed in pages)
- [ ] T4.9: Linked database views (reference existing DB with custom filter)
- [ ] T4.10: Relations and rollups
- [ ] T4.11: Select/Multi-select dropdown editors with color
- [ ] T4.12: All remaining property type editors

## Phase 5: Git & Auth

- [ ] T5.1: GitHub OAuth App flow
- [ ] T5.2: Repo picker/creator UI
- [ ] T5.3: Auto-commit engine
- [ ] T5.4: Auto-branch strategy
- [ ] T5.5: Auto-merge + conflict resolution engine
- [ ] T5.6: Conflict notification + resolution UI
- [ ] T5.7: Page history viewer (Git log + diff)
- [ ] T5.8: Sync engine (pull/push cycle)

## Phase 6: Collaboration

- [ ] T6.1: Yjs integration with TipTap (y-prosemirror)
- [ ] T6.2: Signaling server implementation
- [ ] T6.3: Presence awareness (cursors, avatar stack)
- [ ] T6.4: Real-time sync of database changes
- [ ] T6.5: Offline queue + reconnect sync

## Phase 7: Cross-Platform

- [ ] T7.1: Electrobun desktop shell (macOS)
- [ ] T7.2: Electron desktop shell (Windows/Linux)
- [ ] T7.3: PWA service worker + manifest
- [ ] T7.4: Capacitor mobile project setup
- [ ] T7.5: Mobile-specific UI adaptations (responsive, touch)
- [ ] T7.6: Native OAuth flow for mobile

## Phase 8: Import/Export & Templates

- [ ] T8.1: Notion export ZIP importer
- [ ] T8.2: Obsidian vault importer
- [ ] T8.3: Markdown/HTML/PDF exporter
- [ ] T8.4: Built-in template library

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
