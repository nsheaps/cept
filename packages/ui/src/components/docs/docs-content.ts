// Bundled documentation content from docs/content/ in the Cept repository.
// Source: https://github.com/nsheaps/cept/tree/main/docs/content
// This is a read-only Git-backed space.

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

/** Get the base URL for static assets (screenshots, etc.) */
function getBaseUrl(): string {
  if (typeof document !== 'undefined') {
    // Use the document base URI which respects <base> tags and Vite's base config
    const base = document.baseURI;
    try {
      const url = new URL(base);
      return url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    } catch {
      return '/';
    }
  }
  return '/';
}

/** Resolve {{base}} placeholders in a content string at read time */
export function resolveDocsContent(content: string): string {
  return content.replace(/\{\{base\}\}/g, getBaseUrl());
}

// --- Inline documentation content ---
// These are the markdown files from docs/content/

const MD_INDEX = `# Cept Documentation

Welcome to the Cept documentation. Cept is an open-source Notion alternative that runs entirely on the client with optional Git-based sync and collaboration.

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

## Design Principles

1. **Markdown first** — Standard markdown is preferred for all content that has a natural markdown representation
2. **HTML fallback** — Rich blocks that extend markdown use HTML with \`data-type\` attributes
3. **Interoperability** — Files can be opened in any markdown editor; extended blocks render as HTML
4. **No proprietary format** — Everything is plain text, never binary or opaque`;

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
  // Folder pages — auto-generated index content for parent nodes
  'docs-getting-started': stripFrontMatter(`# Getting Started\n\n- **Introduction** — What is Cept and why use it\n- **Quick Start** — Get up and running in under a minute`),
  'docs-guides': stripFrontMatter(`# Guides\n\n- **Features** — Complete feature reference with all block types\n- **Toggle Syntax** — Toggle block syntax and examples\n- **Markdown Extensions** — How Cept extends standard Markdown\n- **Platform Support** — Supported platforms and browsers`),
  'docs-comparison': stripFrontMatter(`# Comparisons\n\n- **Cept vs Notion** — Feature comparison for Notion users\n- **Cept vs Obsidian** — Feature comparison for Obsidian users`),
  'docs-migration': stripFrontMatter(`# Migration\n\n- **From Notion** — Import your Notion workspace\n- **From Obsidian** — Import your Obsidian vault`),
  'docs-reference': stripFrontMatter(`# Reference\n\n- **Keyboard Shortcuts** — All keyboard shortcuts\n- **Icons Reference** — All icons used in the app\n- **Product Roadmap** — What's built and what's coming next`),
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
};

const GITHUB_BASE = 'https://github.com/nsheaps/cept/blob/main/';

export function getDocsSourceUrl(pageId: string): string | undefined {
  const path = DOCS_SOURCE_PATHS[pageId];
  return path ? `${GITHUB_BASE}${path}` : undefined;
}

export const DOCS_SPACE_INFO = {
  id: 'cept-docs',
  name: 'Cept Docs',
  source: 'Git (github.com/nsheaps/cept, docs/, read-only)',
  pageCount: Object.keys(DOCS_CONTENT).length,
  contentSize: Object.values(DOCS_CONTENT).reduce((sum, c) => sum + c.length, 0),
};
