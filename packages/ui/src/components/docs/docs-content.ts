// Bundled documentation content from docs/content/ in the Cept repository.
// Source: https://github.com/nsheaps/cept/tree/<branch>/docs/content
// This is a read-only Git-backed space. Branch is determined at build time via HEAD_BRANCH.

import type { PageTreeNode } from '../sidebar/PageTreeItem.js';

export const DOCS_PAGES: PageTreeNode[] = [
  {
    id: 'docs-index',
    title: 'Cept Documentation',
    isExpanded: true,
    children: [
      {
        id: 'docs-getting-started',
        title: 'Getting Started',
        isExpanded: false,
        children: [
          { id: 'docs-introduction', title: 'Introduction', children: [] },
          { id: 'docs-quick-start', title: 'Quick Start', children: [] },
        ],
      },
      {
        id: 'docs-guides',
        title: 'Guides',
        isExpanded: false,
        children: [
          { id: 'docs-features', title: 'Features', children: [] },
          { id: 'docs-toggle-syntax', title: 'Toggle Syntax', children: [] },
          { id: 'docs-markdown-extensions', title: 'Markdown Extensions', children: [] },
          { id: 'docs-platform-support', title: 'Platform Support', children: [] },
        ],
      },
      {
        id: 'docs-comparison',
        title: 'Comparisons',
        isExpanded: false,
        children: [
          { id: 'docs-vs-notion', title: 'Cept vs Notion', children: [] },
          { id: 'docs-vs-obsidian', title: 'Cept vs Obsidian', children: [] },
        ],
      },
      {
        id: 'docs-migration',
        title: 'Migration',
        isExpanded: false,
        children: [
          { id: 'docs-from-notion', title: 'From Notion', children: [] },
          { id: 'docs-from-obsidian', title: 'From Obsidian', children: [] },
        ],
      },
      {
        id: 'docs-reference',
        title: 'Reference',
        isExpanded: false,
        children: [
          { id: 'docs-keyboard-shortcuts', title: 'Keyboard Shortcuts', children: [] },
          { id: 'docs-icons', title: 'Icons Reference', children: [] },
          { id: 'docs-design-style-guide', title: 'Design & Style Guide', children: [] },
          { id: 'docs-roadmap', title: 'Product Roadmap', children: [] },
        ],
      },
    ],
  },
];

/** Strip YAML front matter from markdown content */
function stripFrontMatter(md: string): string {
  return md.replace(/^---[\s\S]*?---\n*/m, '');
}

/**
 * Get the base URL for static assets (screenshots, etc.).
 * Vite replaces the literal `import.meta.env.BASE_URL` at build time.
 * We must use the exact literal — any indirection defeats replacement.
 */
function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.endsWith('/') ? base : base + '/';
}

/** Resolve {{base}} placeholders in a content string at read time */
export function resolveDocsContent(content: string): string {
  return content.replace(/\{\{base\}\}/g, getBaseUrl());
}

// --- Inline documentation content ---
// These are the markdown files from docs/content/

const MD_INDEX = `# Cept Documentation

> **You are viewing docs from this PR.** If images appear below, the fix is working!

Welcome to the Cept documentation. Cept is an open-source Notion alternative that runs entirely on the client with optional Git-based sync and collaboration.

![Cept landing page]({{base}}screenshots/features/landing-page.png)

## Getting Started

- **Introduction** — What is Cept and why use it
- **Quick Start** — Get up and running in under a minute

## Guides

- **Features** — Complete feature reference with all block types
- **Platform Support** — Supported platforms and browsers

## Comparisons

- **Cept vs Notion** — Feature comparison for Notion users
- **Cept vs Obsidian** — Feature comparison for Obsidian users

## Migration

- **From Notion** — Import your Notion workspace
- **From Obsidian** — Import your Obsidian vault

## Reference

- **Keyboard Shortcuts** — All keyboard shortcuts
- **Product Roadmap** — What's built and what's coming next

## Source

This documentation is loaded from the docs/ folder in the Cept repository on GitHub. It is a read-only Git-backed space.`;

const MD_INTRODUCTION = `# Introduction

Cept is a fully-featured Notion alternative that runs entirely on the client. It works offline-first, supports real-time collaboration, and uses Git as its sync and versioning layer.

![Cept editor]({{base}}screenshots/features/landing-page.png)

## Why Cept?

- **Privacy first** — Your data stays on your device or your own Git repository. No third-party servers store your notes.
- **Offline first** — Everything works without an internet connection. Changes sync when you're back online.
- **Git-native** — Every change is a Git commit. You get full version history, branching, and collaboration for free.
- **Cross-platform** — Web (PWA), desktop (macOS, Windows, Linux), and mobile (iOS, Android).
- **Open source** — MIT licensed. Fork it, modify it, self-host it.
- **No lock-in** — Your data is plain Markdown and YAML. Open it with any text editor.

## Key Features

- **Rich block editor** — 20+ block types including code, math, diagrams, callouts, toggles, columns, and more.
- **Databases** — 6 views (table, board, calendar, gallery, list, map) with 18 property types, formulas, relations, and rollups.
- **Knowledge graph** — Interactive force-directed graph showing page connections.
- **Full-text search** — Instant client-side search across all pages and databases.
- **Templates** — Built-in templates (meeting notes, project tracker, journal, wiki) plus custom templates.
- **Import/Export** — Import from Notion and Obsidian. Export to Markdown, HTML, or PDF.

## How It Works

Cept uses a StorageBackend abstraction that supports three modes:

1. **Browser** (IndexedDB) — Zero setup. Open the app and start writing. Each page is stored as an individual file in a virtual filesystem inside IndexedDB.
2. **Local folder** — Store your workspace as plain Markdown files on your computer (coming soon).
3. **Git repository** — Full versioning, sync, and collaboration via any Git host (coming soon).

The full editing and database experience works identically on any backend. Git adds collaboration, history, and sync — but it's never required.

## Try the Demo

When you visit Cept for the first time, you can click **Try the demo** on the landing page. This creates a pre-populated workspace with sample pages showing off all block types and features. The demo runs entirely in your browser — no data leaves your device. You can edit the demo pages freely, and reset them anytime from Settings.

## Architecture

Cept is built as a monorepo with clear separation of concerns:

- **@cept/core** — Business logic, storage backends, database engine, CRDT, parsers. No UI dependencies.
- **@cept/ui** — React components and hooks. No platform-specific dependencies.
- **@cept/web** — Vite SPA with PWA support for offline use.
- **@cept/desktop** — Desktop shells using Electrobun (macOS) and Electron (Windows/Linux).
- **@cept/mobile** — Mobile apps using Capacitor for iOS and Android.`;

