# CEPT — Comprehensive Development Prompt for Claude Code

> **Repository:** `github.com/nsheaps/cept`
> **Tagline:** A fully-featured Notion clone backed by Git. Client-only. Offline-first. Collaborative.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Data Model & File Format Specification](#4-data-model--file-format-specification)
5. [Core Feature Requirements](#5-core-feature-requirements)
6. [Git Backend & Collaboration Engine](#6-git-backend--collaboration-engine)
7. [Authentication & Git Provider Integration](#7-authentication--git-provider-integration)
8. [Cross-Platform Build Targets](#8-cross-platform-build-targets)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Testing Strategy](#10-testing-strategy)
11. [Documentation Site](#11-documentation-site)
12. [Claude Code Setup & Agent Configuration](#12-claude-code-setup--agent-configuration)
13. [Task Execution Methodology](#13-task-execution-methodology)
14. [Appendices](#14-appendices)

---

## 1. Project Overview

### 1.1 What is Cept?

Cept is a **fully-featured Notion clone** with a **flexible, multi-backend storage architecture**. There is no server, no proprietary database, no SaaS dependency. Users choose how they want to store their workspace:

- **Browser** — Open the web app and start writing immediately. Zero setup, zero accounts. Data persists in IndexedDB.
- **Local Folder** — Point Cept at any directory on disk. Files are plain Markdown, editable with any text editor. Like opening a folder in VS Code or Obsidian.
- **Git Repository** — The most powerful option. Clone a repo (or turn a local folder into one), and get version history, real-time collaboration, multi-device sync, branching, and conflict resolution — all automatic.

Regardless of backend, the workspace is Markdown files with YAML front matter, plus supporting YAML files for databases and configurations. Users who know Git can manually edit files. Users who don't never need to know Git (or any backend) exists.

Collaboration happens via Git + a lightweight signaling server for real-time presence and CRDT-based conflict-free editing. **This is the feature that Obsidian sorely lacks** — Cept makes collaborative note-taking and databases first-class, not an afterthought.

### 1.2 Core Principles

1. **Client-only architecture** — The app requires nothing other than the files. No server process, no database daemon. The signaling server is optional and only used for real-time multi-user cursor/presence sync when using a Git backend.
2. **Multiple storage backends** — Browser (IndexedDB), local folder (filesystem), or Git repository. Start with any one and upgrade later. The app is fully functional at every tier.
3. **Git as a superpower, not a requirement** — When a workspace is Git-backed, users get history, collaboration, sync, branching, and conflict resolution — all automatic and invisible. When it's not, everything else still works perfectly.
4. **Full Notion feature parity** — Especially databases (tables, boards/kanban, calendars, maps, galleries), inline databases, slash commands, page nesting, templates, and rich block-based editing.
5. **Offline-first** — Full functionality without internet. Sync happens when connectivity returns (Git backend only).
6. **Cross-platform from a single codebase** — Desktop (macOS/Windows/Linux), Web (GitHub Pages + PWA), iOS, Android.
7. **Discoverable UI** — Unlike Obsidian, the sidebar always shows navigation context for the current page. Features are easily findable through slash commands, context menus, and a command palette.
8. **Open files, no lock-in** — Workspaces are just folders of Markdown and YAML files. Import from Notion or Obsidian. Open an existing folder of notes. Export anytime. Use any text editor alongside Cept.

### 1.3 What Makes Cept Different

| Problem with alternatives | How Cept solves it |
|---|---|
| Notion requires internet and a proprietary backend | Cept is offline-first, your files live where you choose |
| Obsidian has no real-time collaboration | Cept has Git-backed CRDTs, live cursors, and presence via signaling server |
| Obsidian lacks Notion's database views, kanban, calendar | Cept implements full database feature parity |
| Obsidian's UI is not discoverable for non-power-users | Cept has contextual sidebar nav, slash commands, command palette |
| Most Notion clones still need a server | Cept is 100% client-side with optional signaling |
| Starting a new tool requires setup and commitment | Cept works in a browser with zero setup — upgrade to Git when you're ready |
| Collaboration on Git repos means merge conflicts | Cept uses CRDTs + auto-branching + smart auto-merge |
| Importing notes requires migration tools | Cept can open any folder of Markdown files directly |

---

## 2. Architecture & Technology Stack

### 2.1 Toolchain

| Tool | Purpose |
|---|---|
| **mise** | Dev environment manager — manages Bun, Node, and all tool versions reproducibly |
| **Bun** | JavaScript runtime, package manager, bundler, test runner |
| **TypeScript** | All code is TypeScript with strict mode |

### 2.2 Application Framework

| Target | Technology | Notes |
|---|---|---|
| **Shared UI** | React 19 + TailwindCSS 4 | Single codebase for all platforms |
| **Desktop (macOS)** | Electrobun | Primary desktop runtime for macOS |
| **Desktop (Win/Linux)** | Electron (fallback) | Electrobun does not support Win/Linux yet; use Electron as fallback. Architect the native shell layer behind an abstraction so swapping is trivial. |
| **Web** | Vite SPA | Deployed to GitHub Pages, installable as PWA via service worker |
| **iOS / Android** | Capacitor | Wraps the same web app in a native shell. Provides native file system and OAuth via plugins. Evaluate at implementation time — if Capacitor has significant limitations for Git operations, document the tradeoff and propose alternatives. |

### 2.3 Key Libraries

| Library | Purpose |
|---|---|
| **isomorphic-git** | Pure JS Git client — works in browser, Node, and mobile. Prefer this over GitHub-specific APIs everywhere possible for future provider compatibility. |
| **lightning-fs** | In-memory + IndexedDB filesystem for isomorphic-git in browser/mobile contexts |
| **Yjs** | CRDT library for real-time collaborative editing without conflicts |
| **y-indexeddb** | Yjs persistence to IndexedDB for offline CRDT state |
| **TipTap** (ProseMirror-based) | WYSIWYG block editor with Yjs collaboration binding (`y-prosemirror`). Provides the Notion-like editing experience. Evaluate BlockNote as an alternative if it provides better Notion parity out-of-box. |
| **hocuspocus** or custom | WebSocket signaling server for Yjs awareness/sync |
| **Zustand** | Lightweight state management |
| **React Router** | Client-side routing |
| **Leaflet + OpenStreetMap** | Map view for databases |
| **date-fns** | Date handling for calendar views |
| **Playwright** | E2E testing with screenshot capture |
| **Vitest** | Unit and integration testing (Bun-compatible) |
| **@amiceli/vitest-cucumber** | BDD: Gherkin feature files in Vitest unit/integration tests. Ref: [GitHub](https://github.com/amiceli/vitest-cucumber) |
| **@cucumber/cucumber** | BDD: Gherkin step definitions for E2E tests with Playwright. Ref: [npm](https://www.npmjs.com/package/@cucumber/cucumber) |
| **mermaid** | Diagram rendering — 20+ diagram types (flowchart, sequence, gantt, ER, mindmap, etc.). Ref: [mermaid.js.org](https://mermaid.js.org/) |
| **d3** + **d3-force** | Knowledge graph force-directed layout (2D). Already available in the stack. |
| **3d-force-graph** | Optional 3D knowledge graph rendering (Three.js-based). Ref: [GitHub](https://github.com/vasturiano/3d-force-graph) |

### 2.4 Abstraction Layers

Create explicit abstraction interfaces for:

1. **`StorageBackend`** — The primary abstraction. All workspace data (pages, databases, assets, config) is read/written through this interface. Three implementations:
   - **`LocalFsBackend`** — Node `fs`, reads/writes a local folder. "Open Folder" experience like VS Code.
   - **`BrowserFsBackend`** — `lightning-fs` (IndexedDB). Zero-setup, works in any browser. Persists across sessions.
   - **`GitBackend`** — Wraps `LocalFsBackend` or `BrowserFsBackend` + `isomorphic-git`. Adds commit, push, pull, branch, merge, history on top of the underlying filesystem. This is the ONLY backend that supports sync, collaboration, and version history.
   - (Future: `CapacitorFsBackend` for native mobile storage)
2. **`AuthProvider`** — Abstracts OAuth flow. Only needed when using `GitBackend` with a remote. MVP is GitHub OAuth App. Interface supports adding GitLab, Bitbucket, Forgejo, SSH keys, and raw HTTPS URLs later.
3. **`NativeShell`** — Abstracts desktop shell (Electrobun vs Electron). Window management, menus, tray, auto-update, notifications.
4. **`SyncTransport`** — Abstracts the signaling/sync channel for real-time collaboration. Only active when using `GitBackend` with a remote. Implementations: WebSocket (default), WebRTC data channel (future).

**Critical design principle:** `StorageBackend` is the ONLY interface that core features (editor, database, search, graph, templates) interact with for persistence. The editor, database engine, knowledge graph, search index, template system — NONE of these know or care whether the storage is a local folder, a browser IndexedDB, or a Git repo. Git-specific features (history, branches, collaboration, sync) are additive capabilities that light up when `GitBackend` is the active backend, but the app is complete and fully functional without them.

---

## 3. Monorepo Structure

```
cept/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + test on every PR
│       ├── release-desktop.yml       # Build desktop installers
│       ├── release-web.yml           # Deploy to GitHub Pages
│       ├── release-mobile.yml        # Build Android APK + iOS IPA
│       └── docs.yml                  # Build and deploy documentation site
├── .mise.toml                        # mise tool versions (bun, node, etc.)
├── nx.json                           # Nx workspace config (task targets, caching, affected)
├── features/                         # BDD Gherkin feature files
│   ├── editor/
│   ├── database/
│   ├── navigation/
│   ├── git/
│   ├── collaboration/
│   ├── graph/
│   ├── storage/
│   └── step-definitions/
├── packages/
│   ├── core/                         # Shared business logic (zero UI deps)
│   │   ├── src/
│   │   │   ├── storage/              # StorageBackend abstraction + implementations
│   │   │   │   ├── backend.ts        # StorageBackend interface + BackendCapabilities
│   │   │   │   ├── browser-fs.ts     # BrowserFsBackend (lightning-fs / IndexedDB)
│   │   │   │   ├── local-fs.ts       # LocalFsBackend (Node fs, Capacitor)
│   │   │   │   ├── git-backend.ts    # GitBackend (extends StorageBackend + isomorphic-git)
│   │   │   │   ├── auto-branch.ts
│   │   │   │   ├── auto-merge.ts
│   │   │   │   ├── conflict-resolver.ts
│   │   │   │   └── sync-engine.ts
│   │   │   ├── auth/                 # AuthProvider abstraction (only needed for Git remotes)
│   │   │   ├── models/               # TypeScript types for documents, databases, blocks
│   │   │   ├── crdt/                 # Yjs document bindings, awareness (only active with Git)
│   │   │   ├── database/             # Database engine (filter, sort, group, formulas)
│   │   │   ├── search/               # Full-text search index (client-side)
│   │   │   ├── graph/                # Knowledge graph builder (works with any backend)
│   │   │   ├── templates/            # Template engine
│   │   │   └── markdown/             # Markdown ↔ Block tree parser/serializer
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                           # Shared React components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── editor/           # TipTap-based block editor
│   │   │   │   ├── sidebar/          # Navigation sidebar with page tree + breadcrumbs
│   │   │   │   ├── database/         # Table, Board, Calendar, Map, Gallery views
│   │   │   │   ├── slash-menu/       # Slash command palette
│   │   │   │   ├── command-palette/  # Cmd+K command palette
│   │   │   │   ├── topbar/           # Title, breadcrumbs, share, collaborators
│   │   │   │   └── common/           # Shared primitives (dropdowns, modals, toasts)
│   │   │   ├── hooks/                # Shared React hooks
│   │   │   ├── stores/               # Zustand stores
│   │   │   └── styles/               # Tailwind config, global styles
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── desktop/                      # Desktop shell (Electrobun + Electron fallback)
│   │   ├── src/
│   │   │   ├── main-electrobun.ts
│   │   │   ├── main-electron.ts
│   │   │   └── native-shell.ts       # NativeShell implementation
│   │   └── package.json
│   ├── web/                          # Vite SPA entry point + PWA config
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── sw.ts                 # Service worker for PWA + offline
│   │   │   └── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── mobile/                       # Capacitor project
│   │   ├── android/
│   │   ├── ios/
│   │   ├── capacitor.config.ts
│   │   └── package.json
│   └── signaling-server/             # Lightweight Yjs signaling server
│       ├── src/
│       │   └── server.ts             # Bun-native WebSocket server
│       ├── Dockerfile
│       └── package.json
├── docs/                             # Documentation site (VitePress or Starlight)
│   ├── getting-started/
│   ├── guides/
│   │   ├── migrate-from-notion.md
│   │   ├── migrate-from-obsidian.md
│   │   └── manual-git-editing.md
│   ├── specs/                        # Feature specification documents (iteratively reviewed)
│   │   ├── TEMPLATE.md
│   │   └── <feature-name>.md
│   ├── reference/
│   │   ├── file-format.md
│   │   ├── database-schema.md
│   │   └── configuration.md
│   └── screenshots/                  # Auto-generated by Playwright
├── e2e/                              # Playwright E2E tests
│   ├── tests/
│   ├── fixtures/
│   └── playwright.config.ts
├── scripts/                          # Build, release, and utility scripts
├── bun.lockb
├── bunfig.toml
├── package.json                      # Workspace root
└── nx.json                        # Nx config for monorepo task orchestration
```

Use **Nx** for monorepo task orchestration (`nx run-many -t build`, `nx run-many -t test`, etc.) with proper dependency graph between packages.

---

## 4. Data Model & File Format Specification

### 4.1 Document Format

Every page is a Markdown file with YAML front matter:

```markdown
---
id: "550e8400-e29b-41d4-a716-446655440000"
title: "Project Roadmap"
icon: "🗺️"
cover: ".cept/assets/cover-roadmap.png"
parent: "pages/engineering/index.md"
created: "2025-01-15T10:30:00Z"
modified: "2025-03-01T14:22:00Z"
template: null
tags: ["engineering", "planning"]
properties: {}
---

# Project Roadmap

This is a standard paragraph block.

<!-- cept:block {"type":"callout","icon":"💡","color":"blue"} -->
This is a callout block styled like Notion's callouts.
<!-- /cept:block -->

<!-- cept:block {"type":"toggle","summary":"Click to expand"} -->
Hidden content inside a toggle block.
<!-- /cept:block -->

<!-- cept:database {"ref":".cept/databases/tasks.yaml","view":"table","viewConfig":{"visibleProperties":["title","status","assignee","due"]}} -->

<!-- cept:block {"type":"embed","url":"https://example.com"} -->
```

### 4.2 Block Encoding Rules

Blocks that go beyond standard Markdown are encoded in **HTML comments** so the raw `.md` file remains valid, readable Markdown that can be edited directly via Git:

| Block Type | Encoding |
|---|---|
| Paragraph, headings, lists, code, quotes, links, images, horizontal rules, bold, italic, strikethrough | Standard Markdown (CommonMark + GFM) |
| Callouts, toggles, column layouts, embeds, bookmarks, synced blocks, equation blocks | `<!-- cept:block {JSON config} -->` ... content ... `<!-- /cept:block -->` |
| Inline database embed | `<!-- cept:database {JSON ref + view config} -->` |
| Table of contents | `<!-- cept:toc -->` |
| Inline mentions (@page, @person, @date) | `<!-- cept:mention {"type":"page","id":"..."} -->display text<!-- /cept:mention -->` |

**The HTML comment approach ensures:**
- Files are still valid Markdown
- Git diffs are readable
- Users can edit files manually with any text editor
- Non-Cept renderers show the comments as invisible (graceful degradation)

### 4.3 Database Schema

Databases are stored as YAML files in `.cept/databases/`:

```yaml
# .cept/databases/tasks.yaml
id: "db-550e8400"
title: "Sprint Tasks"
icon: "📋"
properties:
  title:
    type: title
  status:
    type: select
    options:
      - { value: "Not Started", color: "gray" }
      - { value: "In Progress", color: "blue" }
      - { value: "Done", color: "green" }
      - { value: "Blocked", color: "red" }
  assignee:
    type: person
  due:
    type: date
  priority:
    type: select
    options:
      - { value: "P0", color: "red" }
      - { value: "P1", color: "orange" }
      - { value: "P2", color: "yellow" }
      - { value: "P3", color: "gray" }
  estimate:
    type: number
    format: "0.0"
  tags:
    type: multi_select
    options:
      - { value: "frontend", color: "purple" }
      - { value: "backend", color: "green" }
  related:
    type: relation
    target_database: "db-requirements"
  sprint_ref:
    type: relation
    target_database: "db-sprints"

views:
  - id: "view-default-table"
    name: "All Tasks"
    type: table
    filter: null
    sort: [{ property: "priority", direction: "asc" }]
    visible_properties: ["title", "status", "assignee", "due", "priority"]

  - id: "view-kanban"
    name: "Sprint Board"
    type: board
    group_by: "status"
    filter: { property: "sprint_ref", operator: "equals", value: "current" }

  - id: "view-calendar"
    name: "Timeline"
    type: calendar
    date_property: "due"

  - id: "view-map"
    name: "Locations"
    type: map
    location_property: "location"

rows:
  - id: "row-001"
    page: "pages/tasks/implement-auth.md"
    properties:
      status: "In Progress"
      assignee: "alice"
      due: "2025-04-01"
      priority: "P0"
      estimate: 5.0
      tags: ["frontend", "backend"]
```

### 4.4 Supported Database Property Types

Implement ALL of the following to match Notion:

| Type | Storage | UI |
|---|---|---|
| `title` | String (linked to page title) | Editable text cell |
| `text` | String | Multi-line text cell |
| `number` | Number | Formatted number with configurable format |
| `select` | String (from enum) | Dropdown with colored tags |
| `multi_select` | String[] (from enum) | Multi-dropdown with colored tags |
| `date` | ISO date or date range | Date picker, optional end date + time |
| `person` | String (collaborator ID) | Avatar + name |
| `checkbox` | Boolean | Toggle checkbox |
| `url` | String | Clickable link |
| `email` | String | Clickable mailto |
| `phone` | String | Clickable tel |
| `formula` | Expression string | Computed value (implement expression evaluator) |
| `relation` | Row ID[] from target DB | Linked records with bidirectional sync |
| `rollup` | Config referencing relation + property | Aggregated value from related records |
| `created_time` | Auto ISO datetime | Read-only timestamp |
| `last_edited_time` | Auto ISO datetime | Read-only timestamp |
| `created_by` | Auto string | Read-only |
| `last_edited_by` | Auto string | Read-only |
| `files` | String[] (paths relative to repo) | File attachments in `.cept/assets/` |
| `location` | `{ lat: number, lng: number, label?: string }` | Map pin with optional label |

### 4.5 Database View Types

| View |
