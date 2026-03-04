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

| View | Description |
|---|---|
| **Table** | Spreadsheet-style with sortable/filterable columns, resizable, reorderable. Customizable visible columns. |
| **Board** (Kanban/Swimlanes) | Cards grouped by a select property. Drag-and-drop between lanes. Customizable card preview properties. Supports Scrum swimlanes with configurable grouping (e.g., by sprint, then by status). |
| **Calendar** | Month/week/day views. Events placed by a date property. Drag to reschedule. |
| **Map** | OpenStreetMap (Leaflet) with pins from a location property. Click pin to open record. |
| **Gallery** | Card grid with cover images. |
| **List** | Minimal list view with customizable properties shown inline. |

### 4.6 Repository Layout

```
my-workspace/                           # The user's Git repo
├── .cept/
│   ├── config.yaml                     # Workspace-level settings
│   ├── databases/                      # Database schema + row data
│   │   ├── tasks.yaml
│   │   └── contacts.yaml
│   ├── assets/                         # Uploaded images, files, covers
│   │   └── ...
│   ├── templates/                      # Page and database templates
│   │   ├── meeting-notes.md
│   │   └── project-tracker.yaml
│   ├── comments/                       # Comment threads per page
│   │   └── <page-id>.yaml
│   ├── styles/                         # Custom CSS overrides
│   │   └── custom.css
│   └── plugins/                        # Future: plugin configs
│       └── ...
├── pages/                              # All document pages
│   ├── index.md                        # Workspace root page
│   ├── engineering/
│   │   ├── index.md
│   │   └── roadmap.md
│   └── personal/
│       └── journal.md
└── README.md                           # Auto-generated workspace overview
```

### 4.7 File Size Considerations

- **Individual page files**: Keep under 500KB. If a page grows beyond this (e.g., massive tables), warn the user and suggest splitting.
- **Database files**: One YAML file per database. If a database exceeds 1MB (thousands of rows), automatically shard into `<db-id>/schema.yaml` + `<db-id>/rows/<shard-N>.yaml` (1000 rows per shard).
- **Assets**: Store in `.cept/assets/` with content-addressable naming (`<sha256-prefix>-<original-name>`). Implement configurable max asset size (default 10MB).
- **Merge friendliness**: YAML is more merge-friendly than JSON. Use block scalars for long text. One row per YAML sequence item. Avoid long single lines.

### 4.8 Schema Documentation

All schemas MUST be documented in the repo's `docs/reference/` directory with:
- Complete property type reference with examples
- How to manually create/edit databases via text editor
- How front matter fields map to the UI
- How `<!-- cept:block -->` comments work and how to write them by hand
- How database row references connect to page files

---

## 5. Core Feature Requirements

### 5.1 Editor (WYSIWYG Block Editor)

Build on TipTap (or BlockNote — evaluate at implementation time) with these Notion-equivalent blocks:

**Text blocks:** Paragraph, Heading 1/2/3, Bulleted list, Numbered list, To-do list (checkboxes), Toggle list, Quote, Callout (with icon + color), Code block (with syntax highlighting and language selector), Divider.

**Media blocks:** Image (upload, embed URL, or unsplash), Video embed, Audio embed, File attachment, Bookmark (with preview card), Embed (iframe).

**Advanced blocks:** Table (simple, not database), Table of contents, Synced block (reusable across pages), Column layout (2-5 columns), Math equation (KaTeX), Mermaid diagram.

**Database blocks:** Inline database (full database embedded in page), Linked database view (reference to existing database with custom view/filter).

**Slash command menu (`/`):** Triggered by typing `/` on an empty line or after a space. Shows all available block types with search/filter. Keyboard navigable. Grouped by category.

**Inline formatting:** Bold, italic, underline, strikethrough, code, color (text + background), link, mention (@page, @person, @date), inline equation, inline comment.

**Drag and drop:** Blocks are reorderable via drag handles. Blocks can be dragged between columns. Drag to indent/outdent.

**Block actions menu (⋮):** Delete, duplicate, turn into (convert block type), move to (another page), copy link to block, color.

### 5.2 Sidebar Navigation

**Critical UX requirement:** The sidebar MUST always show the user where they are in the page hierarchy. This is a key differentiator from Obsidian.

- **Page tree** with expand/collapse, nested infinitely
- **Current page highlighted** and auto-expanded in tree
- **Breadcrumb trail** at top showing full path: `Workspace > Engineering > Roadmap`
- **Favorites** section (user-pinned pages)
- **Recent** section
- **Search** (full-text, instant, searches page content + titles + database values)
- **Trash** (soft-deleted pages, restorable)
- **Settings & members** at bottom
- **Template gallery** accessible from sidebar
- **New page** button with template picker
- **Database quick access** section showing all databases
- Drag-and-drop to reorder and re-parent pages in the tree

### 5.3 Page Features

- **Infinite nesting** — pages can contain sub-pages to any depth
- **Page icon** — emoji or uploaded image
- **Page cover** — full-width banner image
- **Page properties** — custom metadata (shown in front matter, editable in UI)
- **Comments** — inline comments on any block, threaded replies, resolve/unresolve
- **Page history** — powered by Git log, show diffs, restore any version
- **Page lock** — prevent edits (stored in front matter)
- **Export** — Markdown, PDF, HTML
- **Import** — Markdown, HTML, Notion export ZIP, Obsidian vault

### 5.4 Template System

- Templates stored in `.cept/templates/`
- Page templates (pre-filled markdown content)
- Database templates (pre-configured database schema + views)
- "Use this as template" action on any existing page
- Template gallery UI with preview
- Built-in starter templates: Meeting Notes, Project Tracker, Sprint Board, Journal, Wiki, Reading List, CRM

### 5.5 Command Palette (`Cmd+K` / `Ctrl+K`)

- Search pages, databases, and actions
- Quick actions: "New page", "New database", "Toggle dark mode", "Go to settings"
- Recent pages
- Keyboard-first navigation

### 5.6 Collaboration & Presence (Real-time)

- See other users' cursors and selections in real-time (Yjs awareness)
- See who is currently viewing a page (avatar stack in topbar)
- Changes sync in real-time via Yjs + signaling server
- Works fully offline; syncs when reconnected
- Conflict-free by design (CRDTs handle concurrent edits)

### 5.7 Settings

- **Workspace settings**: name, icon, default page, member management
- **Personal settings**: theme (light/dark/system), font, font size, sidebar width, keyboard shortcuts
- **Git settings**: remote URL, branch, auto-commit interval, commit message format
- **Sync settings**: signaling server URL, offline mode toggle
- All settings stored in `.cept/config.yaml` (workspace-level) and browser localStorage/app storage (personal)

### 5.8 Knowledge Graph (Obsidian-style)

Implement a full knowledge graph visualization inspired by Obsidian's Graph View, but enhanced with features from the community plugin ecosystem. This is a first-class feature, not a nice-to-have.