const MD_QUICK_START = `# Quick Start

Get up and running with Cept in under a minute.

## Web (Fastest)

1. Visit the Cept web app at your hosted URL (or the GitHub Pages deployment)
2. Click **Start writing** to create a new workspace in your browser
3. Or click **Try the demo** to explore a pre-populated workspace with sample content

No account required. Everything is stored locally in your browser using IndexedDB.

## The Demo Space

The demo creates a workspace pre-loaded with sample pages that showcase all of Cept's features — headings, lists, callouts, code blocks, toggles, columns, math, diagrams, and more. You can:

- **Edit freely** — All changes happen in your browser and are never sent to a server
- **Delete or add pages** — The demo is a fully functional workspace
- **Reset anytime** — Go to Settings and click "Recreate Demo Space" to start fresh
- **Clear everything** — Use Settings > Data > "Clear all data" to wipe your browser storage entirely

## Creating Your First Page

1. Click the **+** button in the sidebar to create a new page
2. Click the page title to rename it
3. Type \`/\` in the editor to open the slash command menu
4. Choose a block type (heading, list, code, callout, etc.)
5. Keep typing — content auto-saves as you edit

## Organizing Pages

- **Nested pages** — Click the + on any page in the sidebar to create a sub-page
- **Favorites** — Right-click (or tap the ... menu) on a page and choose "Add to favorites"
- **Trash** — Deleted pages go to trash and can be restored
- **Drag and drop** — Reorder pages by dragging them in the sidebar (coming soon)

## Keyboard Shortcuts

- \`Cmd/Ctrl + K\` — Open command palette
- \`/\` — Slash command menu
- \`Cmd/Ctrl + B\` — Bold
- \`Cmd/Ctrl + I\` — Italic

## Connect to Git (Optional)

To enable version history and sync:

1. Open **Settings** from the app menu
2. Go to the **Spaces** tab
3. Create or connect a Git-backed space
4. Authenticate with GitHub (or enter any Git remote URL)
5. Your space will sync automatically`;

const MD_FEATURES = `# Features

Cept provides a comprehensive set of features for note-taking, knowledge management, and structured data.

![Editor overview]({{base}}screenshots/features/editor-overview.png)

## Block Editor

The editor is built on TipTap (ProseMirror) and supports 20+ block types. Type \`/\` anywhere to insert a block.

### Text Blocks

| Block | Slash Command | Markdown Shortcut |
|-------|---------------|-------------------|
| Paragraph | /text | Just start typing |
| Heading 1 | /heading1 | # |
| Heading 2 | /heading2 | ## |
| Heading 3 | /heading3 | ### |
| Blockquote | /quote | > |
| Code Block | /code | \`\`\` |
| Divider | /divider | --- |

### List Blocks

| Block | Slash Command | Markdown Shortcut |
|-------|---------------|-------------------|
| Bullet List | /bullet | - or * |
| Numbered List | /numbered | 1. |
| To-do List | /todo | [] |

### Rich Blocks

| Block | Slash Command | Description |
|-------|---------------|-------------|
| Callout | /callout | Highlighted note with icon and color |
| Toggle | /toggle | Collapsible content section |
| Columns | /columns | Side-by-side layout (2 or 3 columns) |
| Table | /table | Data table with resizable columns |
| Image | /image | Image from URL |
| Embed | /embed | Embedded video or web content |
| Bookmark | /bookmark | Rich link preview card |

![Toggle block]({{base}}screenshots/features/toggle-open.png)

![Code block]({{base}}screenshots/features/code-block.png)

![Blockquote]({{base}}screenshots/features/blockquote.png)

### Advanced Blocks

| Block | Slash Command | Description |
|-------|---------------|-------------|
| Math Equation | /math | LaTeX math rendering (block and inline) |
| Mermaid Diagram | /mermaid | Flowcharts, sequence diagrams, and more |
| Inline Database | /database | Embedded database view |

## Storage Backends

| Backend | Setup | Offline | History | Collaboration | Status |
|---------|-------|---------|---------|---------------|--------|
| Browser (localStorage) | Zero setup | Yes | No | No | Available |
| Local Folder | Choose a folder | Yes | No | No | Coming soon |
| Git Repository | Connect a remote | Yes | Full git log | Via branches | Coming soon |

## Databases (Coming Soon)

Create structured data with multiple view types:

- **Table view** — Spreadsheet-like grid with sortable columns
- **Board view** — Kanban-style cards grouped by property
- **Calendar view** — Events on a monthly/weekly calendar
- **Gallery view** — Visual cards with cover images
- **List view** — Compact list with key properties
- **Map view** — Geographic pins for location data

18 property types: Title, Text, Number, Select, Multi-select, Date, Person, Files, Checkbox, URL, Email, Phone, Formula, Relation, Rollup, Created time, Created by, Last edited time.

## Templates (Coming Soon)

Built-in templates: Meeting Notes, Project Tracker, Sprint Board, Journal, Wiki, Reading List, CRM.

Save any page as a template for reuse.

## Import & Export (Coming Soon)

- **Import from Notion** — Export as Markdown & CSV from Notion, import the ZIP into Cept
- **Import from Obsidian** — Point Cept at your vault directory or ZIP
- **Export to Markdown, HTML, or PDF**

## Editor Tools

### Slash Menu

Type \`/\` in the editor to open the slash menu and insert any block type.

![Slash menu]({{base}}screenshots/features/slash-menu.png)

### Inline Toolbar

Select text to reveal the inline formatting toolbar.

![Inline toolbar]({{base}}screenshots/features/inline-toolbar.png)

### Command Palette

Press \`Ctrl+K\` (or \`Cmd+K\` on Mac) to open the command palette for quick navigation.

![Command palette]({{base}}screenshots/features/command-palette.png)

### Drag Handle

Hover over any block to reveal the 6-dot drag handle for reordering.

![Drag handle]({{base}}screenshots/features/drag-handle.png)`;

const MD_PLATFORM_SUPPORT = `# Platform Support

Cept runs on every major platform with a consistent experience across all of them.

## Supported Platforms

| Platform | Technology | Status | Notes |
|----------|-----------|--------|-------|
| Web | Vite SPA + PWA | Available | Works in any modern browser |
| macOS | Electrobun | Coming soon | Native macOS app |
| Windows | Electron | Coming soon | Native Windows app |
| Linux | Electron | Coming soon | Native Linux app |
| iOS | Capacitor | Coming soon | Native iOS app |
| Android | Capacitor | Coming soon | Native Android app |

## Web Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome / Chromium | 90+ |
| Firefox | 90+ |
| Safari | 15+ |
| Edge | 90+ |

## PWA (Progressive Web App)

The web version includes a service worker for offline support:

- **Install as app** — Add to home screen on mobile, or install as desktop app from Chrome/Edge
- **Offline editing** — All features work without an internet connection
- **Auto-update** — New versions are cached automatically

## Architecture

Each platform shell wraps the same @cept/ui and @cept/core packages:

- **@cept/core** — Business logic, storage, databases, parsers
- **@cept/ui** — React components and hooks (platform-agnostic)
- **@cept/web** — Vite SPA + PWA service worker
- **@cept/desktop** — Electrobun (macOS) + Electron (Win/Linux) shells
- **@cept/mobile** — Capacitor iOS + Android shells

This means the editor, databases, and graph work identically everywhere.`;

