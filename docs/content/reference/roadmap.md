# Product Roadmap

Cept development follows a phased approach, with each phase building on the previous one. Below is the current roadmap with links to specifications where available.

## Phase 1: Foundation (Current)

Core infrastructure and basic editing experience.

| Feature | Status | Spec |
|---------|--------|------|
| Monorepo setup (Bun, Nx, TypeScript) | Done | — |
| Browser storage backend (localStorage) | Done | [storage-backends](../../specs/storage-backends.md) |
| Block editor with TipTap | Done | — |
| 20+ block types (headings, lists, code, callout, toggle, columns, math, mermaid, etc.) | Done | — |
| Slash command menu | Done | — |
| Markdown shortcuts | Done | — |
| Page management (create, rename, delete, duplicate, move) | Done | — |
| Sidebar with page tree, favorites, recent, trash | Done | — |
| Command palette | Done | — |
| Full-text search | Done | [search](../../specs/search.md) |
| Settings modal (auto-save, spaces, data & cache, about) | Done | — |
| App menu | Done | — |
| Inline title editing | Done | — |
| Page header with context menu | Done | — |
| Dark mode support | Done | — |
| Mobile-responsive UI | Done | — |
| GitHub Pages deployment | Done | — |
| PWA service worker | Done | — |
| Auto-detected demo mode (settings-based) | Done | — |
| Persistent space metadata & renaming | Done | — |
| Built-in documentation space | Done | — |

## Phase 2: Storage & Persistence

Full storage backend implementation and data management.

| Feature | Status | Spec |
|---------|--------|------|
| IndexedDB backend (BrowserFsBackend with lightning-fs) | Planned | [storage-backends](../../specs/storage-backends.md) |
| Local folder backend (filesystem API) | Planned | [storage-backends](../../specs/storage-backends.md) |
| Git backend (isomorphic-git) | Planned | [storage-backends](../../specs/storage-backends.md) |
| Markdown parser/serializer (roundtrip-safe) | Planned | [markdown-parser](../../specs/markdown-parser.md) |
| Multi-space support | Planned | — |
| Space switching | Planned | — |
| Import from Notion (ZIP) | Planned | — |
| Import from Obsidian (vault directory) | Planned | — |
| Export to Markdown/HTML/PDF | Planned | — |

## Phase 3: Databases

Structured data with multiple views.

| Feature | Status | Spec |
|---------|--------|------|
| Database engine (CRUD, filter, sort, group) | Planned | [database-engine](../../specs/database-engine.md) |
| 18 property types | Planned | [database-engine](../../specs/database-engine.md) |
| Table view | Planned | — |
| Board/Kanban view | Planned | — |
| Calendar view | Planned | — |
| Gallery view | Planned | — |
| List view | Planned | — |
| Map view | Planned | — |
| Formulas | Planned | [database-engine](../../specs/database-engine.md) |
| Relations & rollups | Planned | [database-engine](../../specs/database-engine.md) |

## Phase 4: Knowledge Graph & Templates

Visualization and reusable content.

| Feature | Status | Spec |
|---------|--------|------|
| Knowledge graph (global + local view) | Planned | [knowledge-graph](../../specs/knowledge-graph.md) |
| Graph filters and color groups | Planned | [knowledge-graph](../../specs/knowledge-graph.md) |
| Template system (built-in + custom) | Planned | [template-system](../../specs/template-system.md) |
| Template gallery UI | Planned | — |
| Wiki-links (`[[page]]`) | Planned | — |
| Backlinks panel | Planned | — |

## Phase 5: Git & Collaboration

Version control and multi-user editing.

| Feature | Status | Spec |
|---------|--------|------|
| Git commit on save | Planned | [storage-backends](../../specs/storage-backends.md) |
| Push/pull to remote | Planned | [storage-backends](../../specs/storage-backends.md) |
| Branch operations | Planned | [storage-backends](../../specs/storage-backends.md) |
| Merge conflict resolution | Planned | — |
| Auth provider (GitHub OAuth, token) | Planned | — |
| Real-time collaboration (Yjs CRDT) | Planned | — |
| Signaling server | Planned | — |
| Presence indicators | Planned | — |

## Phase 6: Desktop & Mobile

Native platform experiences.

| Feature | Status | Spec |
|---------|--------|------|
| macOS app (Electrobun) | Planned | — |
| Windows app (Electron) | Planned | — |
| Linux app (Electron) | Planned | — |
| iOS app (Capacitor) | Planned | — |
| Android app (Capacitor) | Planned | — |
| Auto-updater | Planned | — |
| Deep linking | Planned | — |
| System tray integration | Planned | — |

## Phase 7: Polish & Ecosystem

Final polish and extensibility.

| Feature | Status | Spec |
|---------|--------|------|
| Drag-and-drop page reordering | Planned | — |
| Page cover images | Planned | — |
| Page icons (emoji + custom) | Planned | — |
| Undo/redo history | Planned | — |
| Keyboard shortcut customization | Planned | — |
| Plugin system | Planned | — |
| Theming (custom colors, fonts) | Planned | — |
| Documentation site (Starlight) | Planned | — |
| API documentation | Planned | — |

## Phase 8: Integration & Public Rendering

MCP server and embeddable rendering for external use.

| Feature | Status | Spec |
|---------|--------|------|
| MCP server for Cept spaces | Planned | — |
| Read/write pages, databases, and search via MCP tools | Planned | — |
| MCP resources for exposing page content and metadata | Planned | — |
| GitHub Pages renderer (pre-built JS bundle) | Planned | — |
| Read-only public page rendering (similar to public Notion pages) | Planned | — |
| Embeddable `<script>` tag for static site rendering | Planned | — |
| SEO-friendly server-rendered output | Planned | — |
| Custom domain support for published spaces | Planned | — |

### MCP Server

A comprehensive Model Context Protocol (MCP) server that exposes Cept spaces to AI assistants and automation tools. Capabilities include:

- **Tools:** Create, read, update, and delete pages and database records. Search across spaces. Manage properties and views.
- **Resources:** Expose page content, database schemas, and space metadata as MCP resources for context injection.
- **Prompts:** Pre-built prompts for common tasks like "summarize this page" or "create a meeting notes page."

### GitHub Pages Renderer

A pre-built JavaScript bundle that renders Cept spaces as read-only public pages on any GitHub Pages deployment — similar to how Notion offers public page sharing. Features include:

- Drop-in `<script>` tag that reads Cept markdown files from the repo and renders them with the full Cept UI
- Sidebar navigation, search, and all block types rendered in read-only mode
- Zero build step required — just add the script to your `index.html`
- Works with any Git-backed Cept space stored in a public repository

## Contributing

Cept is open source. Contributions are welcome! See the [GitHub repository](https://github.com/nsheaps/cept) for issues and pull requests.