**References:**
- [Obsidian Graph View docs](https://help.obsidian.md/plugins/graph) — core feature spec
- [DeepWiki: Obsidian Graph View architecture](https://deepwiki.com/obsidianmd/obsidian-help/4.5-graph-view) — force-directed layout, filters, groups
- [3D Graph plugin](https://github.com/Apoo711/obsidian-3d-graph) — 3D force-directed with `3d-force-graph` library
- [InfraNodus Obsidian plugin](https://infranodus.com/obsidian-plugin) — network science insights (betweenness centrality, community detection)

**Rendering technology:** Use **D3.js force-directed simulation** (`d3-force`) for 2D graph (default), with optional **3d-force-graph** (Three.js-based) for 3D view. Both are already available in the project dependency list.

**Global Graph View:**
- Displays ALL pages in the workspace as nodes, with edges representing links between them (internal links, mentions, database relations)
- Force-directed layout with configurable physics parameters:
  - **Center force** — pulls nodes toward center
  - **Repel force** — pushes nodes apart (charge)
  - **Link force** — pulls connected nodes together (spring)
  - **Link distance** — rest length of springs
- Interactive: pan, zoom, click node to navigate to page, hover for preview
- Node size proportional to number of connections (degree centrality)
- Animated time-lapse showing workspace growth chronologically (based on page `created` dates)

**Local Graph View:**
- Displays the neighborhood of the currently active page
- **Depth slider** (1–5): depth 1 = direct links only, depth 2 = friends-of-friends, etc.
- Automatically updates as you navigate between pages
- Shown in a sidebar panel or as a floating panel

**Filters (same query syntax as search):**
- Search files filter (text query to include/exclude nodes by title, path, tag)
- **Tags toggle** — show/hide tag nodes
- **Attachments toggle** — show/hide attachment nodes
- **Orphans toggle** — show/hide unlinked pages (critical for discovering disconnected notes)
- **Existing files only** — hide unresolved links (links to pages that don't exist yet)
- Exclusion patterns (e.g., `-path:"daily"` to hide daily notes folder)

**Color Groups:**
- Define groups using search queries (e.g., `path:"engineering"`, `tag:#important`)
- Each group assigned a color
- Nodes matching multiple groups use first matching group's color
- At least 8 configurable group slots

**Display Settings:**
- Node size (small/medium/large or continuous slider)
- Link thickness
- Arrow direction (show/hide directional arrows)
- Text labels (show/hide page titles on nodes)
- Dark/light theme matching app theme

**Graph Data Model (stored in `packages/core/src/graph/`):**
```typescript
interface GraphNode {
  id: string;          // page ID
  title: string;
  path: string;
  type: "page" | "tag" | "attachment" | "unresolved";
  created: string;     // ISO date for time-lapse
  connections: number; // degree centrality (cached)
  tags: string[];
  group?: string;      // matched color group
}

interface GraphEdge {
  source: string;      // node ID
  target: string;      // node ID
  type: "link" | "mention" | "tag" | "relation"; // edge classification
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

**Graph builder** must scan all pages to extract:
1. Internal links (markdown links + `<!-- cept:mention -->` references)
2. Database relations (from `.cept/databases/*.yaml` relation properties)
3. Tag co-occurrence (pages sharing tags create implicit edges)
4. Backlinks (reverse links — page A links to page B means B has a backlink from A)

**Performance:** For large workspaces (1000+ pages), use Web Worker for graph computation. Virtualize rendering — only render nodes visible in the viewport. Use spatial indexing (quadtree) for efficient force simulation.

### 5.9 Mermaid Diagram Support (Comprehensive)

Mermaid diagrams are a first-class block type in Cept, not an afterthought. Support ALL Mermaid diagram types with live preview, inline editing, and export.

**References:**
- [Mermaid.js official](https://mermaid.js.org/) — library and syntax reference
- [Mermaid GitHub](https://github.com/mermaid-js/mermaid) — 20+ diagram types
- [TipTap starter kit Mermaid extension](https://github.com/syfxlin/tiptap-starter-kit/blob/master/docs/nodes/mermaid.md) — TipTap integration pattern
- [TipTap React Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) — ReactNodeViewRenderer for custom block rendering
- [lowlight-mermaid](https://github.com/react18-tools/lowlight-mermaid) — syntax highlighting for Mermaid in code blocks

**Supported Diagram Types (all must work):**

| Category | Diagram Types |
|---|---|
| **Process & Flow** | Flowchart/Graph, Sequence Diagram, State Diagram, Activity (via flowchart) |
| **Project & Planning** | Gantt Chart, Timeline, Kanban |
| **Structure** | Class Diagram, Entity-Relationship (ER), Block Diagram |
| **Data & Analysis** | Pie Chart, XY Chart (bar/line), Quadrant Chart, Sankey Diagram |
| **Architecture** | C4 Diagram, Architecture Diagram |
| **Other** | Git Graph, Mindmap, User Journey, Requirement Diagram, Packet Diagram |

**Editor Integration (TipTap custom node):**

Implement as a custom TipTap node extension using `ReactNodeViewRenderer`:

1. **Code editing mode** — Syntax-highlighted code editor (CodeMirror or Monaco, with Mermaid grammar via `lowlight-mermaid`) showing raw Mermaid syntax
2. **Preview mode** — Live-rendered SVG diagram via `mermaid.render()`
3. **Split mode** — Side-by-side code and preview (like Mermaid Live Editor)
4. **Toggle** — Click the rendered diagram to switch to edit mode; click outside to return to preview
5. **Error handling** — If Mermaid syntax is invalid, show error message inline below the code editor (don't hide the code)

**Rendering:**
- Use `mermaid.render()` API directly (not `.initialize({ startOnLoad: true })` which requires DOM scanning)
- Render in a sandboxed container to prevent XSS from user-authored diagram code
- Support Mermaid themes: `default`, `dark`, `forest`, `neutral`, `base` — theme follows app light/dark mode
- Support Mermaid directives (front matter in the diagram code for per-diagram config)

**Export:**
- Right-click diagram → "Copy as SVG", "Copy as PNG", "Download SVG", "Download PNG"
- SVG export preserves vector quality
- PNG export at 2x resolution for retina displays

**Markdown encoding:**
```markdown
<!-- cept:block {"type":"mermaid","theme":"default"} -->
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
```
<!-- /cept:block -->
```

Also support GitHub-flavored Markdown fenced code blocks as input:
````markdown
```mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
```
````

Both formats are equivalent. The parser should accept either and normalize to the `<!-- cept:block -->` format on save.

**Slash command:** `/mermaid` → inserts a blank Mermaid block in code editing mode with a starter template (flowchart by default). Submenu lets user pick diagram type and inserts appropriate starter template.

**Templates for each diagram type:** When inserting via slash command, offer quick-start templates:
- `/mermaid flowchart` → basic flowchart skeleton
- `/mermaid sequence` → basic sequence diagram skeleton
- `/mermaid gantt` → basic Gantt chart skeleton
- etc. for all supported types

### 5.10 Storage Backends & Workspaces

Cept is **not a Git app with a fallback mode.** Cept is a note-taking and database tool that supports multiple storage backends, one of which happens to be Git. This is a core architectural principle, not an afterthought.

A **workspace** in Cept is a collection of pages, databases, templates, and assets. Every workspace is backed by a `StorageBackend`. The user chooses their backend when creating or opening a workspace. They can upgrade (or change) the backend at any time.

#### 5.10.1 Supported Backends

| Backend | When to use | Persistence | Collaboration | History | Sync |
|---|---|---|---|---|---|
| **Browser** (`BrowserFsBackend`) | Zero-setup. Open the web app and start writing. No account, no install, nothing. | IndexedDB — persists across browser sessions. Cleared if user clears site data. | No | No | No |
| **Local Folder** (`LocalFsBackend`) | "Open Folder" experience. User picks a folder on disk (like VS Code / Obsidian). Great for importing existing notes or keeping files under user's control. | Native filesystem — files are plain Markdown, directly editable outside Cept. | No | No | No |
| **Git** (`GitBackend`) | Full power. Clone a repo (or init one), get version history, real-time collaboration, multi-device sync, branching, conflict resolution. | Git repo (local clone + remote). Files are still plain Markdown. | Yes (Yjs + signaling) | Yes (full Git log) | Yes (push/pull) |

#### 5.10.2 What Every Backend Gets (The Baseline)

ALL backends — including Browser and Local Folder — support the complete Cept editing and organization experience:

- Full block editor with all block types (headings, lists, callouts, code, toggles, embeds, etc.)
- All slash commands
- Mermaid diagram blocks (all 20+ diagram types, live preview, export)
- Database creation with all 18 property types
- All 6 database views (table, board, calendar, map, gallery, list)
- Inline databases embedded in pages
- Knowledge graph (global and local views — derived from page links and relations)
- Templates (create, apply, manage)
- Full-text search across all pages
- Sidebar navigation, page nesting, breadcrumbs, favorites
- Command palette (`Cmd+K`)
- Settings (theme, font, layout preferences)
- All keyboard shortcuts
- Import from Notion / Obsidian exports
- Export to Markdown / HTML / PDF

#### 5.10.3 What Git Adds (Additive Capabilities)

When a workspace uses `GitBackend`, the following capabilities light up in the UI:

- **Version history** — browse full commit log, view diffs, restore any previous version of any page
- **Real-time collaboration** — multiple users editing the same page simultaneously (Yjs CRDTs + signaling server)
- **Presence** — see who else is viewing/editing a page (avatars, cursors)
- **Multi-device sync** — push/pull changes across devices via Git remote
- **Branching** — automatic branch creation for concurrent edits, auto-merge back to main
- **Conflict resolution** — graduated strategy (CRDT → section-level → last-write-wins → UI prompt)
- **Auth & permissions** — OAuth login, repo access control via Git provider permissions

When these features are unavailable (non-Git backend), the corresponding UI elements are simply absent — not grayed out, not showing "upgrade" nags. The app feels complete at every tier.

#### 5.10.4 User Flows

**Flow 1: Zero-setup browser start**
1. User opens `cept.app` (or GitHub Pages deployment) in a browser
2. Landing page: "Start writing" (browser backend) | "Open a folder" (local, desktop only) | "Connect a Git repo" (Git backend)
3. User clicks "Start writing" → workspace created instantly in IndexedDB
4. Full editor, databases, graph, everything works immediately
5. Later: user clicks "Connect a Git repo" in settings → existing content becomes the initial commit

**Flow 2: Open a local folder (desktop)**
1. User opens Cept desktop app
2. Selects "Open Folder" → file picker → chooses `~/Notes/` (or any directory)
3. If the folder already contains `.cept/` config → workspace loads immediately
4. If the folder contains Markdown files but no `.cept/` → Cept offers to import/initialize (creates `.cept/` directory, indexes existing `.md` files as pages)
5. If the folder is empty → fresh workspace initialized
6. Files are plain Markdown on disk — user can edit them with any text editor, VS Code, Obsidian, etc. Cept watches for external changes.
7. Later: user clicks "Set up Git" in settings → `git init` + first commit + optional remote setup

**Flow 3: Open a local folder containing an existing Git repo**
1. Same as Flow 2, but Cept detects `.git/` directory
2. Automatically upgrades to `GitBackend` — history, sync, collaboration features light up
3. If the repo has a remote, Cept offers to enable sync

**Flow 4: Clone a remote Git repo**
1. User clicks "Connect a Git repo" → OAuth login → repo picker (or paste URL)
2. Cept clones the repo
3. Full Git-backed workspace with all collaboration features

**Flow 5: Import existing notes**
1. User has a folder of Markdown files (from Obsidian, another tool, or hand-written)
2. Opens that folder in Cept (Flow 2)
3. Cept reads the `.md` files, creates `.cept/` metadata, indexes everything
4. Knowledge graph immediately shows relationships from `[[wiki-links]]` and standard Markdown links
5. User's files are not modified unless they edit them in Cept

#### 5.10.5 Backend Switching & Upgrade Path

Upgrading from a simpler backend to a more capable one is seamless:

| From | To | What happens |
|---|---|---|
| **Browser** → **Local Folder** | User exports/downloads workspace as a folder (or desktop app offers "Save to disk") |
| **Browser** → **Git** | `git init` on a temp directory, copy IndexedDB content to files, first commit, set remote, push |
| **Local Folder** → **Git** | `git init` in the existing folder, first commit of all files, optionally set remote |
| **Git** → **Local Folder** | Remove `.git/` directory (or just stop using sync). Files remain as-is on disk. |

Downgrading (Git → Local) means losing history and collaboration, so Cept should warn the user. But the files themselves are always just Markdown + YAML — nothing is locked in.

#### 5.10.6 Implementation Requirements

**`StorageBackend` interface (in `packages/core/src/storage/`):**
```typescript
interface StorageBackend {
  readonly type: "browser" | "local" | "git";
  readonly capabilities: BackendCapabilities;

  // Core CRUD — every backend implements these
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listDirectory(path: string): Promise<DirEntry[]>;
  exists(path: string): Promise<boolean>;
  watch(path: string, callback: (event: FsEvent) => void): Unsubscribe;

  // Metadata
  stat(path: string): Promise<FileStat | null>;

  // Workspace lifecycle
  initialize(config: WorkspaceConfig): Promise<void>;
  close(): Promise<void>;
}

interface BackendCapabilities {
  history: boolean;       // can browse past versions
  collaboration: boolean; // can do real-time multi-user editing
  sync: boolean;          // can push/pull to remote
  branching: boolean;     // can create/merge branches
  externalEditing: boolean; // files editable outside Cept (local/git only)
  watchForExternalChanges: boolean; // can detect changes made outside Cept
}

// GitBackend extends StorageBackend with additional Git-specific methods
interface GitStorageBackend extends StorageBackend {
  readonly type: "git";

  // Git operations
  commit(message: string, paths?: string[]): Promise<CommitHash>;
  push(branch?: string): Promise<PushResult>;
  pull(branch?: string): Promise<MergeResult>;
  log(path?: string, options?: LogOptions): Promise<CommitInfo[]>;
  diff(commitA: string, commitB: string, path?: string): Promise<DiffResult>;
  branch: BranchOperations;
  remote: RemoteOperations;
}
```

**Feature detection pattern:**
```typescript
// In UI components, check capabilities — don't check backend type
function HistoryPanel({ backend }: { backend: StorageBackend }) {
  if (!backend.capabilities.history) return null; // simply don't render
  const gitBackend = backend as GitStorageBackend;
  // ... render history UI using gitBackend.log()
}
```

**Rules:**
- `@cept/core` and `@cept/ui` depend ONLY on `StorageBackend` interface, NEVER on a specific implementation
- Git-specific UI is gated by `backend.capabilities`, not by `backend.type`
- NO feature may import `isomorphic-git` directly — only `GitBackend` implementation does
- The app MUST boot to a fully functional state with just `BrowserFsBackend` — this is the lowest common denominator and must be tested in CI (via GitHub Pages preview deployments)
- When opening a local folder, Cept MUST NOT modify existing files unless the user explicitly edits them. The `.cept/` metadata directory is the only thing Cept creates automatically.
- External file changes (user edits a `.md` file in VS Code) must be detected and reflected in Cept's UI (via `watch()` on backends that support it)

#### 5.10.7 GitHub Pages Preview & the Browser Backend

The GitHub Pages preview deployments (Section 9.1.1) use `BrowserFsBackend` by default since there's no filesystem or Git available in that environment. This means every PR preview:
- Validates the complete editor, database, graph, and template functionality
- Exercises the exact same code path that a new user hitting the web app for the first time would use
- Serves as a live, clickable demo for reviewers and for Renovate dependency-update PRs

The `CEPT_DEMO_MODE` environment variable is **not** about a separate mode — it simply tells the onboarding screen to skip the backend selection and go straight to `BrowserFsBackend`. The same flag can pre-populate sample content (a welcome page, an example database, a template gallery) so the preview isn't empty.

---

## 6. Git Backend & Collaboration Engine

### 6.1 Core Git Operations

All Git operations use **isomorphic-git** through the `GitBackend` implementation of `StorageBackend` (see Section 2.4). No other code calls isomorphic-git directly. Never use GitHub's REST/GraphQL API for Git operations (only for OAuth and repo creation).

`GitBackend` wraps an underlying filesystem backend (`LocalFsBackend` on desktop, `BrowserFsBackend` in browser) and adds Git operations on top:

```
GitBackend (extends StorageBackend):
  // Inherited from StorageBackend: readFile, writeFile, deleteFile, listDirectory, etc.

  // Git-specific operations:
  - clone(url, auth) → void
  - pull(branch?) → MergeResult
  - push(branch?) → PushResult
  - commit(message, paths?) → CommitHash
  - branch.create(name, from?) → void
  - branch.switch(name) → void
  - branch.merge(source, target) → MergeResult
  - branch.list() → Branch[]
  - branch.current() → string
  - log(path?, limit?) → Commit[]
  - diff(commitA, commitB, path?) → Diff[]
  - status() → FileStatus[]
  - resolve(path, content) → void
```

### 6.2 Automatic Commit Strategy

Users never manually commit. The system commits automatically:

1. **Auto-save with debounce** — After 2 seconds of inactivity, write changes to the filesystem.
2. **Auto-commit with coalesce** — After 30 seconds of accumulated changes (configurable), create a commit. Commit message is auto-generated: `"Edit: <page title>"`, `"Create: <page title>"`, `"Delete: <page title>"`, `"Update database: <db title>"`.
3. **Semantic commits** — Group related changes: if a user edits a page and its referenced database in the same session, commit together.
4. **Never commit broken state** — Validate file references and schema before committing.

### 6.3 Automatic Branch Strategy

The branching strategy enables collaboration without conflicts:

1. **Main branch (`main`)** — Source of truth. Always clean.
2. **User edit branches** — When a user starts editing a page that another user is also editing (detected via presence/awareness), automatically create a branch: `cept/live/<page-id>/<user-id>/<timestamp>`. The user never sees this.
3. **Auto-merge back** — When the user stops editing (navigates away or closes app), auto-merge the edit branch back to `main`:
   - If clean merge → fast-forward or merge commit → delete branch.
   - If auto-resolvable conflict (different sections of same file) → auto-resolve → merge commit → delete branch.
   - If unresolvable conflict → show notification to user with a diff view and resolution UI.
4. **Single-user mode** — If no other users are detected (no signaling server connected), skip branching entirely and commit directly to `main`.

### 6.4 Conflict Resolution

**Priority order:**

1. **CRDTs prevent most conflicts** — Yjs handles real-time character-level merging. Two users typing in the same paragraph at the same time will never conflict at the Git level because the CRDT state is serialized atomically.
2. **Section-level auto-merge** — If changes are in different blocks/sections of the same file, merge automatically.
3. **Last-write-wins for metadata** — For front matter properties, timestamps, and database row properties, use last-write-wins with the most recent timestamp.
4. **Notification for true conflicts** — If two users modified the exact same content in an overlapping way that the CRDT didn't catch (e.g., one user was offline), show a notification:
   - Side-by-side diff view
   - "Keep mine", "Keep theirs", "Merge manually" options
   - Inline merge editor for manual resolution

### 6.5 Sync Engine

```
SyncEngine:
  - on app open: pull latest from remote
  - on edit: write to local FS → debounce → commit → push
  - on push failure (remote ahead): pull → auto-merge → push retry
  - on signaling server connect: exchange Yjs awareness + doc state
  - on signaling server disconnect: continue offline, queue commits
  - on reconnect: pull → merge → push queued commits
  - periodic background sync: every 60s (configurable), pull + push
```

### 6.6 Signaling Server

A minimal WebSocket server for Yjs document sync and presence awareness.

**Default:** A free community signaling server hosted at a public URL (document this, include terms of use, make clear it's best-effort). Users can switch to self-hosted.

**Self-hosted:** The `packages/signaling-server/` package is a standalone Bun WebSocket server with a Dockerfile. Document how to deploy to Fly.io, Railway, a VPS, or localhost.

**Architecture:**
- Each "room" corresponds to a document being edited
- Server relays Yjs update messages between connected clients
- Server stores no persistent state (stateless relay)
- Awareness protocol broadcasts cursor positions, user names, online status
- Server includes optional room-level auth (token validation against the Git repo)

---

## 7. Authentication & Git Provider Integration

### 7.1 MVP: GitHub OAuth App

- Register a GitHub OAuth App for `cept`
- OAuth flow: redirect to GitHub → user authorizes → callback with code → exchange for token
- Token stored securely (OS keychain on desktop, secure storage on mobile, encrypted in IndexedDB on web)
- Use token for isomorphic-git HTTP auth (via `onAuth` callback)
- Scopes needed: `repo` (full access to private repos)

**Important:** Use isomorphic-git's HTTP transport with the OAuth token, NOT GitHub's API. This keeps the code provider-agnostic.

### 7.2 Repo Selection/Creation UI

- After auth, show a repo picker:
  - List user's repos (use GitHub API here, since this is a UI convenience, not a Git operation)
  - "Create new workspace" button → creates a new repo via GitHub API, initializes with `.cept/` structure
  - "Use existing repo" → enter URL manually
  - "Open local folder" (desktop only) → use native file system directly

### 7.3 Future Providers (Interface Prep)

The `AuthProvider` interface must support:

```
AuthProvider interface:
  - type: "github" | "gitlab" | "bitbucket" | "forgejo" | "ssh" | "https"
  - authenticate() → Token | SSHKey
  - getRepos() → Repo[] (provider-specific API, used only for repo listing UI)
  - getHTTPAuth() → { username, password | token } (for isomorphic-git)
```

For MVP, only implement `GitHubAuthProvider`. But the interface must exist so adding providers later is just implementing a new class.

Document in the codebase with `// TODO: future provider` comments where provider-specific code exists.

---

## 8. Cross-Platform Build Targets

### 8.1 Desktop — macOS (Electrobun)

- Primary desktop build for macOS
- Use Electrobun's Zig-based native layer for performance
- Configure: app name, icon, code signing, notarization
- Output: `.dmg` installer
- If Electrobun is too unstable or missing critical features during implementation, document the issue and fall back to Electron for macOS too

### 8.2 Desktop — Windows & Linux (Electron Fallback)

- Electron wrapping the same React app
- Windows: `.exe` installer (NSIS) + `.msi` + portable `.zip`
- Linux: `.AppImage` + `.deb` + `.rpm` + `.snap`
- Shared `NativeShell` interface means the React app doesn't know which shell it's running in

### 8.3 Web — GitHub Pages + PWA

- Build the Vite SPA
- Deploy to `nsheaps.github.io/cept` via GitHub Actions
- Service worker for offline support and PWA install prompt
- `manifest.json` with app name, icons, theme color
- Full functionality including Git operations (isomorphic-git works in browser via HTTP)
- IndexedDB for local filesystem (lightning-fs) and Yjs persistence

### 8.4 Mobile — iOS & Android (Capacitor)

- Capacitor wraps the web app
- Native plugins for:
  - Secure storage (OAuth tokens)
  - File system access (if needed beyond IndexedDB)
  - Share extension (share content into Cept)
  - Push notifications (for collaboration events)
- iOS: build with Xcode, output `.ipa`
- Android: build with Gradle, output `.apk` + `.aab`

### 8.5 Native Shell Abstraction

```typescript
interface NativeShell {
  platform: "electrobun" | "electron" | "web" | "capacitor-ios" | "capacitor-android";
  
  // Window management
  setTitle(title: string): void;
  setIcon(path: string): void;
  minimize(): void;
  maximize(): void;
  close(): void;
  
  // File system
  showOpenDialog(options: OpenDialogOptions): Promise<string[]>;
  showSaveDialog(options: SaveDialogOptions): Promise<string>;
  
  // OS integration
  showNotification(title: string, body: string): void;
  setMenuBar(menu: MenuDefinition): void;
  copyToClipboard(text: string): void;
  openExternal(url: string): void;
  
  // Auth
  openOAuthPopup(url: string): Promise<{ code: string }>;
  getSecureStorage(): SecureStorage;
  
  // Auto-update
  checkForUpdates(): Promise<UpdateInfo | null>;
  installUpdate(): void;
}
```

---

## 9. CI/CD Pipeline

All workflows use **GitHub Actions**. All workflows use `mise` to install exact tool versions for reproducibility.

### 9.0 Renovate (Dependency Management)

**Renovate** is configured to keep all dependencies up to date automatically, extending the shared org preset from `nsheaps/renovate-config`.

**File: `renovate.json` (committed to repo root):**
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "github>nsheaps/renovate-config"
  ]
}
```

**Ref:** [Renovate shareable config presets](https://docs.renovatebot.com/config-presets/) — the `github>nsheaps/renovate-config` syntax loads `default.json` from the `nsheaps/renovate-config` repository's default branch.

**Requirements:**
- The `renovate.json` file MUST be created during Session 1 bootstrap (Phase -1)
- Renovate PRs go through the full CI pipeline (lint, typecheck, test, build, preview deploy) — this is critical because the GitHub Pages preview deployment lets maintainers **click through the live app** to verify that a dependency update doesn't break UI or functionality
- Any project-specific Renovate overrides (e.g., pinning a package, grouping updates) should be added as `packageRules` in `renovate.json` AFTER the `extends`, never by modifying the upstream preset

### 9.1 CI — Every Push & PR (`.github/workflows/ci.yml`)

```yaml
triggers: [push, pull_request]
jobs:
  lint:
    - Install mise + bun
    - bun install
    - nx run-many -t lint (ESLint + Prettier)
    - nx run-many -t typecheck (tsc --noEmit)
  
  test-unit:
    - nx run-many -t test:unit (Vitest)
    - Upload coverage report
  
  test-integration:
    - nx run-many -t test:integration
    - Tests for GitBackend, database engine, markdown parser
  
  test-e2e:
    - Start web dev server
    - Run Playwright tests
    - Upload screenshot artifacts
    - Upload test results
  
  build:
    - nx run-many -t build (verify all packages build successfully)
```

### 9.1.1 GitHub Pages Preview Deployment (`.github/workflows/preview-deploy.yml`)

**Every PR gets a live preview of the built web app deployed to GitHub Pages**, so that reviewers (and Renovate dependency-update PRs) can click through the actual app to validate functionality.

```yaml
name: Preview Deploy
triggers: [pull_request]

permissions:
  contents: read
  pages: write
  id-token: write
  pull-requests: write  # to post comment with preview URL

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install mise + bun
        run: |
          curl https://mise.run | sh
          mise install
          eval "$(mise activate bash)"
      - name: Install dependencies
        run: bun install
      - name: Build web app
        run: nx run web:build
        env:
          # Set base path for PR-specific subdirectory
          VITE_BASE_PATH: /cept/pr-${{ github.event.pull_request.number }}/
          # Skip onboarding, use BrowserFsBackend with sample content
          CEPT_DEMO_MODE: "true"
      - name: Deploy to GitHub Pages subdirectory
        # Deploy the built web app to a PR-specific path under GitHub Pages
        # Option A: Use actions/deploy-pages with a PR-specific artifact
        # Option B: Push to gh-pages branch under pr-<number>/ subdirectory
        # Choose the approach that best fits the GitHub Pages setup at implementation time
        run: |
          # Deploy built output to /pr-<PR_NUMBER>/ path
          # The exact mechanism (gh-pages branch subdirectory vs. Pages environment)
          # should be determined during implementation based on GitHub Pages constraints
      - name: Comment PR with preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.payload.pull_request.number;
            const previewUrl = `https://nsheaps.github.io/cept/pr-${prNumber}/`;
            const body = `## 🌐 Preview Deployment\n\nThe web app for this PR has been deployed:\n\n**[Open Preview →](${previewUrl})**\n\nUse this to verify the app works correctly, especially for dependency updates.`;
            // Check for existing comment and update, or create new
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: prNumber,
            });
            const existing = comments.find(c => c.body.includes('Preview Deployment'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prNumber,
                body,
              });
            }

  cleanup-preview:
    # Clean up preview deployment when PR is closed/merged
    runs-on: ubuntu-latest
    if: github.event.action == 'closed'
    steps:
      - name: Remove PR preview directory from GitHub Pages
        run: |
          # Remove the /pr-<PR_NUMBER>/ subdirectory from gh-pages branch
          echo "Cleaning up preview for PR #${{ github.event.pull_request.number }}"
```

**Why this matters:**
- **Renovate PRs** — when Renovate bumps a dependency, the preview deployment lets you open the app in a browser and manually verify nothing is broken before merging. This is especially important for UI-affecting dependencies (React, TailwindCSS, TipTap, Mermaid, D3, etc.)
- **Feature PRs** — reviewers can test the actual feature in a live environment without pulling the branch locally
- **The preview runs on `BrowserFsBackend`** (see Section 5.10) since there's no filesystem or Git available in the GitHub Pages environment — this exercises the full editor, database, graph, and template functionality on the lowest-common-denominator backend, which is exactly the same path a brand-new user would hit

### 9.2 Release — Desktop (`.github/workflows/release-desktop.yml`)

```yaml
triggers: [release published, workflow_dispatch]
matrix:
  - { os: macos-latest, target: "electrobun-dmg" }
  - { os: macos-latest, target: "electron-dmg" }  # fallback
  - { os: windows-latest, target: "electron-exe" }
  - { os: windows-latest, target: "electron-msi" }
  - { os: ubuntu-latest, target: "electron-appimage" }
  - { os: ubuntu-latest, target: "electron-deb" }

steps:
  - Install mise + bun
  - bun install
  - nx run-many -t build
  - Package with electron-builder / electrobun build
  - Code sign (macOS: Apple Developer cert, Windows: signtool)
  - Upload to GitHub Release assets
```

### 9.3 Release — Web (`.github/workflows/release-web.yml`)

```yaml
triggers: [release published, push to main]
steps:
  - Install mise + bun
  - bun install
  - nx run web:build
  - Deploy to GitHub Pages (gh-pages branch or actions/deploy-pages)
```

### 9.4 Release — Mobile (`.github/workflows/release-mobile.yml`)

```yaml
triggers: [release published, workflow_dispatch]
jobs:
  android:
    - runs-on: ubuntu-latest
    - Install mise + bun + Java + Android SDK
    - bun install
    - nx run mobile:build
    - npx cap sync android
    - ./gradlew assembleRelease
    - Sign APK
    - Upload to GitHub Release + (optionally) Play Store via fastlane
  
  ios:
    - runs-on: macos-latest
    - Install mise + bun + Xcode
    - bun install
    - nx run mobile:build
    - npx cap sync ios
    - xcodebuild archive + export
    - Upload to GitHub Release + (optionally) TestFlight via fastlane
```

### 9.5 Documentation (`.github/workflows/docs.yml`)

```yaml
triggers: [push to main (docs/** changed), release published]
steps:
  - Install mise + bun
  - Copy screenshots from latest E2E test artifacts into docs/screenshots/
  - Build docs site (VitePress or Starlight)
  - Deploy to GitHub Pages at /cept/docs/ or a separate docs subdomain
```

### 9.6 Local Development Reproducibility

```bash
# One-command setup (documented in README and CONTRIBUTING.md)
mise install          # Installs bun, node, and all tool versions from .mise.toml
bun install           # Install all dependencies
bun run dev           # Start all packages in dev mode (Nx)
bun run dev:web       # Start just the web app
bun run dev:desktop   # Start Electrobun/Electron in dev mode
bun run test          # Run all tests
bun run test:e2e      # Run Playwright E2E
bun run build         # Production build all packages
bun run lint          # Lint everything
bun run typecheck     # Type check everything
nx graph              # Visualize the project dependency graph
nx affected -t test   # Run tests only for changed packages
```

`.mise.toml`:
```toml
[tools]
bun = "1.x"
node = "22.x"    # Required for Electron, some tools
```

---

## 10. Testing Strategy

### 10.1 TDD/BDD Methodology

**This project follows Test-Driven Development (TDD) and Behavior-Driven Development (BDD) as strict requirements, not suggestions.**

**References:**
- [@amiceli/vitest-cucumber](https://github.com/amiceli/vitest-cucumber) — Gherkin feature files with Vitest (unit/integration BDD)
- [quickpickle](https://www.npmjs.com/package/quickpickle) — Alternative Vitest Gherkin plugin with Playwright integration
- [@cucumber/cucumber with Bun](https://medium.com/@dariushalipour/bdd-cucumber-coverage-w-buns-native-test-coverage-tool-04a30f90c5b5) — BDD coverage with Bun's native tools
- [Playwright + Cucumber BDD](https://natasatech.wordpress.com/2025/12/14/playwright-typescript-cucumber-bdd-complete-easy-setup-guide/) — E2E BDD pattern

**TDD cycle for every function/class:**
1. **Red** — Write a failing test FIRST that describes the expected behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the code while keeping tests green
4. Repeat

**BDD cycle for every user-facing feature:**
1. **Write the feature spec** (Gherkin `.feature` file) BEFORE any implementation
2. **Write step definitions** that map Gherkin steps to test code
3. **Run the feature** — confirm it fails (red)
4. **Implement the feature** until all scenarios pass (green)
5. **Refactor** and add edge-case scenarios
6. **Review the feature spec** for completeness — iterate until comprehensive

**Gherkin Feature Files (`.feature`):**

Every user-facing feature gets a corresponding `.feature` file in the `features/` directory. These serve triple duty: as test specifications, as living documentation, and as acceptance criteria.

**Tool choice:** Use `@amiceli/vitest-cucumber` for unit/integration BDD (runs inside Vitest, supports TypeScript, validates missing scenarios). Use `@cucumber/cucumber` with Playwright for E2E BDD tests.

**Example feature file (`features/editor/slash-commands.feature`):**
```gherkin
Feature: Slash Command Menu
  As a user editing a page
  I want to type "/" to see a menu of block types
  So that I can quickly insert any block type without leaving the keyboard

  Background:
    Given I have a workspace with a page open in the editor

  Scenario: Opening the slash menu
    When I type "/" on an empty line
    Then I should see the slash command menu
    And the menu should contain at least 20 block types
    And the menu should be grouped by category

  Scenario: Filtering slash menu by typing
    When I type "/mer"
    Then I should see the slash command menu filtered to "Mermaid"
    And only matching items should be visible

  Scenario: Inserting a heading via slash command
    When I type "/heading1"
    And I press Enter
    Then the current block should become a Heading 1
    And the slash menu should close

  Scenario: Dismissing the slash menu
    When I type "/"
    And I press Escape
    Then the slash menu should close
    And the "/" character should remain in the text

  Scenario: Keyboard navigation in slash menu
    When I type "/"
    And I press the down arrow 3 times
    And I press Enter
    Then the third item in the menu should be inserted
```

**Directory structure for features:**
```
features/
├── editor/
│   ├── slash-commands.feature
│   ├── block-editing.feature
│   ├── drag-and-drop.feature
│   ├── inline-formatting.feature
│   └── mermaid-diagrams.feature
├── database/
│   ├── table-view.feature
│   ├── board-view.feature
│   ├── calendar-view.feature
│   ├── map-view.feature
│   ├── properties.feature
│   └── filter-sort.feature
├── navigation/
│   ├── sidebar.feature
│   ├── page-tree.feature
│   ├── search.feature
│   └── command-palette.feature
├── git/
│   ├── auto-commit.feature
│   ├── auto-branch.feature
│   ├── conflict-resolution.feature
│   └── sync.feature
├── collaboration/
│   ├── realtime-editing.feature
│   ├── presence.feature
│   └── offline-sync.feature
├── graph/
│   ├── global-graph.feature
│   ├── local-graph.feature
│   └── graph-filters.feature
├── storage/
│   ├── browser-backend.feature
│   ├── local-folder.feature
│   ├── open-existing-folder.feature
│   ├── backend-upgrade.feature
│   └── capability-gating.feature
└── step-definitions/
    ├── editor.steps.ts
    ├── database.steps.ts
    ├── navigation.steps.ts
    ├── git.steps.ts
    ├── collaboration.steps.ts
    └── graph.steps.ts
```

### 10.2 Feature Specification Documents

**Every feature gets a comprehensive spec document in `docs/specs/` BEFORE implementation begins.** These specs are iteratively reviewed and improved as the feature is built. They serve as the source of truth for what the feature should do, how it should work, and how to validate it.

**Spec document template (`docs/specs/TEMPLATE.md`):**

```markdown
# Feature: <Feature Name>

## Status: Draft | In Review | Approved | Implemented | Verified

## Overview
One paragraph describing what the feature is and why it matters.

## User Stories
- As a <role>, I want <capability>, so that <benefit>

## Requirements

### Functional Requirements
FR-1: <requirement with verifiable acceptance criteria>
FR-2: ...

### Non-Functional Requirements
NFR-1: Performance — <specific measurable target>
NFR-2: Accessibility — <WCAG criteria>

## Design

### Data Model
How is this stored? Reference the file format spec.

### UI Mockup / Description
Describe or reference wireframes. Screenshots from E2E tests will be added here after implementation.

### API / Interface
TypeScript interfaces for the feature's public API.

## Edge Cases & Error Handling
- What happens when X?
- What happens when Y?

## Dependencies
- Depends on: <other features/modules>
- Depended on by: <other features/modules>

## Test Plan
- Link to `.feature` file(s)
- Key scenarios to validate
- Performance benchmarks

## Research & References
- <link to relevant library docs>
- <link to Notion's equivalent feature>
- <link to Obsidian's equivalent feature>
- <any other verified external reference>

## Revision History
| Date | Author | Changes |
|---|---|---|
| YYYY-MM-DD | Claude | Initial draft |
| YYYY-MM-DD | Claude | Updated after implementation review |
```

**Specs directory:**
```
docs/specs/
├── TEMPLATE.md
├── storage-backends.md
├── editor-blocks.md
├── slash-commands.md
├── database-engine.md
├── database-table-view.md
├── database-board-view.md
├── database-calendar-view.md
├── database-map-view.md
├── knowledge-graph.md
├── mermaid-diagrams.md
├── sidebar-navigation.md
├── git-auto-commit.md
├── git-auto-branch.md
├── conflict-resolution.md
├── realtime-collaboration.md
├── template-system.md
├── search.md
├── import-notion.md
├── import-obsidian.md
├── open-local-folder.md
└── pwa-offline.md
```

**Iterative review process for specs:**
1. **Draft** — Agent writes initial spec based on this prompt + research. Commits as `docs: draft spec for <feature>`.
2. **Research validation** — Agent researches comparable features in Notion, Obsidian, and other tools. Updates spec with findings and external references. Commits as `docs: research review for <feature> spec`.
3. **Implementation review** — During implementation, if any requirement is ambiguous or impossible, update the spec with the actual decision. Commits as `docs: update <feature> spec — <what changed>`.
4. **Post-implementation verification** — After E2E tests pass, update spec status to "Verified" and add screenshots. Commits as `docs: verify <feature> spec`.

### 10.3 Research-Over-Assumption Principle

**When implementing any feature, the agent MUST research before assuming.** This applies to:

1. **Library capabilities** — Before using a library in a way you're not certain about, search its docs or GitHub issues to confirm the API exists and behaves as expected. Cite the source.
2. **Notion/Obsidian behavior** — Before implementing a feature that's meant to replicate Notion or Obsidian, research how the original actually works. Don't guess. Document findings in the feature spec.
3. **File format decisions** — Before adding a new file format or schema field, research how similar tools handle it. Document the alternatives considered and why the chosen approach was selected.
4. **Performance characteristics** — Before assuming a data structure or algorithm is fast enough, research benchmarks or test it. Document findings.

**How to document research:**
- In feature spec: add a "Research & References" section with URLs and key findings
- In code: add `// Research: <URL> — <one-line finding>` comments for non-obvious decisions
- In commit messages: include `[researched]` tag when a commit's approach was validated by research
- **All external references must be verifiable** — include URLs that the reader can visit. Don't cite "common knowledge" for non-trivial claims.

**Cross-referencing:**
- Feature specs should cross-reference related specs (e.g., the database-table-view spec references the database-engine spec)
- Implementation code should reference the spec it implements: `// Implements: docs/specs/database-table-view.md#FR-3`
- Tests should reference the spec requirement they validate: `// Validates: FR-3 in docs/specs/database-table-view.md`

### 10.4 Test Pyramid

| Layer | Tool | Scope | Target Count |
|---|---|---|---|
| **BDD Feature** | vitest-cucumber + @cucumber/cucumber | Gherkin scenarios for user-facing features | 1+ feature file per feature |
| **Unit** | Vitest (TDD) | Individual functions: markdown parser, database engine, CRDT serializer, conflict resolver, formula evaluator | Hundreds |
| **Integration** | Vitest | StorageBackend implementations, GitBackend + sync, database queries, search index | Dozens |
| **Component** | Vitest + React Testing Library | UI components render correctly, respond to interactions | Dozens per component |
| **E2E** | Playwright + Cucumber | Full user flows described in Gherkin, executed in browser | 30-50 critical paths |
| **Visual Regression** | Playwright screenshots | Catch unintended UI changes | Automated per E2E test |
| **Cross-platform** | Playwright + platform-specific | Verify functionality on each build target | Key flows per platform |

### 10.5 Unit Test Requirements

Every module in `packages/core/` must have corresponding tests:

- `markdown/` — Parse Markdown → Block tree → Markdown roundtrip. Test every block type including `<!-- cept:block -->` extensions.
- `database/` — Filter, sort, group, formula evaluation. Test all property types and operators.
- `git/` — Auto-commit logic, branch naming, merge strategy selection, conflict detection.
- `crdt/` — Yjs document → Markdown serialization roundtrip. Concurrent edit simulation.
- `search/` — Indexing and querying accuracy.

### 10.6 E2E Test Flows (Playwright)

Each test captures screenshots at key states. Screenshots are saved to `docs/screenshots/` for use in documentation.

**Critical flows to test:**

1. **Onboarding** — Three paths: "Start writing" → BrowserFsBackend workspace; "Open a folder" → LocalFsBackend workspace; "Connect a Git repo" → OAuth → repo selection → GitBackend workspace
2. **Page CRUD** — Create page, edit with various block types, rename, move, delete, restore from trash
3. **Slash commands** — Type `/`, search, insert each block type
4. **Database: Table** — Create database, add properties, add rows, sort, filter, resize columns
5. **Database: Board** — Switch to board view, drag card between columns, customize card preview
6. **Database: Calendar** — Switch to calendar view, create event, drag to reschedule
7. **Database: Map** — Switch to map view, see pins, click to open
8. **Inline database** — Embed a database in a page, interact with it
9. **Sidebar navigation** — Expand/collapse tree, verify current page highlighted, drag reorder
10. **Page nesting** — Create 5 levels deep, verify breadcrumbs, navigate via sidebar
11. **Templates** — Create from template, save page as template, use template
12. **Search** — Search for page by title, by content, by database value
13. **Collaboration** — Two browser contexts editing same page, verify cursors visible, changes sync
14. **Offline → Online** — Edit while disconnected, reconnect, verify sync
15. **Conflict resolution** — Force a conflict, verify notification appears, resolve via UI
16. **Import from Notion** — Upload Notion export, verify pages imported correctly
17. **Import from Obsidian** — Open Obsidian vault, verify pages imported correctly
18. **Git history** — View page history, see diffs, restore old version
19. **Command palette** — Open with Cmd+K, search, execute action
20. **Settings** — Change theme, change font, verify persistence
21. **Knowledge Graph: Global** — Open graph view, see all pages as nodes, verify links as edges, use physics controls
22. **Knowledge Graph: Local** — Navigate to a page, open local graph, adjust depth slider, verify correct neighborhood
23. **Knowledge Graph: Filters** — Apply path filter, toggle orphans, create color groups, verify visual changes
24. **Mermaid: Insert & Edit** — Insert Mermaid block via `/mermaid`, write flowchart syntax, see live preview
25. **Mermaid: All Diagram Types** — Insert each of the 20+ diagram types, verify rendering
26. **Mermaid: Export** — Right-click diagram, export as SVG and PNG, verify files
27. **Mermaid: Error Handling** — Type invalid syntax, verify error message appears inline, code remains editable
28. **Browser Backend: Full Editor** — Launch with BrowserFsBackend (no Git, no filesystem), create page, use all block types including Mermaid, verify persistence in IndexedDB across reload
29. **Local Folder: Open Existing** — Open a folder containing Markdown files, verify Cept indexes them, knowledge graph shows links, files not modified
30. **Backend Upgrade: Local → Git** — Start with LocalFsBackend, create content, click "Set up Git" in settings, verify existing content becomes initial commit, history/collab UI lights up
31. **Backend Capability Gating** — With BrowserFsBackend, verify history panel is absent (not grayed out), sync status is absent, collaboration panel is absent

### 10.7 Screenshot Capture for Documentation

```typescript
// In every Playwright test, capture screenshots at key moments:
await page.screenshot({
  path: `docs/screenshots/${testName}-${stepName}.png`,
  fullPage: false, // Capture viewport only for consistency
});
```

Screenshots are:
- Committed to the repo in `docs/screenshots/`
- Referenced in the documentation site
- Updated automatically when E2E tests run in CI
- Used for visual regression comparison

### 10.8 Test Fixtures

Create a set of reusable test fixtures in `e2e/fixtures/`:

- `test-workspace/` — A Git repo pre-populated with sample pages, databases, templates
- `notion-export.zip` — Sample Notion export for import testing
- `obsidian-vault/` — Sample Obsidian vault for import testing
- `conflict-scenarios/` — Pre-staged Git repos with conflicting branches

---

## 11. Documentation Site

### 11.1 Technology

Use **Starlight** (Astro-based, great for docs) or **VitePress**. Both support Markdown with excellent navigation. Choose at implementation time based on which integrates better with the monorepo.

### 11.2 Documentation Structure

```
docs/
├── index.md                            # Landing page with hero + feature overview
├── getting-started/
│   ├── installation.md                 # All platforms (desktop, web PWA, mobile)
│   ├── quick-start.md                  # Create first workspace, first page
│   ├── configuration.md                # Settings reference
│   └── keyboard-shortcuts.md
├── guides/
│   ├── editing-pages.md                # Block types, slash commands, formatting
│   ├── databases.md                    # Creating and using databases
│   ├── database-views.md              # Table, Board, Calendar, Map, Gallery
│   ├── knowledge-graph.md             # Global/local graph, filters, color groups
│   ├── mermaid-diagrams.md            # All diagram types, editing modes, export
│   ├── collaboration.md               # Real-time editing, signaling server setup
│   ├── templates.md                    # Using and creating templates
│   ├── import-export.md               # Import from Notion, Obsidian. Export options.
│   ├── migrate-from-notion.md         # Step-by-step Notion migration guide
│   ├── migrate-from-obsidian.md       # Step-by-step Obsidian migration guide
│   ├── manual-git-editing.md          # For power users: edit files via Git directly
│   ├── self-hosting-signaling.md      # Deploy your own signaling server
│   ├── offline-usage.md               # How offline mode works
│   └── troubleshooting.md
├── specs/                              # Feature specifications (living docs, iteratively reviewed)
│   ├── TEMPLATE.md                    # Spec template
│   └── <feature-name>.md             # One per feature, cross-referenced
├── reference/
│   ├── file-format.md                  # Complete file format specification
│   ├── database-schema.md             # Database YAML schema reference
│   ├── block-types.md                 # All block types with encoding details
│   ├── mermaid-reference.md           # Mermaid diagram types quick reference
│   ├── configuration.md               # config.yaml reference
│   ├── keyboard-shortcuts.md          # Full shortcut reference
│   └── api.md                         # Internal module API docs (auto-generated)
├── contributing/
│   ├── development-setup.md           # How to set up the dev environment
│   ├── architecture.md                # Architecture overview
│   ├── testing.md                     # How to run and write tests (TDD/BDD guide)
│   └── writing-specs.md              # How to write and review feature specs
└── screenshots/                        # Auto-populated by Playwright
```

### 11.3 Documentation Requirements

- Every page includes **screenshots** from the Playwright E2E tests
- All file formats and schemas are documented with complete examples
- Migration guides include screenshots of both the source tool and Cept side by side
- Getting started guide goes from zero to working workspace in under 5 minutes
- All configuration options documented with defaults and examples
- **Every feature has a spec in `docs/specs/`** that is written BEFORE implementation and updated AFTER
- **Feature specs include external references** — links to comparable features in Notion, Obsidian, and relevant library docs. All references must be verifiable URLs.
- **Feature specs cross-reference each other** — e.g., the knowledge-graph spec links to the sidebar spec for local graph panel integration
- **The contributing guide documents the TDD/BDD workflow** with concrete examples of writing `.feature` files, step definitions, and the red-green-refactor cycle

---

## 12. Claude Code Setup & Agent Configuration

This section defines the complete Claude Code development environment, including the `.claude/` configuration directory, session bootstrap scripts, custom slash commands, sub-agents, and specific support for **Claude Code Web** (browser-based sessions with ephemeral containers).

### 12.1 First-Session Bootstrap Protocol

**The very first thing the agent does — before ANY feature work — is build the Claude Code infrastructure itself.** This means the first session's sole purpose is creating all `.claude/` configuration, scripts, commands, agents, and the `CLAUDE.md` file. Once complete, the agent should tell the user it is done and to start a new session by saying `continue`.

**Session 1 output checklist:**
- [ ] `CLAUDE.md` in repo root (project knowledge file)
- [ ] `.claude/settings.json` (project-level settings)
- [ ] `.claude/scripts/session-start.sh` (bootstrap script run at session start)
- [ ] `.claude/commands/` directory with all custom slash commands
- [ ] `.claude/agents/` directory with all sub-agent definitions
- [ ] `TASKS.md` in repo root (master task tracker)
- [ ] `.mise.toml` validated and working
- [ ] Git repo initialized with initial commit of all the above
- [ ] Agent prints: "Bootstrap complete. Exit this session and type `continue` to begin development with the new configuration."

### 12.2 CLAUDE.md — Project Knowledge File

The `CLAUDE.md` file is the persistent memory for Claude Code across sessions. It is read automatically at the start of every session. It must contain everything the agent needs to resume work without re-reading this prompt.

```markdown
# CLAUDE.md — Cept Project Knowledge

## Project Summary
Cept is a Notion clone with multiple storage backends: browser (IndexedDB), local folder, or Git repo. Git adds collaboration, history, and sync — but the full editor/database/graph experience works on any backend. See the full spec in `.claude/prompts/init.md` (the bootstrap prompt).

## Repository
- **Remote:** github.com/nsheaps/cept
- **Default branch:** main
- **All work happens on `main`.** Commit and push directly to `main`. Do NOT create feature branches, develop branches, or PR workflows. The only exception is `wip/T<X>.<Y>` branches for interrupted sessions (see below), which get rebased onto `main` immediately in the next session.

## Toolchain
- **mise** manages all tool versions (see `.mise.toml`)
- **Bun** is the JS runtime, package manager, bundler, and test runner
- **Nx** orchestrates monorepo tasks (with Bun workspaces)
- **TypeScript strict mode** everywhere — no `any`, no `@ts-ignore`

## Key Commands
```bash
mise install                    # Install all tool versions
bun install                     # Install dependencies
bun run dev                     # Dev mode (all packages)
bun run dev:web                 # Dev mode (web only)
bun run dev:desktop             # Dev mode (desktop only)
bun run build                   # Production build
bun run test                    # All unit + integration tests
bun run test:unit               # Unit tests only
bun run test:integration        # Integration tests only
bun run test:e2e                # Playwright E2E tests
bun run test:e2e:screenshots    # E2E with screenshot capture
bun run lint                    # ESLint + Prettier
bun run typecheck               # tsc --noEmit
bun run validate                # lint + typecheck + test (full gate)
nx graph                        # Visualize project dependency graph
nx affected -t test             # Test only affected packages
nx affected -t build            # Build only affected packages
```

## Monorepo Packages
| Package | Path | Purpose |
|---|---|---|
| `@cept/core` | `packages/core/` | Business logic, StorageBackend (browser/local/git), DB engine, CRDT, parsers, graph |
| `@cept/ui` | `packages/ui/` | React components, hooks, stores (no platform deps) |
| `@cept/web` | `packages/web/` | Vite SPA + PWA service worker |
| `@cept/desktop` | `packages/desktop/` | Electrobun (macOS) + Electron (Win/Linux) shells |
| `@cept/mobile` | `packages/mobile/` | Capacitor iOS + Android |
| `@cept/signaling` | `packages/signaling-server/` | Yjs WebSocket signaling server |
| `@cept/docs` | `docs/` | Starlight/VitePress documentation site |
| `@cept/e2e` | `e2e/` | Playwright E2E tests + screenshot capture |

## Architecture Rules (NEVER VIOLATE)
1. `@cept/ui` and `@cept/core` must NEVER import platform-specific modules (electron, @capacitor/*, node:fs direct)
2. All persistence goes through the `StorageBackend` interface — NEVER read/write files directly
3. `@cept/core` and `@cept/ui` depend ONLY on `StorageBackend`, NEVER on a specific backend implementation
4. Git-specific UI is gated by `backend.capabilities` checks, NEVER by `backend.type === "git"`
5. NO module outside of `GitBackend` may import `isomorphic-git` directly
6. The app MUST boot to a fully functional state with `BrowserFsBackend` alone — zero Git, zero filesystem
7. All auth goes through `AuthProvider` abstraction (only needed for Git remotes)
8. Prefer isomorphic-git over GitHub API for all Git operations
9. Markdown files use HTML comments (`<!-- cept:block -->`) for extended blocks
10. Database schemas are YAML files in `.cept/databases/`
11. Opening a local folder MUST NOT modify existing files unless the user explicitly edits them in Cept

## Task Tracking
Current progress is tracked in `TASKS.md`. Always:
1. Check `TASKS.md` for current phase and next task
2. Follow the task execution protocol (Spec & Research → Red → Green → Refactor → Validate → Document & Review Spec → Commit)
3. Mark tasks complete when done
4. Never skip to a later phase without completing the current one

## Session Resume Protocol
When resuming work (user says "continue"):
1. Ensure you are on `main` branch. If a `wip/` branch exists from a previous interrupted session, rebase it onto `main`, fast-forward merge, delete the WIP branch, and push.
2. `git pull` to get latest changes
3. Read `TASKS.md` to determine current phase and last completed task
4. Run `bun run validate` to verify the repo is in a clean state
5. If tests fail, fix them before starting new work
6. Pick up the next incomplete task
7. Follow the task execution protocol
8. Commit and push to `main` after each completed task

## Testing Requirements
- Every new function/class gets unit tests
- Every new UI component gets component tests
- Every new user-visible feature gets E2E tests with screenshots
- `bun run validate` must pass before committing
- Screenshots go to `docs/screenshots/` for documentation

## Claude Code Web Notes
- Container is ephemeral — all work must be committed to Git
- Run `session-start.sh` automatically at session start (it handles tool installation)
- Use `git push` frequently to preserve work
- If `mise` or `bun` are not available, the session-start script installs them
- Network access is limited to allowed domains — see `.claude/settings.json`
```

### 12.3 Session Start Script

`.claude/scripts/session-start.sh` runs at the beginning of every Claude Code session (including Claude Code Web). It ensures the environment is fully ready regardless of whether the container is fresh or persistent.

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Cept Session Bootstrap ==="

# ---- 1. Detect environment ----
IS_WEB_SESSION=false
if [[ "${CLAUDE_CODE_WEB:-}" == "true" ]] || [[ ! -d "$HOME/.local" && ! -f "$HOME/.mise/bin/mise" ]]; then
  IS_WEB_SESSION=true
  echo "[env] Detected ephemeral/web container"
else
  echo "[env] Detected persistent environment"
fi

# ---- 2. Install mise if missing ----
if ! command -v mise &>/dev/null; then
  echo "[setup] Installing mise..."
  curl -fsSL https://mise.run | sh
  export PATH="$HOME/.local/bin:$PATH"
  # Add to shell profile for this session
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

# ---- 3. Install tool versions via mise ----
echo "[setup] Installing tool versions from .mise.toml..."
mise install --yes 2>/dev/null || mise install
eval "$(mise activate bash)"

# ---- 4. Verify bun is available ----
if ! command -v bun &>/dev/null; then
  echo "[error] Bun not available after mise install. Falling back to direct install."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "[tools] mise version: $(mise --version)"
echo "[tools] bun version: $(bun --version)"
echo "[tools] node version: $(node --version 2>/dev/null || echo 'not installed')"

# ---- 5. Install dependencies ----
if [[ ! -d "node_modules" ]] || [[ "$IS_WEB_SESSION" == "true" ]]; then
  echo "[deps] Installing dependencies..."
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  echo "[deps] node_modules exists, skipping install"
fi

# ---- 6. Verify Git configuration ----
if ! git config user.name &>/dev/null; then
  git config user.name "Claude Code"
  git config user.email "claude-code@cept.dev"
fi

# ---- 7. Ensure we're on main ----
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
echo "[git] Current branch: $CURRENT_BRANCH"

# Handle WIP branches from interrupted sessions
WIP_BRANCH=$(git branch --list 'wip/*' 2>/dev/null | head -1 | tr -d ' *' || true)
if [[ -n "$WIP_BRANCH" ]]; then
  echo "[git] Detected WIP branch: $WIP_BRANCH — rebasing onto main..."
  git checkout main
  git pull --rebase 2>/dev/null || true
  git rebase main "$WIP_BRANCH" 2>/dev/null && {
    git checkout main
    git merge --ff-only "$WIP_BRANCH"
    git branch -d "$WIP_BRANCH"
    git push origin --delete "$WIP_BRANCH" 2>/dev/null || true
    git push
    echo "[git] WIP branch merged into main and cleaned up"
  } || {
    echo "[git] WARNING: WIP rebase had conflicts — agent should resolve manually"
    git rebase --abort 2>/dev/null || true
    git checkout main
  }
elif [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "[git] Switching to main..."
  git checkout main
  git pull --rebase 2>/dev/null || true
fi

# ---- 8. Run quick validation ----
echo "[validate] Running typecheck..."
bun run typecheck 2>/dev/null && echo "[validate] Typecheck passed" || echo "[validate] Typecheck had issues (non-blocking for session start)"

echo "[validate] Running tests..."
bun run test 2>/dev/null && echo "[validate] Tests passed" || echo "[validate] Some tests failed (check TASKS.md for context)"

# ---- 9. Print status summary ----
echo ""
echo "=== Session Ready ==="
echo ""
if [[ -f "TASKS.md" ]]; then
  echo "--- Current Progress ---"
  # Show the last completed task and next TODO
  grep -n "^\- \[x\]" TASKS.md | tail -3 || true
  echo "..."
  grep -n "^\- \[ \]" TASKS.md | head -3 || true
  echo ""
fi
echo "Run 'bun run dev:web' to start the dev server"
echo "Run 'bun run validate' for full validation"
echo "========================"
```

### 12.4 Claude Code Settings

`.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "bash(mise *)",
      "bash(bun *)",
      "bash(bunx *)",
      "bash(npx *)",
      "bash(nx *)",
      "bash(git *)",
      "bash(node *)",
      "bash(cat *)",
      "bash(ls *)",
      "bash(find *)",
      "bash(grep *)",
      "bash(head *)",
      "bash(tail *)",
      "bash(wc *)",
      "bash(sort *)",
      "bash(mkdir *)",
      "bash(cp *)",
      "bash(mv *)",
      "bash(rm *)",
      "bash(chmod *)",
      "bash(sed *)",
      "bash(awk *)",
      "bash(curl *)",
      "bash(which *)",
      "bash(echo *)",
      "bash(printf *)",
      "bash(test *)",
      "bash(diff *)",
      "bash(patch *)",
      "bash(xargs *)",
      "bash(tee *)",
      "bash(playwright *)"
    ],
    "deny": []
  },
  "env": {
    "FORCE_COLOR": "1",
    "NODE_ENV": "development",
    "CLAUDE_CODE_PROJECT": "cept"
  }
}
```

### 12.5 Custom Slash Commands

Create these as files in `.claude/commands/`. Each file is a markdown prompt that defines the command behavior.

#### `.claude/commands/continue.md`
```markdown
# /continue — Resume Development

Read `TASKS.md` and determine the current phase and next incomplete task.

1. Run `bun run validate` to check repo health
2. If validation fails, fix issues first and re-run until green
3. Identify the next incomplete task (first `- [ ]` in TASKS.md)
4. Announce: "Resuming work on task T<X>.<Y>: <description>"
5. Execute the task following the Task Execution Protocol:
   - **Plan**: Identify files to create/modify, dependencies, tests needed
   - **Implement**: Write the code
   - **Test**: Write and run tests
   - **Validate**: `bun run validate` must pass
   - **Document**: Update TASKS.md, docs if needed
   - **Commit**: `git add -A && git commit -m "feat(<scope>): <description> [T<X>.<Y>]" && git push`
6. After completing the task, check if there is time/context remaining for the next task
7. If yes, continue to next task. If no, print a summary of what was done and what's next.

**CRITICAL**: Never skip the Test or Validate steps. Never move to the next phase without completing all tasks in the current phase.
```

#### `.claude/commands/validate.md`
```markdown
# /validate — Full Quality Gate Check

Run the complete validation suite and report results:

```bash
echo "=== Lint ===" && bun run lint
echo "=== Typecheck ===" && bun run typecheck
echo "=== Unit Tests ===" && bun run test:unit
echo "=== Integration Tests ===" && bun run test:integration
echo "=== E2E Tests ===" && bun run test:e2e
```

After running all checks, produce a summary table:

| Check | Status | Details |
|---|---|---|
| Lint | ✅/❌ | X warnings, Y errors |
| Typecheck | ✅/❌ | X errors |
| Unit Tests | ✅/❌ | X passed, Y failed, Z skipped |
| Integration Tests | ✅/❌ | X passed, Y failed |
| E2E Tests | ✅/❌ | X passed, Y failed |

If any check fails, list the specific failures and propose fixes.
Do NOT proceed with new feature work until all checks pass.
```

#### `.claude/commands/status.md`
```markdown
# /status — Project Status Report

Generate a comprehensive status report:

1. Read `TASKS.md` and count completed vs total tasks per phase
2. Run `git log --oneline -20` to show recent commits
3. Run `bun run validate` (quick mode) to check health
4. Check for any TODO/FIXME/HACK comments: `grep -rn "TODO\|FIXME\|HACK" packages/ --include="*.ts" --include="*.tsx" | head -20`
5. Check test coverage if available

Output a summary like:

```
=== Cept Project Status ===

Phase Progress:
  Phase 0: Foundation     [5/7 complete] ████████░░ 71%
  Phase 1: Core Engine    [0/8 complete] ░░░░░░░░░░  0%
  ...

Health: ✅ All checks passing (or ❌ with details)
Last commit: <hash> <message> (<time ago>)
Next task: T0.6 — Set up Playwright with smoke test
Open TODOs: 12
```
```

#### `.claude/commands/new-task.md`
```markdown
# /new-task — Add An Unplanned Task

When the user identifies something that needs to be done that isn't in TASKS.md:

1. Ask which phase it belongs to (or create a new sub-phase)
2. Assign it the next available task number in that phase
3. Add it to TASKS.md in the correct position
4. Note it was added ad-hoc with the date
5. Ask if the user wants to work on it now or continue with the current sequence

Format in TASKS.md:
```
- [ ] T<X>.<Y>: <description> *(added ad-hoc YYYY-MM-DD)*
```
```

#### `.claude/commands/screenshot-review.md`
```markdown
# /screenshot-review — Review E2E Screenshots

1. Run the E2E tests with screenshot capture: `bun run test:e2e:screenshots`
2. List all new/changed screenshots in `docs/screenshots/`
3. For each changed screenshot, show the path and describe what it captures
4. Ask the user to confirm the screenshots look correct
5. If confirmed, commit them: `git add docs/screenshots/ && git commit -m "docs: update E2E screenshots"`
```

#### `.claude/commands/phase-gate.md`
```markdown
# /phase-gate — Phase Completion Verification

Run before starting a new phase. Checks ALL quality gates:

1. Verify all tasks in the current phase are marked `[x]` in TASKS.md
2. Run full validation suite (`/validate`)
3. Check code coverage for the phase's primary package (target: 80%+)
4. Verify documentation is updated for all new features
5. Run E2E tests and capture fresh screenshots
6. Create a summary commit: `git commit -m "milestone: complete Phase X"`
7. Tag the commit: `git tag phase-X-complete`
8. Push: `git push && git push --tags`
9. Print: "Phase X complete. Ready to begin Phase X+1."

If any gate fails, list what's missing and do NOT proceed.
```

### 12.6 Sub-Agents

Define specialized sub-agents in `.claude/agents/` for focused tasks. These can be invoked by the main agent to handle specialized work without losing context on the broader task.

#### `.claude/agents/test-writer.md`
```markdown
# Test Writer Agent

You are a specialized testing agent for the Cept project. Your sole job is writing comprehensive tests.

## Your Inputs
You will be given:
- A file path or module name to test
- The source code of that module
- The testing framework (Vitest for unit/integration, Playwright for E2E)

## Your Outputs
- Complete test files with all edge cases covered
- For unit tests: test each exported function with normal cases, edge cases, error cases
- For integration tests: test cross-module interactions with realistic scenarios
- For E2E tests: test complete user flows with screenshot capture at key moments
- For component tests: test rendering, user interactions, state changes, accessibility

## Rules
- Use descriptive test names: `it("should resolve conflicts when both users edit the same block offline")`
- Group related tests in `describe` blocks
- Use test fixtures from `e2e/fixtures/` when available
- Mock external dependencies (Git remote, signaling server) in unit tests
- Do NOT mock in E2E tests — use real instances
- Every E2E test captures screenshots: `await page.screenshot({ path: \`docs/screenshots/\${name}.png\` })`
- Target: every branch in the source code should be covered by at least one test
- Include negative tests (what happens when inputs are invalid?)
```

#### `.claude/agents/doc-writer.md`
```markdown
# Documentation Writer Agent

You are a specialized documentation agent for the Cept project.

## Your Inputs
You will be given:
- A feature or module that needs documentation
- The source code and any existing docs

## Your Outputs
- Clear, user-friendly documentation written in Markdown
- Screenshots referenced from `docs/screenshots/` (note which ones are needed if they don't exist yet)
- Code examples where appropriate
- Step-by-step guides for user-facing features
- API reference for developer-facing modules

## Rules
- Write for the target audience: end users for guides, developers for reference/contributing docs
- Every guide starts with "What you'll learn" and "Prerequisites"
- Include screenshots for every UI-related guide
- Use admonitions (:::tip, :::warning, :::note) for important callouts
- Cross-link related documentation pages
- Keep paragraphs short (3-4 sentences max)
- Include a "Troubleshooting" section in guides where things commonly go wrong
- Reference the file format spec (`docs/reference/file-format.md`) when discussing data structures
```

#### `.claude/agents/reviewer.md`
```markdown
# Code Reviewer Agent

You are a specialized code review agent for the Cept project.

## Your Inputs
You will be given a set of changed files (or a diff) to review.

## Your Review Checklist
1. **Architecture compliance**: Does the code respect abstraction boundaries? No platform-specific imports in @cept/ui or @cept/core?
2. **TypeScript quality**: No `any` types, no `@ts-ignore`, proper generics, discriminated unions where appropriate?
3. **Error handling**: Are errors caught and handled gracefully? Are error messages user-friendly?
4. **Testing**: Does the changeset include corresponding tests? Are edge cases covered?
5. **Performance**: Any N+1 loops? Unnecessary re-renders? Missing memoization? Should this use a Web Worker?
6. **Accessibility**: Are interactive elements keyboard-navigable? Proper ARIA attributes? Semantic HTML?
7. **File format compliance**: Do Markdown extensions use the `<!-- cept:block -->` format? Is YAML schema valid?
8. **Documentation**: Are JSDoc comments on public APIs? Are complex algorithms explained?
9. **Security**: No secrets in code? OAuth tokens handled securely? Input sanitized?
10. **Git hygiene**: Is the commit message descriptive with task ID? Are changes atomic?

## Output Format
For each issue found:
- **File**: path/to/file.ts:lineNumber
- **Severity**: 🔴 Critical / 🟡 Warning / 🔵 Suggestion
- **Issue**: Description
- **Fix**: Suggested code change

End with a summary: "X critical, Y warnings, Z suggestions. [APPROVE/REQUEST CHANGES]"
```

#### `.claude/agents/migrator.md`
```markdown
# Data Migration Agent

You are a specialized agent for building import/export functionality in Cept.

## Notion Import
- Parse Notion's ZIP export format (HTML + CSV + Markdown)
- Map Notion's block types to Cept's block encoding
- Convert Notion databases (CSV) to Cept's YAML database schema
- Preserve page hierarchy, links between pages, and database relations
- Handle embedded images (copy to .cept/assets/)
- Generate a migration report showing what was imported and any issues

## Obsidian Import
- Read an Obsidian vault directory structure
- Convert Obsidian's `[[wiki-links]]` to Cept's mention format
- Convert Obsidian front matter to Cept front matter (add missing fields like `id`)
- Handle Obsidian plugins' custom syntax (dataview, etc.) — convert where possible, flag where not
- Preserve folder structure as page hierarchy

## Export
- Markdown export: strip `<!-- cept:block -->` comments, output clean Markdown
- HTML export: render full page with styling
- PDF export: render via headless browser

## Rules
- Never lose user data during import — if something can't be converted, preserve it as a code block with a warning comment
- Generate a migration report as a Cept page (`.cept/migration-report.md`)
- Include before/after screenshots in tests
```

### 12.7 Claude Code Web Specific Considerations

Claude Code Web runs in an ephemeral container. These constraints must be handled:

1. **No persistent filesystem** — Everything not committed to Git is lost between sessions. The session-start script reinstalls tools. Dependencies are reinstalled from lockfile.

2. **Push early and often** — After every completed task, push to remote. The `/continue` command starts with a `git pull` to get the latest state.

3. **Network restrictions** — Only allowed domains are accessible (see the repo's network config). All dependencies must come from npm/GitHub. The signaling server must be on an allowed domain for E2E tests.

4. **No GUI** — Playwright runs headless. Use `--headed` only in local dev. Screenshots are the only visual output.

5. **Session time limits** — Sessions may be interrupted. The task execution protocol ensures that every task is atomic and committable independently. Partial work should be committed to a WIP branch if the session is ending:
   ```bash
   git checkout -b wip/T<X>.<Y>-<description>
   git add -A
   git commit -m "wip: T<X>.<Y> in progress — <what's done, what's left>"
   git push -u origin wip/T<X>.<Y>-<description>
   ```

6. **Session-start script must be idempotent** — Running it multiple times is safe. It checks for existing tools before installing. It checks for existing `node_modules` before installing deps.

7. **Git credentials in web** — Claude Code Web provides Git credentials via environment variables. The session-start script should NOT try to configure SSH keys or credential helpers manually.

### 12.8 Repository Files Created During Bootstrap

At the end of Session 1, the repository should contain exactly these files (committed and pushed):

```
cept/
├── .claude/
│   ├── settings.json
│   ├── scripts/
│   │   └── session-start.sh          # chmod +x
│   ├── commands/
│   │   ├── continue.md
│   │   ├── validate.md
│   │   ├── status.md
│   │   ├── new-task.md
│   │   ├── screenshot-review.md
│   │   └── phase-gate.md
│   └── agents/
│       ├── test-writer.md
│       ├── doc-writer.md
│       ├── reviewer.md
│       └── migrator.md
├── .gitignore
├── .mise.toml
├── renovate.json                      # Renovate config extending github>nsheaps/renovate-config
├── CLAUDE.md
├── TASKS.md                           # Complete task breakdown, all items [ ] unchecked
├── README.md                          # Project overview with badges
├── LICENSE                            # MIT or user's choice
├── docs/
│   ├── SPECIFICATION.md              # Copy of .claude/prompts/init.md for human reference
│   └── specs/
│       └── TEMPLATE.md               # Feature spec template
├── features/
│   └── example.feature               # Smoke test BDD feature file
├── package.json                       # Workspace root
├── nx.json                         # Nx config (stub)
└── bunfig.toml                        # Bun config
```

This is the **minimum viable repo** that lets the next session run `/continue` and immediately begin Phase 0 tasks with full context.

### 12.9 Multi-Session Workflow

**All work happens on `main`. No feature branches, no develop branch, no PRs between branches.**

```
Session 1 (Bootstrap):
  Agent creates all .claude/ config, CLAUDE.md, TASKS.md, stubs
  Agent commits and pushes to main
  Agent says: "Bootstrap complete. Start a new session and type 'continue'."
  User exits session

Session 2+:
  session-start.sh runs automatically (installs tools, deps)
  User types: "continue" (or /continue)
  Agent checks out main, pulls latest
  If a wip/ branch exists: rebase onto main, merge, delete wip branch, push
  Agent reads CLAUDE.md for context
  Agent reads TASKS.md for current progress
  Agent runs validation
  Agent picks up next task
  Agent follows Task Execution Protocol
  Agent commits and pushes to main after each task
  ... repeat until session ends or phase completes ...
  Agent prints summary of work done + next task

If interrupted mid-task:
  Agent commits WIP to wip/T<X>.<Y> branch and pushes
  Next session: agent detects WIP branch, rebases onto main, fast-forward merges, deletes WIP branch, continues
```

---

## 13. Task Execution Methodology

### 13.1 Master Task Plan

Before writing any code, create a `TASKS.md` file in the repo root that breaks the entire project into phases and tasks. This is the single source of truth for progress.

**Phase -1: Claude Code Bootstrap (Session 1 ONLY)**
- T-1.1: Create `.claude/settings.json` with permissions
- T-1.2: Create `.claude/scripts/session-start.sh` (idempotent bootstrap)
- T-1.3: Create all `.claude/commands/` slash commands
- T-1.4: Create all `.claude/agents/` sub-agent definitions
- T-1.5: Create `CLAUDE.md` with full project knowledge
- T-1.6: Create `TASKS.md` with complete task breakdown (this list)
- T-1.7: Create `.mise.toml`, `.gitignore`, `bunfig.toml`, `package.json` (root), `nx.json`, `renovate.json` (extending `github>nsheaps/renovate-config`)
- T-1.8: Create `README.md` with project overview
- T-1.9: Create `docs/specs/TEMPLATE.md` (feature spec template)
- T-1.10: Create `features/example.feature` (smoke test BDD feature)
- T-1.11: Copy `.claude/prompts/init.md` → `docs/SPECIFICATION.md` (so the full spec is browsable in docs/ for contributors)
- T-1.12: Initialize Git repo, commit all, push to `github.com/nsheaps/cept`
- T-1.13: Print "Bootstrap complete" message and exit

**Phase 0: Foundation (Infrastructure)**
- T0.1: Initialize monorepo with mise, bun, Nx (`npx create-nx-workspace --packageManager bun --workspaces`), tsconfig
- T0.2: Set up CI workflow (lint + typecheck + test stubs)
- T0.3: Create `packages/core/` with all abstraction interfaces (types only)
- T0.4: Create `packages/ui/` skeleton with React, TailwindCSS, Storybook
- T0.5: Create `packages/web/` Vite entry point with dev server
- T0.6: Set up Playwright with a single smoke test
- T0.7: Set up Vitest with a single unit test
- T0.8: Set up BDD tooling — `@amiceli/vitest-cucumber` for unit BDD, `@cucumber/cucumber` + Playwright for E2E BDD
- T0.9: Create `features/` directory structure with a single example `.feature` file and step definitions
- T0.10: Create `docs/specs/TEMPLATE.md` and initial feature spec stubs for Phase 1 features
- T0.11: Set up GitHub Pages preview deployment workflow (`.github/workflows/preview-deploy.yml`) — builds web app and deploys to `/pr-<number>/` path on every PR
- T0.12: Implement `CEPT_DEMO_MODE` flag — onboarding skips backend selection, goes straight to `BrowserFsBackend` with sample content

**Phase 1: Core Engine**
- T1.1: Implement `StorageBackend` interface + `BrowserFsBackend` (lightning-fs / IndexedDB) + `LocalFsBackend` (Node fs)
- T1.2: Implement `GitBackend` extending `StorageBackend` with isomorphic-git (clone, commit, push, pull, branch, merge)
- T1.3: Implement Markdown ↔ Block tree parser (CommonMark + GFM + cept extensions)
- T1.4: Implement YAML front matter parser/serializer
- T1.5: Implement database engine (schema, CRUD, filter, sort, group)
- T1.6: Implement formula evaluator for database formulas
- T1.7: Implement search index (client-side full-text)
- T1.8: Implement template engine

**Phase 2: Editor UI**
- T2.1: TipTap editor setup with basic blocks (paragraph, headings, lists)
- T2.2: All text blocks (code, quote, callout, toggle, divider)
- T2.3: Media blocks (image, embed, bookmark)
- T2.4: Slash command menu
- T2.5: Block drag-and-drop reordering
- T2.6: Block actions menu (⋮)
- T2.7: Inline formatting toolbar
- T2.8: Column layout blocks
- T2.9: Mentions (page, person, date)
- T2.10: Math equations (KaTeX)
- T2.11: Mermaid diagram block — custom TipTap node with live preview, code/preview/split modes, all 20+ diagram types, SVG/PNG export, slash command templates (ref: `docs/specs/mermaid-diagrams.md`)

**Phase 3: Navigation & Page Management**
- T3.1: Sidebar with page tree (infinite nesting)
- T3.2: Current page highlighting + auto-expand in sidebar
- T3.3: Breadcrumbs in topbar
- T3.4: Page CRUD (create, rename, move, delete, restore)
- T3.5: Favorites and recent sections
- T3.6: Trash with restore
- T3.7: Command palette (Cmd+K)
- T3.8: Full-text search UI
- T3.9: Knowledge Graph — global view with D3 force-directed layout, node/edge rendering, physics controls (ref: `docs/specs/knowledge-graph.md`)
- T3.10: Knowledge Graph — local view with depth slider, auto-update on page navigation
- T3.11: Knowledge Graph — filters (search, tags, orphans, attachments, path exclusion), color groups
- T3.12: Knowledge Graph — time-lapse animation, performance optimization with Web Worker + quadtree for 1000+ nodes

**Phase 4: Databases**
- T4.1: Database schema UI (add/edit/reorder properties)
- T4.2: Table view with sortable, filterable, resizable columns
- T4.3: Board/Kanban view with drag-and-drop
- T4.4: Calendar view
- T4.5: Map view (Leaflet + OpenStreetMap)
- T4.6: Gallery view
- T4.7: List view
- T4.8: Inline database blocks (embed in pages)
- T4.9: Linked database views (reference existing DB with custom filter)
- T4.10: Relations and rollups
- T4.11: Select/Multi-select dropdown editors with color
- T4.12: All remaining property type editors

**Phase 5: Git & Auth**
- T5.1: GitHub OAuth App flow
- T5.2: Repo picker/creator UI
- T5.3: Auto-commit engine
- T5.4: Auto-branch strategy
- T5.5: Auto-merge + conflict resolution engine
- T5.6: Conflict notification + resolution UI
- T5.7: Page history viewer (Git log + diff)
- T5.8: Sync engine (pull/push cycle)

**Phase 6: Collaboration**
- T6.1: Yjs integration with TipTap (y-prosemirror)
- T6.2: Signaling server implementation
- T6.3: Presence awareness (cursors, avatar stack)
- T6.4: Real-time sync of database changes
- T6.5: Offline queue + reconnect sync

**Phase 7: Cross-Platform**
- T7.1: Electrobun desktop shell (macOS)
- T7.2: Electron desktop shell (Windows/Linux)
- T7.3: PWA service worker + manifest
- T7.4: Capacitor mobile project setup
- T7.5: Mobile-specific UI adaptations (responsive, touch)
- T7.6: Native OAuth flow for mobile

**Phase 8: Import/Export & Templates**
- T8.1: Notion export ZIP importer
- T8.2: Obsidian vault importer
- T8.3: Markdown/HTML/PDF exporter
- T8.4: Built-in template library

**Phase 9: Documentation & Polish**
- T9.1: Documentation site setup (Starlight/VitePress)
- T9.2: Write all getting-started guides
- T9.3: Write all reference docs
- T9.4: Write migration guides
- T9.5: Screenshot integration from Playwright
- T9.6: README and CONTRIBUTING.md
- T9.7: Polish: animations, loading states, error boundaries, empty states

**Phase 10: Release**
- T10.1: Release CI workflows (desktop, web, mobile)
- T10.2: Code signing setup
- T10.3: Auto-update mechanism (desktop)
- T10.4: First release

### 13.2 Task Execution Protocol

**For EVERY task, follow this exact sequence. Do not skip steps.**

#### Step 1: Spec & Research
```
Before writing any code for task T<X>.<Y>:
1. Read the task description in TASKS.md
2. If this task implements a user-facing feature:
   a. Write (or update) the feature spec in docs/specs/<feature>.md
   b. Research comparable features in Notion/Obsidian — document findings with URLs
   c. Write the Gherkin .feature file(s) in features/
   d. Commit: "docs: spec + feature file for T<X>.<Y>"
3. Identify all files that will be created or modified
4. Identify dependencies on other tasks (are they complete?)
5. Identify what additional tests will be written (unit, integration, e2e)
```

#### Step 2: Red (Write Failing Tests First)
```
1. For core logic: Write unit tests FIRST (TDD red phase)
   - Test the expected behavior of functions/classes that don't exist yet
   - Run tests — confirm they fail
2. For BDD features: Write step definitions that map Gherkin steps to test code
   - Run the feature file — confirm scenarios fail
3. Commit failing tests: "test: red phase for T<X>.<Y>"
```

#### Step 3: Green (Implement Until Tests Pass)
```
1. Write the minimum code to make all failing tests pass
2. Follow TypeScript strict mode — no `any` types, no `@ts-ignore`
3. Follow the abstraction boundaries (never call isomorphic-git outside GitBackend, never bypass StorageBackend, etc.)
4. Add JSDoc comments on all public interfaces and exported functions
5. Keep files under 300 lines. Split if larger.
6. Run tests frequently as you implement — stop when they're green
```

#### Step 4: Refactor
```
1. Clean up the implementation while keeping tests green
2. Extract shared logic, reduce duplication
3. Add edge-case unit tests discovered during implementation
4. Run full test suite: tests still green?
```

#### Step 5: Validate
```
1. Run linter: `bun run lint` — zero warnings
2. Run typecheck: `bun run typecheck` — zero errors
3. Run full test suite: `bun run test` — all green
4. Run BDD features: all Gherkin scenarios pass
5. If UI changed: visually inspect in browser, check responsive behavior
6. If E2E screenshots changed: review diffs, update baseline if correct
```

#### Step 6: Document & Review Spec
```
1. Update TASKS.md — mark task as complete with date
2. If the task introduces a new file format, schema, or configuration: update docs/reference/
3. If the task adds a user-visible feature:
   a. Update the feature spec status to "Implemented"
   b. Review the spec — does the implementation match? Update if it diverged.
   c. Add screenshots from E2E tests to the spec
   d. Update the relevant guide in docs/guides/
4. If the task changes the monorepo structure: update docs/contributing/architecture.md
```

#### Step 7: Commit & Move On
```
1. Commit to `main` with a descriptive message: "feat(core): implement database filter engine [T1.5]"
2. Reference the task ID in the commit message
3. If research informed the approach, add [researched] tag
4. Push to `main` immediately (critical for Claude Code Web sessions)
5. Move to the next task in sequence
6. DO NOT skip ahead to a later phase unless all tasks in the current phase are complete and tested
```

### 13.3 Quality Gates Between Phases

Before starting a new phase, verify:

- [ ] All tasks in the previous phase are marked complete in TASKS.md
- [ ] All unit tests pass (TDD — every function has tests)
- [ ] All BDD feature files pass (every user-facing feature has Gherkin scenarios)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Linter reports zero warnings
- [ ] TypeScript reports zero errors
- [ ] Code coverage for the phase's package is above 80%
- [ ] Feature specs for the completed phase are updated to "Verified" status
- [ ] Feature specs for the NEXT phase are drafted (at minimum "Draft" status)
- [ ] Screenshots from E2E tests are committed to `docs/screenshots/`
- [ ] Any new features have corresponding documentation in `docs/guides/`

### 13.4 Anti-Patterns to Avoid

1. **DO NOT** skip writing tests to "save time." Every task includes TDD (red-green-refactor).
2. **DO NOT** implement a user-facing feature without writing the Gherkin `.feature` file FIRST.
3. **DO NOT** implement a feature without a spec in `docs/specs/`. Spec comes before code.
4. **DO NOT** assume how a library works — research it, cite the source, verify.
5. **DO NOT** assume how Notion or Obsidian implements a feature — research it, document findings.
6. **DO NOT** hardcode GitHub-specific logic outside of `GitHubAuthProvider`. All Git operations go through `GitBackend` using isomorphic-git.
7. **DO NOT** use `localStorage` or `sessionStorage` in the shared UI code. Use `StorageBackend` for workspace data and platform-specific secure storage for credentials.
8. **DO NOT** write platform-specific code in `packages/ui/` or `packages/core/`. Platform specifics belong in `packages/desktop/`, `packages/web/`, or `packages/mobile/`.
9. **DO NOT** commit code that fails lint or typecheck.
10. **DO NOT** add dependencies without documenting why in the PR/commit message and verifying compatibility with Bun.
11. **DO NOT** create files larger than 300 lines without splitting into modules.
12. **DO NOT** ignore failing tests and move to the next task.
13. **DO NOT** write E2E tests without capturing screenshots at key states.
14. **DO NOT** add features not in the current phase's task list without updating TASKS.md first.
15. **DO NOT** cite "common knowledge" as justification for a design decision — provide a verifiable reference.
16. **DO NOT** skip updating the feature spec after implementation diverges from the original spec.

---

## 14. Appendices

### Appendix A: Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editor framework | TipTap (ProseMirror) | Best CRDT integration (y-prosemirror), extensible block system, Notion-like editing UX |
| CRDT library | Yjs | Most mature JS CRDT, native ProseMirror binding, works offline |
| State management | Zustand | Lightweight, TypeScript-first, no boilerplate |
| Git client | isomorphic-git | Pure JS, works in browser/Node/mobile, provider-agnostic |
| Styling | TailwindCSS | Utility-first, consistent design, great for component libraries |
| Monorepo tool | Nx | Dependency graph awareness, affected-only testing, Bun workspace support (`--packageManager bun`), task caching, custom generators. Ref: [Nx Bun support (v19.1+)](https://nx.dev/blog/nx-19-5-adds-stackblitz-new-features-and-more), [Nx workspaces blog](https://nx.dev/blog/new-nx-experience-for-typescript-monorepos) |
| Doc site | Starlight or VitePress | Markdown-based, great for technical docs, easy to maintain |

### Appendix B: External Service Dependencies

| Service | Required? | Purpose |
|---|---|---|
| GitHub | Yes (MVP) | OAuth, Git remote hosting |
| Signaling server | Optional | Real-time collaboration. Works without it (offline mode). |
| OpenStreetMap tile servers | Optional | Map view tiles. Free, no API key needed. |
| Unsplash API | Optional | Image search for covers/images. Requires free API key. |

### Appendix C: Keyboard Shortcuts (Implement All)

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + N` | New page |
| `Cmd/Ctrl + Shift + N` | New page in current section |
| `Cmd/Ctrl + P` | Quick page search |
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + U` | Underline |
| `Cmd/Ctrl + Shift + S` | Strikethrough |
| `Cmd/Ctrl + E` | Inline code |
| `Cmd/Ctrl + Shift + H` | Toggle highlight |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Enter` | Toggle to-do checkbox |
| `Tab` | Indent block |
| `Shift + Tab` | Outdent block |
| `/` | Slash command menu |
| `Esc` | Close menu / deselect |
| `Cmd/Ctrl + \\` | Toggle sidebar |
| `Cmd/Ctrl + Shift + L` | Toggle dark mode |

### Appendix D: Markdown Extension Encoding Reference

Complete reference for how Notion-equivalent blocks are encoded in Markdown with HTML comments:

```markdown
<!-- Standard Markdown (no special encoding needed) -->
# Heading 1
## Heading 2
### Heading 3
Regular paragraph text with **bold**, *italic*, `code`, ~~strikethrough~~.
- Bullet item
1. Numbered item
- [ ] To-do unchecked
- [x] To-do checked
> Blockquote
---
[Link text](url)
![Alt text](image-url)
```code-language
code block content
`` `

<!-- Cept Extensions (HTML comments) -->

<!-- cept:block {"type":"callout","icon":"💡","color":"blue"} -->
Callout content here. Can contain **rich** markdown.
<!-- /cept:block -->

<!-- cept:block {"type":"toggle","summary":"Toggle heading text"} -->
Content hidden by default, shown when expanded.
Can span multiple paragraphs.
<!-- /cept:block -->

<!-- cept:block {"type":"columns","widths":[50,50]} -->
<!-- cept:column -->
Left column content
<!-- /cept:column -->
<!-- cept:column -->
Right column content
<!-- /cept:column -->
<!-- /cept:block -->

<!-- cept:block {"type":"embed","url":"https://example.com","height":400} -->

<!-- cept:block {"type":"bookmark","url":"https://example.com","title":"Example","description":"A description","image":"thumb.png"} -->

<!-- cept:block {"type":"equation","expression":"E = mc^2"} -->

<!-- cept:block {"type":"mermaid"} -->
graph TD
    A --> B
<!-- /cept:block -->

<!-- cept:database {"ref":".cept/databases/tasks.yaml","view":"view-kanban"} -->

<!-- cept:toc {"maxDepth":3} -->

Inline: some text <!-- cept:mention {"type":"page","id":"abc-123"} -->@Project Roadmap<!-- /cept:mention --> more text.

<!-- cept:block {"type":"synced","sourceId":"block-uuid-here"} -->
Content that stays in sync with the source block.
<!-- /cept:block -->
```

### Appendix E: Comments System Schema

```yaml
# .cept/comments/<page-id>.yaml
threads:
  - id: "thread-001"
    block_id: "block-uuid"          # Which block this comment is on
    resolved: false
    comments:
      - id: "comment-001"
        author: "alice"
        content: "Should we reconsider this approach?"
        created: "2025-03-01T10:00:00Z"
        edited: null
      - id: "comment-002"
        author: "bob"
        content: "Good point, let's discuss in standup."
        created: "2025-03-01T10:15:00Z"
        edited: null
```

### Appendix F: Configuration Reference

```yaml
# .cept/config.yaml
workspace:
  name: "My Workspace"
  icon: "🏠"
  default_page: "pages/index.md"

git:
  auto_commit_interval_seconds: 30
  commit_message_format: "{action}: {page_title}"
  default_branch: "main"
  push_on_commit: true
  pull_interval_seconds: 60

sync:
  signaling_server: "wss://cept-signal.example.com"  # or null for offline-only
  enable_presence: true
  enable_realtime_sync: true

editor:
  default_font: "Inter"
  default_font_size: 16
  default_code_font: "JetBrains Mono"
  show_line_numbers_in_code: true
  spell_check: true

assets:
  max_file_size_mb: 10
  image_compression: true
  image_max_width: 2048

database:
  max_rows_per_shard: 1000
  default_view: "table"
```

---

## Final Notes for Claude Code

1. **SESSION 1 IS BOOTSTRAP ONLY.** Your first session creates the `.claude/` directory, `CLAUDE.md`, `TASKS.md`, all commands, all agents, and the repo skeleton. No feature code. Commit, push, and tell the user to start a new session.
2. **Every subsequent session starts with `/continue`.** Read `CLAUDE.md`, read `TASKS.md`, run validation, pick up where you left off.
3. **Start feature work with the monorepo skeleton** (Phase 0) and verify the CI pipeline works before writing any feature code.
4. **Read the full spec (`.claude/prompts/init.md`, also mirrored at `docs/SPECIFICATION.md`) whenever you need to reference requirements.** Do not deviate from the architecture without documenting why.
5. **Commit and push after every completed task.** In Claude Code Web, the container is ephemeral — unpushed work is lost.
6. **Test obsessively.** The testing requirements are not optional. Every task includes writing tests. Run `/validate` before every commit.
7. **Screenshots are documentation.** Every E2E test should capture meaningful screenshots that end up in the docs site.
8. **The file format is sacred.** Once you implement the Markdown + YAML + HTML comment format in Phase 1, do not change it without updating all parsers, serializers, tests, and documentation.
9. **Abstractions are boundaries.** Code in `packages/ui/` MUST NOT import from `isomorphic-git`, `electron`, `@capacitor/*`, or any platform-specific module. Only from `packages/core/` interfaces.
10. **When in doubt, match Notion's behavior.** If this prompt doesn't specify how a feature should work, look at how Notion does it and replicate that UX.
11. **Performance matters.** The app must feel snappy. Lazy-load heavy components. Virtualize long lists. Debounce expensive operations. Use Web Workers for Git operations and search indexing in the browser.
12. **Accessibility matters.** All interactive elements must be keyboard-navigable. Use semantic HTML. Support screen readers. Follow WCAG 2.1 AA.
13. **Use sub-agents.** When writing tests, invoke the test-writer agent. When writing docs, invoke the doc-writer agent. When reviewing a completed phase, invoke the reviewer agent. This keeps work focused and high-quality.
14. **WIP branches for interrupted sessions.** If a session is ending mid-task, commit work to a `wip/T<X>.<Y>` branch and push. The next session will detect and rebase it.