const MD_VS_NOTION = `# Cept vs Notion

Cept aims for feature parity with Notion while giving you full ownership of your data.

## Quick Comparison

| Feature | Cept | Notion |
|---------|------|--------|
| Pricing | Free, open source | Free tier + paid plans |
| Data ownership | Your device / your Git repo | Notion's servers |
| Offline support | Full offline, sync when online | Limited offline mode |
| Privacy | No telemetry, no third-party servers | Cloud-hosted |
| Open source | MIT licensed | Proprietary |
| Block editor | 20+ block types | 50+ block types |
| Databases | 6 views, 18 property types | 6 views, 20+ property types |
| Version history | Full Git log (unlimited) | 30 days (free) / unlimited (paid) |
| Collaboration | Git branches + CRDT | Real-time, built-in |
| Knowledge graph | Built-in | Not available |
| Self-hosting | Yes (it's a static site) | No |
| File format | Markdown + YAML | Proprietary |

## Where Cept Wins

### Data Ownership
Your notes are plain Markdown files. You can read them with any text editor, version them with Git, and move them to any other tool. Zero lock-in.

### Privacy
Cept runs entirely on the client. No data leaves your device unless you sync with a Git remote. No telemetry, no analytics.

### Version History
With Git as the sync layer, you get unlimited version history for free. Every edit is a commit. You can branch, diff, merge, and revert.

### Knowledge Graph
Cept includes a built-in interactive knowledge graph. Notion doesn't have this feature.

### Offline
Cept is offline-first by design. Notion's offline mode is limited.

## Where Notion Wins

### Maturity
Notion has millions of users and years of production experience. Cept is new.

### Real-time Collaboration
Notion's collaboration is polished with comments, mentions, and permissions. Cept uses Git-based collaboration.

### Ecosystem
Notion has a large ecosystem of integrations and templates.

### Mobile Apps
Notion has mature iOS and Android apps. Cept's mobile apps are in development.`;

const MD_VS_OBSIDIAN = `# Cept vs Obsidian

Cept and Obsidian share a philosophy of local-first, Markdown-based note-taking.

## Quick Comparison

| Feature | Cept | Obsidian |
|---------|------|----------|
| Pricing | Free, open source (MIT) | Free personal, paid sync |
| Open source | Yes (MIT) | No (source-available) |
| Data format | Markdown + YAML | Markdown |
| Storage | Browser, Local, or Git | Local folder |
| Web app | Yes (PWA) | No native web app |
| Block editor | WYSIWYG blocks (Notion-style) | Live preview Markdown |
| Databases | Built-in (6 views, 18 types) | Via Dataview plugin |
| Knowledge graph | Built-in | Built-in |
| Collaboration | Git-based | Obsidian Sync (paid) |
| Plugins | Not yet | 1000+ community plugins |
| Mobile | Coming soon | Available |
| Self-hosting sync | Yes (any Git remote) | No |

## Where Cept Wins

### Web Access
Cept runs in any browser as a PWA. No installation required. Obsidian requires a desktop app.

### Databases
Cept has built-in structured databases with 6 view types. Obsidian relies on the Dataview plugin.

### Block Editor
Cept's WYSIWYG block editor works like Notion — click, type, drag blocks. Lower learning curve.

### Zero Setup
Cept runs in the browser with no installation. Just open the URL and start writing.

### Git-Native Sync
Cept uses standard Git for sync. Any Git host works. Obsidian's sync is proprietary.

## Where Obsidian Wins

### Plugin Ecosystem
Obsidian has 1000+ community plugins. Cept doesn't have a plugin system yet.

### Maturity
Obsidian is battle-tested with a large community.

### Desktop Performance
Obsidian is optimized for desktop. Cept's desktop apps are in development.

### Canvas
Obsidian Canvas provides an infinite whiteboard. Cept doesn't have this yet.`;

const MD_FROM_NOTION = `# Migrate from Notion

Import your entire Notion workspace into Cept.

## Export from Notion

1. Open Notion and go to **Settings & members**
2. Scroll down to **Export all workspace content**
3. Choose **Markdown & CSV** format
4. Click **Export** and download the ZIP file

## Import into Cept (Coming Soon)

1. Open Cept and go to **Settings > Import**
2. Select **Import from Notion**
3. Choose the downloaded ZIP file
4. Configure import options:
   - Convert links — Transform Notion-style links to Cept wiki-links
   - Import databases — Include CSV database files
   - Import images — Include embedded images and attachments
5. Click **Import**

## What Gets Imported

| Notion Feature | Cept Equivalent |
|---------------|-----------------|
| Pages | Pages with full hierarchy |
| Sub-pages | Nested pages |
| Databases (CSV) | Database pages |
| Wiki-links | wiki-links |
| Headings, lists, quotes | Preserved as-is |
| Images & attachments | Imported as assets |
| Code blocks | Preserved with language |
| Tables | Markdown tables |
| Callouts | Cept callout blocks |
| Toggle blocks | Cept toggle blocks |

## What's Not Imported

- Notion-specific blocks (synced blocks, linked databases)
- Page permissions and sharing settings
- Comments and discussions
- Page analytics`;

const MD_FROM_OBSIDIAN = `# Migrate from Obsidian

Import your Obsidian vault into Cept.

## Import Process (Coming Soon)

1. Open Cept and go to **Settings > Import**
2. Select **Import from Obsidian**
3. Choose your vault directory (or a ZIP of your vault)
4. Configure import options:
   - Convert links — Transform wiki-links to Cept format
   - Import attachments — Include images and other files
   - Ignore paths — Folders to skip (.obsidian, .trash by default)
5. Click **Import**

## What Gets Imported

| Obsidian Feature | Cept Equivalent |
|-----------------|-----------------|
| Markdown files | Pages |
| Wiki-links | Wiki-links (converted) |
| Tags #tag | Preserved in content |
| Front matter YAML | Preserved as front matter |
| Headings, lists | Preserved as-is |
| Images & attachments | Imported as assets |
| Folder structure | Page hierarchy |
| Code blocks | Preserved with language |
| Callouts | Cept callout blocks |
| Mermaid diagrams | Cept mermaid blocks |
| Math blocks | Cept math blocks |

## What's Not Imported

- Obsidian plugins and their data
- .obsidian/ configuration
- Canvas files
- Community plugin metadata
- Dataview queries (converted to plain text)`;

const MD_KEYBOARD_SHORTCUTS = `# Keyboard Shortcuts

## General

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + K | Open command palette |
| Cmd/Ctrl + N | New page |
| Cmd/Ctrl + S | Save (manual sync) |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + F | Search in page |
| Cmd/Ctrl + Shift + F | Global search |

## Editor

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + B | Bold |
| Cmd/Ctrl + I | Italic |
| Cmd/Ctrl + U | Underline |
| Cmd/Ctrl + Shift + S | Strikethrough |
| Cmd/Ctrl + E | Inline code |
| Cmd/Ctrl + Shift + H | Highlight |
| / | Slash command menu |
| --- | Horizontal divider |
| > + Space | Blockquote |
| # + Space | Heading 1 |
| ## + Space | Heading 2 |
| ### + Space | Heading 3 |
| - or * + Space | Bullet list |
| 1. + Space | Numbered list |
| [] + Space | To-do item |

## Navigation

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + K | Command palette / quick page switch |
| Cmd/Ctrl + \\\\ | Toggle sidebar |`;

const MD_ROADMAP = `# Product Roadmap

Cept development follows a phased approach. Below is the current roadmap.

## Phase 1: Foundation (Current)

Core infrastructure and basic editing experience.

| Feature | Status |
|---------|--------|
| Monorepo setup (Bun, Nx, TypeScript) | Done |
| Browser storage backend (localStorage) | Done |
| Block editor with TipTap (20+ block types) | Done |
| Slash command menu | Done |
| Markdown shortcuts | Done |
| Page management (create, rename, delete, duplicate) | Done |
| Sidebar with page tree, favorites, recent, trash | Done |
| Command palette | Done |
| Full-text search | Done |
| Settings modal | Done |
| Inline title editing | Done |
| Dark mode support | Done |
| Mobile-responsive UI | Done |
| GitHub Pages deployment | Done |
| PWA service worker | Done |
| Demo mode | Done |
| Built-in documentation space | Done |

## Phase 2: Storage & Persistence

| Feature | Status |
|---------|--------|
| IndexedDB backend (BrowserFsBackend) | Done |
| Individual page file storage | Done |
| Markdown parser/serializer | Done |
| GitBackend injectable filesystem | Done |
| Local folder backend | Planned |
| Git backend wiring | Planned |
| Multi-space support | Planned |
| Import from Notion | Planned |
| Import from Obsidian | Planned |
| Export to Markdown/HTML/PDF | Planned |

## Phase 3: Databases

| Feature | Status |
|---------|--------|
| Database engine (CRUD, filter, sort, group) | Planned |
| 18 property types | Planned |
| Table, Board, Calendar, Gallery, List, Map views | Planned |
| Formulas, Relations, Rollups | Planned |

## Phase 4: Knowledge Graph & Templates

| Feature | Status |
|---------|--------|
| Knowledge graph (global + local view) | Planned |
| Graph filters and color groups | Planned |
| Template system (built-in + custom) | Planned |
| Wiki-links and backlinks | Planned |

## Phase 5: Git & Collaboration

| Feature | Status |
|---------|--------|
| Git commit on save | Planned |
| Push/pull to remote | Planned |
| Branch operations | Planned |
| Auth provider (GitHub OAuth) | Planned |
| Real-time collaboration (Yjs CRDT) | Planned |

## Phase 6: Desktop & Mobile

| Feature | Status |
|---------|--------|
| macOS app (Electrobun) | Planned |
| Windows/Linux app (Electron) | Planned |
| iOS/Android app (Capacitor) | Planned |

## Phase 7: Polish & Ecosystem

| Feature | Status |
|---------|--------|
| Drag-and-drop page reordering | Planned |
| Undo/redo history | Planned |
| Plugin system | Planned |
| Theming (custom colors, fonts) | Planned |
| Custom emoji support (upload custom icons for pages) | Planned |
| View raw file (see underlying Markdown/HTML in page options) | Planned |

## Phase 8: Integration & Public Rendering

| Feature | Status |
|---------|--------|
| MCP server for Cept spaces | Planned |
| Read/write pages, databases, and search via MCP tools | Planned |
| GitHub Pages renderer (pre-built JS bundle) | Planned |
| Read-only public page rendering (like public Notion pages) | Planned |
| Embeddable script tag for static site rendering | Planned |

## Contributing

Cept is open source. Contributions are welcome! See the GitHub repository at github.com/nsheaps/cept.`;

const MD_TOGGLE_SYNTAX = `# Toggle Syntax

Toggles are collapsible content blocks — click the arrow to expand or collapse.

## Editor Shortcut

Type \`> \` (greater-than followed by space) at the start of a line to create a toggle, just like in Notion. This replaces the default blockquote shortcut. Use \`/quote\` from the slash command menu to insert a blockquote instead.

## Markdown Representation

A toggle starts with \`> \` followed by the summary text. Content inside the toggle is indented by 2 spaces:

\`\`\`markdown
> Summary text
  Content inside the toggle

  More content (single blank line continues the toggle)


  Two blank lines end the toggle
\`\`\`

## Rules

| Rule | Description |
| --- | --- |
| **Start** | A line beginning with \`> \` followed by text |
| **Content** | Subsequent lines indented by 2 spaces |
| **Single blank** | Continues the toggle (does not end it) |
| **Two blanks** | Ends the toggle |
| **Blockquote** | If the NEXT line also starts with \`> \`, it is a standard blockquote |
| **Nesting** | Toggles inside toggle content are detected recursively |

## Examples

### Basic toggle

\`\`\`markdown
> Click to expand
  Hidden content here
\`\`\`

### Empty toggle (no content)

\`\`\`markdown
> Click to expand
\`\`\`

### Toggle with a list

\`\`\`markdown
> Toggle with items
  - First item
  - Second item
  - Third item
\`\`\`

### Nested toggle

\`\`\`markdown
> Outer toggle
  Some content

  > Inner toggle
    Nested content
\`\`\`

### Heading toggle

\`\`\`markdown
> # Section Title
  Content inside a heading toggle
\`\`\`

### Toggle in a list

\`\`\`markdown
- list item
- > toggle in list
  content inside toggle
\`\`\`

### Standard blockquote (not a toggle)

\`\`\`markdown
> Line one
> Line two (same blockquote)
\`\`\`

When the very next line also starts with \`> \`, it remains a standard blockquote.`;

const MD_MARKDOWN_EXTENSIONS = `# Markdown Extensions

Cept uses standard Markdown as its primary content format, with a few extensions for rich blocks that go beyond standard Markdown capabilities.

## Standard Markdown

These blocks use standard Markdown syntax:

| Block | Syntax |
| --- | --- |
| Headings | \`# \`, \`## \`, \`### \` |
| Bold | \`**text**\` |
| Italic | \`*text*\` |
| Strikethrough | \`~~text~~\` |
| Inline code | Backtick-wrapped text |
| Code block | Triple backtick fenced block |
| Bullet list | \`- item\` or \`* item\` |
| Numbered list | \`1. item\` |
| Task list | \`- [ ] item\` or \`- [x] item\` |
| Blockquote | \`> text\` on every line |
| Horizontal rule | \`---\` |
| Link | \`[text](url)\` |
| Image | \`![alt](url)\` |
| Table | Pipe-delimited table syntax |

## Cept Extensions

These blocks use HTML comments or inline HTML for Markdown representation:

### Toggles

Toggles use the \`> \` prefix with indented content. See the **Toggle Syntax** guide for full details.

### Callouts

Callouts use HTML div tags with \`data-type="callout"\`, \`data-icon\`, and \`data-color\` attributes.

### Mermaid Diagrams

Mermaid diagrams use fenced code blocks with the \`mermaid\` language tag.

### Math Equations

Math uses LaTeX syntax: \`$$E = mc^2$$\` for block math and \`$a^2 + b^2 = c^2$\` for inline math.

## Images

Use standard Markdown image syntax:

\`\`\`markdown
![Alt text describing the image](url)
\`\`\`

- Alt text is required for all images
- Images render at their natural size, centered, capped at the content width
- Cept does not stretch images to fill the page — small images stay small
- Use GitHub Flavored Markdown (GFM) conventions when standard Markdown is not sufficient

## Design Principles

1. **Standard Markdown first** — Use standard Markdown syntax whenever possible. This is the default for all content that has a natural Markdown representation.
2. **GFM fallback** — When standard Markdown is not sufficient (e.g., tables, task lists, strikethrough), fall back to GitHub Flavored Markdown.
3. **HTML as last resort** — Rich blocks that extend Markdown use HTML with \`data-type\` attributes. Avoid raw HTML when Markdown or GFM can express the same thing.
4. **Interoperability** — Files can be opened in any Markdown editor; extended blocks render as HTML.
5. **No proprietary format** — Everything is plain text, never binary or opaque.`;

const MD_ICONS = `# Icons Reference

Cept uses a combination of Unicode emoji, inline SVG icons, and CSS-generated graphics throughout the interface.

## Page Icons

Pages use Unicode emoji as their icons. Click the page icon in the header or sidebar to change it.

| Default | Usage |
| --- | --- |
| \uD83D\uDCC4 | Default page icon |
| \uD83D\uDC4B | Welcome page |
| \uD83D\uDE80 | Getting started |
| \u2728 | Features |
| \uD83D\uDCDD | Notes |

## Editor Icons

### Slash Command Menu

Each block type in the slash command menu has an emoji icon:

| Icon | Block Type |
| --- | --- |
| \uD83D\uDCDD | Text / Paragraph |
| \uD83D\uDCCC | Heading 1 |
| \uD83D\uDCCE | Heading 2 |
| \uD83D\uDD16 | Heading 3 |
| \uD83D\uDCCB | Bullet List |
| \uD83D\uDD22 | Numbered List |
| \u2611\uFE0F | To-do List |
| \uD83D\uDCA1 | Callout |
| \uD83D\uDD3D | Toggle |
| \uD83D\uDCCA | Table |
| \uD83D\uDCF7 | Image |
| \uD83C\uDFAC | Embed |
| \uD83D\uDD17 | Bookmark |
| \u2797 | Math Equation |
| \uD83D\uDCD0 | Mermaid Diagram |
| \u25A4 | Columns |
| \u2014 | Divider |
| \uD83D\uDCAC | Blockquote |
| \uD83E\uDDF1 | Code Block |

### Inline Toolbar

The inline toolbar uses text-based button labels:

| Button | Action |
| --- | --- |
| **B** | Bold |
| *I* | Italic |
| U | Underline |
| ~~S~~ | Strikethrough |
| \`<>\` | Inline Code |
| \uD83D\uDD8C | Highlight |
| \uD83D\uDD17 | Link |

### Drag Handle

The drag handle uses a 2x3 dot grid (6 dots) generated via CSS \`radial-gradient\`. It appears to the left of blocks when you hover near them. Grab and drag to reorder blocks.

### Settings & UI

Settings and UI elements use inline SVG icons for common actions:

| Icon | Usage |
| --- | --- |
| \u2699\uFE0F (gear SVG) | Settings button |
| \uD83D\uDDD1 (trash SVG) | Delete / Clear data |
| \u21A9 (refresh SVG) | Recreate demo |
| \u2715 (close SVG) | Close modal |
| + (plus) | Add page / New item |
| \u22EF (ellipsis) | Page menu / More actions |`;

const MD_DESIGN_STYLE_GUIDE = `# Design & Style Guide

This style guide documents Cept's visual design system — colors, typography, spacing, iconography, and interaction patterns. It serves as the single source of truth for contributors building UI, and ensures a consistent, accessible experience across all platforms and input modes.

---

## Design Philosophy

Cept's design is **content-first**. The interface stays out of the way until you need it. Every visual decision follows these principles:

1. **Minimal chrome** — Reduce visual clutter so content takes center stage
2. **Progressive disclosure** — Show controls on hover/focus, not by default
3. **Platform-native feel** — Respect OS conventions for scrolling, selection, and focus
4. **Accessibility by default** — WCAG 2.1 AA compliance is the floor, not a stretch goal
5. **Responsive without compromise** — Every feature works on every screen size and input method

---

## Color System

### Brand Colors

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Primary** | \`#3b82f6\` | \`#60a5fa\` | Buttons, links, focus rings, active states |
| **Primary Hover** | \`#2563eb\` | \`#93bbfd\` | Hover states on primary elements |
| **Primary Active** | \`#1d4ed8\` | \`#a5b4fc\` | Pressed/active states |
| **Accent** | \`#6366f1\` | \`#818cf8\` | Column resize handles, selection highlights, active indicators |
| **Accent Deep** | \`#4338ca\` / \`#312e81\` | \`#312e81\` | Active button backgrounds |

### Neutral Palette

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Text Primary** | \`#111827\` | \`#e5e5e5\` | Headings, body text |
| **Text Secondary** | \`#6b7280\` | \`#a1a1aa\` | Captions, metadata, placeholder |
| **Text Tertiary** | \`#9ca3af\` | \`#71717a\` | Disabled text, subtle labels |
| **Border** | \`#e5e7eb\` | \`#404040\` | Dividers, table borders, input outlines |
| **Border Subtle** | \`#f3f4f6\` | \`#333333\` | Hairline separators |
| **Surface** | \`#ffffff\` | \`#262626\` | Cards, modals, panels |
| **Surface Raised** | \`#f9fafb\` | \`#1e1e1e\` | Table headers, code blocks, inset areas |
| **Background** | \`#fbfbfa\` | \`#1a1a1a\` | Page background |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Info** | \`rgba(219, 234, 254, 0.5)\` | \`rgba(59, 130, 246, 0.15)\` | Blue callouts, info banners |
| **Success** | \`rgba(220, 252, 231, 0.5)\` | \`rgba(34, 197, 94, 0.15)\` | Green callouts, confirmations |
| **Warning** | \`rgba(254, 249, 195, 0.5)\` | \`rgba(234, 179, 8, 0.15)\` | Yellow callouts, caution states |
| **Danger** | \`rgba(254, 226, 226, 0.5)\` | \`rgba(239, 68, 68, 0.15)\` | Red callouts, destructive actions |
| **Purple** | \`rgba(243, 232, 255, 0.5)\` | \`rgba(168, 85, 247, 0.15)\` | Purple callouts |
| **Neutral** | \`rgba(235, 236, 233, 0.3)\` | \`rgba(255, 255, 255, 0.05)\` | Default callout background |

### Syntax Highlighting

| Token | Value | Usage |
|---|---|---|
| Comment | \`#a0aec0\` | Code comments |
| Keyword | \`#805ad5\` | Language keywords |
| String | \`#38a169\` | String literals |
| Number | \`#dd6b20\` | Numeric literals |
| Type | \`#d69e2e\` | Type names, built-ins |
| Function | \`#3182ce\` | Function/method names |
| Error | \`#e53e3e\` | Errors, deletions |

### Inline Element Colors

| Element | Light Mode | Dark Mode |
|---|---|---|
| Page mentions | \`#2383e2\` | \`#60a5fa\` |
| Date mentions | \`#e16b20\` | \`#f59e0b\` |
| Inline code bg | \`rgba(135, 131, 120, 0.15)\` | \`rgba(255, 255, 255, 0.1)\` |
| Link text | \`#2563eb\` | \`#60a5fa\` |
| Link underline | \`rgba(37, 99, 235, 0.4)\` | \`rgba(96, 165, 250, 0.4)\` |

### Color Accessibility Requirements

- All text must meet **WCAG 2.1 AA** contrast ratios: 4.5:1 for body text, 3:1 for large text (18px+ or 14px bold)
- Interactive elements must have a **3:1** contrast ratio against their background
- Never rely on color alone to convey meaning — always pair with icons, text, or patterns
- Selection and highlight colors use alpha transparency to remain legible on any background
- Focus indicators use a visible \`2px\` outline with primary color, not just color change

---

## Typography

### Font Stacks

| Role | Stack | Rationale |
|---|---|---|
| **Body / UI** | System font stack (Tailwind default) | Fast load, native feel on every OS |
| **Monospace** | \`'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo', monospace\` | Code blocks, inline code, formulas |

Cept uses the operating system's native font rather than loading a web font. This ensures zero font-loading latency, consistent rendering with the host OS, and smaller bundle size.

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| **Page Title** | \`2rem\` (32px) | 700 | 1.2 | Top-level page heading |
| **H1** | \`2.25rem\` (36px) | 700 | 1.2 | Section headings in content |
| **H2** | \`1.75rem\` (28px) | 600 | 1.3 | Sub-section headings |
| **H3** | \`1.375rem\` (22px) | 600 | 1.4 | Tertiary headings |
| **Body** | \`1rem\` (16px) | 400 | 1.65 | Paragraph text |
| **UI Label** | \`0.8125rem\` (13px) | 500 | 1.4 | Sidebar items, button labels |
| **Caption** | \`0.75rem\` (12px) | 400 | 1.4 | Timestamps, metadata |
| **Micro** | \`0.6875rem\` (11px) | 400 | 1.3 | Badges, counters |

### Typography Accessibility

- Minimum body text size is **16px** — never go smaller for paragraph content
- Line height for body text is **1.65** for comfortable reading
- Heading hierarchy must be sequential (H1 > H2 > H3) — never skip levels
- Long-form content has a maximum width of **900px** for optimal readability (~65-75 characters per line)
- Text is never disabled by reducing opacity below **0.5** — use the tertiary text color instead

---

## Spacing & Layout

### Base Grid

Cept uses a **4px base grid**. All spacing values are multiples of 4px to maintain vertical rhythm and alignment.

### Key Dimensions

| Element | Value | Notes |
|---|---|---|
| Sidebar width | \`260px\` | Collapsible on mobile |
| Editor max-width | \`900px\` | Centered with auto margins |
| Content gap | \`0.75em\` (12px) | Space between blocks |
| Sidebar padding | \`0.5rem\` (8px) | Internal padding |
| Modal width (small) | \`560px\` | Command palette |
| Modal width (medium) | \`600px\` | Search panel |
| Modal width (large) | \`640px\` | Settings dialog |

### Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| **> 768px** (Desktop) | Full sidebar visible, multi-column layouts available |
| **<= 767px** (Tablet / Mobile) | Sidebar becomes a fixed overlay with backdrop, single-column layouts |
| **<= 480px** (Small Mobile) | Reduced padding, compact controls, full-bleed content |

### Responsive Design Rules

1. **Sidebar**: Collapses to an overlay drawer on screens <= 767px. Dismiss on backdrop tap or navigation.
2. **Modals**: Scale to \`95%\` width on mobile with appropriate max-width constraints and \`max-height: 85dvh\`.
3. **Editor**: Stretches full-width on mobile (no max-width constraint). Padding reduces to maintain reading width.
4. **Tables**: Horizontally scrollable on narrow screens. Never break table layout.
5. **Touch targets**: All interactive elements are at minimum **44x44px** on touch interfaces (per WCAG 2.5.8).

---

## Shadows & Elevation

| Level | Value | Usage |
|---|---|---|
| **Subtle** | \`0 1px 3px rgba(0, 0, 0, 0.06)\` | Cards, sidebar items on hover |
| **Medium** | \`0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)\` | Dropdown menus, tooltips |
| **Heavy** | \`0 8px 32px rgba(0, 0, 0, 0.2)\` | Modals, dialogs |
| **Overlay** | \`0 16px 48px rgba(0, 0, 0, 0.2)\` | Full-screen overlays, image lightbox |
| **Sidebar (mobile)** | \`4px 0 16px rgba(0, 0, 0, 0.1)\` | Sidebar overlay on mobile |

In dark mode, shadow intensity increases slightly since dark backgrounds absorb more light. Shadows use darker opacity values to remain visible.

### Border Radius

| Size | Value | Usage |
|---|---|---|
| **Small** | \`3px\` – \`4px\` | Buttons, inputs, tags |
| **Medium** | \`6px\` – \`8px\` | Modals, menus, cards |
| **Large** | \`10px\` | Settings dialog, feature panels |

---

## Iconography

- **Icon set**: Lucide React icons (consistent, open-source, tree-shakeable)
- **Default size**: \`16px\` for inline/UI icons, \`20px\` for standalone buttons, \`24px\` for empty states
- **Stroke width**: \`1.5px\` (Lucide default — visually balanced with text)
- **Color**: Inherits from \`currentColor\` so icons match surrounding text automatically
- **Page icons**: Emoji characters rendered natively — no icon font needed. Supports custom emoji as a future roadmap item.

### Icon Accessibility

- Decorative icons (next to a text label) use \`aria-hidden="true"\`
- Standalone icon buttons require \`aria-label\` describing the action
- Never use icons as the sole indicator of state — pair with text or a tooltip

---

## Interaction Patterns

### Light Mode & Dark Mode

Cept follows the operating system preference via \`prefers-color-scheme\`. There is no manual toggle in the current release.

**Design implications:**
- Every color must be defined for both light and dark modes — never hard-code a single value
- Test all new UI in both modes before committing
- Use semantic color tokens (e.g., "text-primary", "surface") rather than raw hex values in components
- Dark mode is not an inversion — it is a distinct palette tuned for legibility on dark backgrounds

### Motion & Animation

| Pattern | Duration | Easing | Usage |
|---|---|---|---|
| Hover transitions | \`0.1s\` – \`0.15s\` | \`ease\` | Background, color changes |
| Fade in/out | \`0.15s\` | \`ease\` | Drag handles, overlays |
| Save confirmation | \`1.5s\` | custom | Fade-in then fade-out toast |
| Loading spinner | \`1s\` | \`linear infinite\` | Progress indicators |

**Motion accessibility:**
- Respect \`prefers-reduced-motion\` — disable all non-essential animation when this media query matches
- Essential animations (loading spinners) should still run but may simplify (e.g., opacity pulse instead of rotation)
- Never use animation to convey information that is not also available statically

### Focus Management

- All interactive elements must be reachable via **Tab** key
- Focus order follows visual reading order (left-to-right, top-to-bottom)
- Focus indicators use a **2px solid** outline in the primary color with a **2px offset** for visibility
- Modals and dialogs trap focus — Tab cycles within the modal until dismissed
- On modal close, focus returns to the element that triggered it
- Skip-to-content link is available for keyboard users

---

## Platform-Specific Considerations

### Desktop (Keyboard & Mouse)

- **Hover states**: All interactive elements show a subtle background change on hover
- **Right-click context menus**: Available on pages, blocks, and sidebar items
- **Keyboard shortcuts**: Extensive shortcut coverage (see [Keyboard Shortcuts](keyboard-shortcuts.md))
- **Drag-and-drop**: Blocks, pages, and database rows support mouse-based drag-and-drop
- **Multi-select**: Shift+click for range selection, Cmd/Ctrl+click for individual selection
- **Resize handles**: Column widths, sidebar width, and table columns are mouse-resizable

### Tablet (Touch + Optional Keyboard)

- **Touch targets**: Minimum 44x44px for all tappable elements
- **Swipe gestures**: Swipe right to reveal sidebar, swipe left to dismiss
- **Long-press**: Triggers context menu (equivalent to right-click)
- **On-screen keyboard**: Editor adjusts viewport to keep cursor visible above the keyboard
- **Split-view**: Supports iPad Split View and Android multi-window

### Mobile (Touch-First)

- **Simplified toolbar**: Inline formatting toolbar becomes a bottom sheet
- **Sidebar**: Full-screen overlay with large touch targets
- **Block actions**: Tap-and-hold to reorder; action menu via explicit button (no hover)
- **Navigation**: Bottom navigation bar for primary sections (on very small screens)
- **Safe areas**: Respects \`env(safe-area-inset-*)\` for notch/rounded-corner devices

### Input Mode Adaptations

| Feature | Mouse/Keyboard | Touch |
|---|---|---|
| Block hover menu | Visible on hover | Hidden; use tap-and-hold or explicit button |
| Drag handle | Visible on block hover | Visible on block tap/focus |
| Slash command | Type \`/\` in editor | Type \`/\` or tap "+" button |
| Context menu | Right-click | Long-press |
| Text selection | Click-and-drag | Native OS selection handles |
| Resize columns | Drag border | Not available (auto-fit) |
| Tooltips | Hover delay | Not shown (info in labels) |

---

## Power User vs. Guided Experience

Cept serves both power users who prefer keyboard-driven workflows and users who prefer visual, point-and-click interaction. The design system accounts for both.

### Power User Features

- **Command palette** (\`Cmd+K\` / \`Ctrl+K\`): Search and execute any action without touching the mouse
- **Slash commands**: Type \`/\` to insert any block type by name
- **Keyboard shortcuts**: Every common action has a shortcut (see [Keyboard Shortcuts](keyboard-shortcuts.md))
- **Markdown shortcuts**: Type Markdown syntax directly in the editor (e.g., \`##\` for H2, \`- [ ]\` for checkbox)
- **Quick search** (\`Cmd+P\` / \`Ctrl+P\`): Jump to any page by name
- **Breadcrumb navigation**: Click any breadcrumb segment to navigate or see siblings
- **Vim-style future**: Roadmap includes optional keyboard-only navigation mode

### Guided Experience Features

- **Slash command menu**: Visual menu with icons and descriptions for every block type
- **Inline formatting toolbar**: Appears on text selection with labeled buttons
- **Block action menu**: Three-dot menu with named actions (duplicate, delete, move, etc.)
- **Drag handles**: Visible grip icon on hover/focus for visual reordering
- **Onboarding**: Demo mode pre-populates sample content to teach by example
- **Empty states**: Helpful messages with action buttons when a page or view is empty
- **Tooltips**: Keyboard shortcut hints shown alongside button tooltips

### Design Rule

> Every action must be discoverable through the GUI. Keyboard shortcuts are accelerators, never the only path. Conversely, power users must never be forced to use the mouse for common operations.

---

## Accessibility Checklist (For Contributors)

Before submitting UI changes, verify:

- [ ] **Color contrast** meets WCAG 2.1 AA (4.5:1 body text, 3:1 large text and UI elements)
- [ ] **Keyboard navigation** works for all new interactive elements (Tab, Enter, Escape, Arrow keys)
- [ ] **Focus indicator** is visible on all focusable elements
- [ ] **ARIA attributes** are correct: \`aria-label\` on icon buttons, \`role\` on custom widgets, \`aria-expanded\` on toggles
- [ ] **Screen reader** announces content and state changes correctly (use \`role="status"\` for live updates)
- [ ] **Dark mode** renders correctly with proper contrast
- [ ] **Reduced motion** is respected (\`prefers-reduced-motion\` disables non-essential animation)
- [ ] **Touch targets** are >= 44x44px on touch interfaces
- [ ] **Zoom**: Layout does not break at 200% browser zoom
- [ ] **Semantic HTML**: Use \`<button>\`, \`<nav>\`, \`<main>\`, \`<section>\` over generic \`<div>\` with roles
- [ ] **Screen reader only text**: Use \`.cept-sr-only\` class for content needed by assistive tech but not visually

### Existing Accessibility Patterns in the Codebase

| Pattern | Implementation | Example |
|---|---|---|
| Screen reader text | \`.cept-sr-only\` class | Hidden labels for icon buttons |
| Loading states | \`role="status"\` + \`aria-label\` | \`<LoadingSpinner />\` component |
| Breadcrumbs | \`<nav aria-label="Breadcrumbs">\` | Topbar breadcrumb navigation |
| Current page | \`aria-current="page"\` | Active breadcrumb segment |
| Decorative icons | \`aria-hidden="true"\` | Breadcrumb separators |
| Touch manipulation | \`touch-action: manipulation\` | Toggle/details elements |
| Minimum touch target | \`min-height: 44px\` | Toggle summaries on mobile |

---

## PWA & Branding

### Theme Meta

| Property | Value | Usage |
|---|---|---|
| Theme color | \`#1a1a2e\` | Browser chrome, status bar |
| Background color | \`#ffffff\` | Splash screen background |

### Logo & Wordmark

The Cept logo is a minimal geometric mark. Usage guidelines:

- Minimum clear space: 1x the logo height on all sides
- Minimum size: 24px height for digital, 10mm for print
- Do not stretch, rotate, or recolor the logo outside the brand palette
- On dark backgrounds, use the light variant; on light backgrounds, use the dark variant

---

## CSS Architecture

### File Organization

Styles are organized by component in co-located CSS files:

\`\`\`
packages/ui/src/
├── styles/globals.css          # Imports all component styles
├── components/
│   ├── editor/editor-styles.css
│   ├── sidebar/sidebar-styles.css
│   ├── topbar/topbar-styles.css
│   ├── command-palette/command-palette-styles.css
│   ├── search/search-styles.css
│   ├── knowledge-graph/knowledge-graph-styles.css
│   ├── database/database-styles.css
│   ├── page-header/page-header-styles.css
│   ├── app-menu/app-menu-styles.css
│   ├── settings/settings-styles.css
│   └── git/git-styles.css
\`\`\`

### Styling Rules

1. **Tailwind CSS v4** for utility classes. Use Tailwind utilities for layout, spacing, and simple visual properties.
2. **Component CSS files** for complex, multi-property styles. Co-locate CSS with the component it styles.
3. **No CSS-in-JS** — all styles are plain CSS or Tailwind utilities.
4. **CSS custom properties** with \`--cept-\` prefix for theme tokens (e.g., \`var(--cept-text-primary, #333)\`). Always provide a fallback value.
5. **Dark mode** via \`@media (prefers-color-scheme: dark)\` blocks in the same CSS file — never in a separate file.
6. **Class naming**: Use \`cept-\` prefix for global classes (e.g., \`.cept-sr-only\`, \`.cept-editor-content\`). Tailwind handles the rest.
7. **No \`!important\`** except to override third-party library defaults (TipTap, Leaflet).
8. **Transitions**: Keep durations between \`0.1s\` and \`0.15s\` for hover/focus. Longer durations (up to \`0.3s\`) only for layout shifts.
`;

// Pre-converted HTML content for each docs page
export const DOCS_CONTENT: Record<string, string> = {
  'docs-index': stripFrontMatter(MD_INDEX),
  'docs-introduction': stripFrontMatter(MD_INTRODUCTION),
  'docs-quick-start': stripFrontMatter(MD_QUICK_START),
  'docs-features': stripFrontMatter(MD_FEATURES),
  'docs-platform-support': stripFrontMatter(MD_PLATFORM_SUPPORT),
  'docs-vs-notion': stripFrontMatter(MD_VS_NOTION),
  'docs-vs-obsidian': stripFrontMatter(MD_VS_OBSIDIAN),
  'docs-from-notion': stripFrontMatter(MD_FROM_NOTION),
  'docs-from-obsidian': stripFrontMatter(MD_FROM_OBSIDIAN),
  'docs-toggle-syntax': stripFrontMatter(MD_TOGGLE_SYNTAX),
  'docs-markdown-extensions': stripFrontMatter(MD_MARKDOWN_EXTENSIONS),
  'docs-keyboard-shortcuts': stripFrontMatter(MD_KEYBOARD_SHORTCUTS),
  'docs-icons': stripFrontMatter(MD_ICONS),
  'docs-roadmap': stripFrontMatter(MD_ROADMAP),
  'docs-design-style-guide': stripFrontMatter(MD_DESIGN_STYLE_GUIDE),
  // Folder pages — auto-generated index content for parent nodes
  'docs-getting-started': stripFrontMatter(`# Getting Started\n\n- **Introduction** — What is Cept and why use it\n- **Quick Start** — Get up and running in under a minute`),
  'docs-guides': stripFrontMatter(`# Guides\n\n- **Features** — Complete feature reference with all block types\n- **Toggle Syntax** — Toggle block syntax and examples\n- **Markdown Extensions** — How Cept extends standard Markdown\n- **Platform Support** — Supported platforms and browsers`),
  'docs-comparison': stripFrontMatter(`# Comparisons\n\n- **Cept vs Notion** — Feature comparison for Notion users\n- **Cept vs Obsidian** — Feature comparison for Obsidian users`),
  'docs-migration': stripFrontMatter(`# Migration\n\n- **From Notion** — Import your Notion workspace\n- **From Obsidian** — Import your Obsidian vault`),
  'docs-reference': stripFrontMatter(`# Reference\n\n- **Keyboard Shortcuts** — All keyboard shortcuts\n- **Icons Reference** — All icons used in the app\n- **Design & Style Guide** — Colors, typography, accessibility, and interaction patterns\n- **Product Roadmap** — What's built and what's coming next`),
};

/** Map of docs page IDs to their source file path in the GitHub repo */
export const DOCS_SOURCE_PATHS: Record<string, string> = {
  'docs-index': 'docs/content/index.md',
  'docs-introduction': 'docs/content/getting-started/introduction.md',
  'docs-quick-start': 'docs/content/getting-started/quick-start.md',
  'docs-features': 'docs/content/guides/features.md',
  'docs-platform-support': 'docs/content/guides/platform-support.md',
  'docs-vs-notion': 'docs/content/comparison/vs-notion.md',
  'docs-vs-obsidian': 'docs/content/comparison/vs-obsidian.md',
  'docs-from-notion': 'docs/content/migration/from-notion.md',
  'docs-from-obsidian': 'docs/content/migration/from-obsidian.md',
  'docs-toggle-syntax': 'docs/content/guides/toggle-syntax.md',
  'docs-markdown-extensions': 'docs/content/guides/markdown-extensions.md',
  'docs-keyboard-shortcuts': 'docs/content/reference/keyboard-shortcuts.md',
  'docs-icons': 'docs/content/reference/icon-reference.md',
  'docs-roadmap': 'docs/content/reference/roadmap.md',
  'docs-design-style-guide': 'docs/content/reference/design-style-guide.md',
};

const DOCS_BRANCH = typeof __HEAD_BRANCH__ !== 'undefined' && __HEAD_BRANCH__ ? __HEAD_BRANCH__ : 'main';
const GITHUB_BASE = `https://github.com/nsheaps/cept/blob/${DOCS_BRANCH}/`;

export function getDocsSourceUrl(pageId: string): string | undefined {
  const path = DOCS_SOURCE_PATHS[pageId];
  return path ? `${GITHUB_BASE}${path}` : undefined;
}

export const DOCS_SPACE_INFO = {
  id: 'cept-docs',
  name: 'Cept Docs',
  source: 'Git (read-only)',
  remoteUrl: 'github.com/nsheaps/cept',
  branch: DOCS_BRANCH,
  subPath: 'docs/',
  pageCount: Object.keys(DOCS_CONTENT).length,
  contentSize: Object.values(DOCS_CONTENT).reduce((sum, c) => sum + c.length, 0),
};
