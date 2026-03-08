# Features

Cept provides a comprehensive set of features for note-taking, knowledge management, and structured data. Here's everything available today and what's coming next.

## Block Editor

The editor is built on TipTap (ProseMirror) and supports 20+ block types. Type `/` anywhere to insert a block.

### Text Blocks

| Block | Slash Command | Markdown Shortcut |
|-------|---------------|-------------------|
| Paragraph | `/text` | Just start typing |
| Heading 1 | `/heading1` | `# ` |
| Heading 2 | `/heading2` | `## ` |
| Heading 3 | `/heading3` | `### ` |
| Blockquote | `/quote` | *(slash command only)* |
| Code Block | `/code` | ```` ``` ```` |
| Divider | `/divider` | `---` |

### List Blocks

| Block | Slash Command | Markdown Shortcut |
|-------|---------------|-------------------|
| Bullet List | `/bullet` | `- ` or `* ` |
| Numbered List | `/numbered` | `1. ` |
| To-do List | `/todo` | `[] ` |

### Rich Blocks

| Block | Slash Command | Description |
|-------|---------------|-------------|
| Callout | `/callout` | Highlighted note with icon and color |
| Toggle | `/toggle` or `> ` | Collapsible content section (supports nesting) |
| Columns | `/columns` | Side-by-side layout (2 or 3 columns) |
| Table | `/table` | Data table with resizable columns |
| Image | `/image` | Image from URL |
| Embed | `/embed` | Embedded video or web content |
| Bookmark | `/bookmark` | Rich link preview card |

### Advanced Blocks

| Block | Slash Command | Description |
|-------|---------------|-------------|
| Math Equation | `/math` | LaTeX math rendering (block and inline) |
| Mermaid Diagram | `/mermaid` | Flowcharts, sequence diagrams, and more |
| Inline Database | `/database` | Embedded database view |

### Toggle Demo

Toggles are collapsible content sections. Type `> ` at the start of a line (like Notion) or use `/toggle` to create one. Toggles support nesting:

> All Block Types
  Cept supports 20+ block types including paragraphs, headings, lists, code blocks, and more.

  > Nested Toggle: Rich Blocks
    Callouts, columns, tables, images, embeds, bookmarks, math equations, and Mermaid diagrams.

  > Nested Toggle: Advanced Features
    Inline databases, mentions, wiki-links, and synced blocks.

> Toggle with a List Inside
  - Bullet lists
  - Numbered lists
  - To-do lists with checkboxes

> # Heading Toggle
  Toggle summaries can include heading markers for styled collapsible sections.

### Text Formatting

- **Bold** (`Cmd/Ctrl + B`)
- *Italic* (`Cmd/Ctrl + I`)
- <u>Underline</u> (`Cmd/Ctrl + U`)
- ~~Strikethrough~~ (`Cmd/Ctrl + Shift + S`)
- `Inline code` (`Cmd/Ctrl + E`)
- Highlight (`Cmd/Ctrl + Shift + H`)
- Links, mentions, and wiki-links

## Page Management

- **Hierarchical pages** — Nest pages inside other pages to any depth
- **Inline title editing** — Click the page title to rename it directly
- **Page menu** — Access rename, duplicate, delete, move, and favorites from the `...` button
- **Favorites** — Pin frequently-used pages to the top of the sidebar
- **Recent pages** — Quickly access your recently viewed pages
- **Trash** — Deleted pages go to trash and can be restored or permanently deleted

## Sidebar

- **Collapsible** — Toggle with the hamburger menu or `Cmd/Ctrl + \`
- **Page tree** — Hierarchical view of all your pages with expand/collapse
- **Context menus** — Right-click or tap `...` for page actions
- **Sections** — Favorites, recent, all pages, and trash

## Search

- **Command palette** (`Cmd/Ctrl + K`) — Quick access to pages and commands
- **Full-text search** — Search across page titles and content with ranked results and snippets
- **Instant results** — Client-side search with no server round-trips

## Settings

- **Auto-save** — Changes save automatically as you type (configurable)
- **Spaces** — Manage your data spaces and their storage backends
- **Data & Cache** — View storage usage, clear data, or recreate demo content

## Storage Backends

| Backend | Setup | Offline | History | Collaboration | Status |
|---------|-------|---------|---------|---------------|--------|
| Browser (localStorage) | Zero setup | Yes | No | No | Available |
| Local Folder | Choose a folder | Yes | No | No | Coming soon |
| Git Repository | Connect a remote | Yes | Full git log | Via branches | Coming soon |

All three backends implement the same `StorageBackend` interface, so every feature works identically regardless of where your data lives.

## Knowledge Graph

Visualize your pages and their connections as an interactive force-directed graph:

- **Global view** — See all pages and links at once
- **Local view** — Focus on the neighborhood of the current page
- **Filters** — Search, tags, orphans, path exclusions
- **Interactive** — Pan, zoom, click to navigate, hover for previews
- **Configurable physics** — Adjust forces, distances, and node sizes

## Databases

Create structured data with multiple view types:

- **Table view** — Spreadsheet-like grid with sortable columns
- **Board view** — Kanban-style cards grouped by property
- **Calendar view** — Events on a monthly/weekly calendar
- **Gallery view** — Visual cards with cover images
- **List view** — Compact list with key properties
- **Map view** — Geographic pins for location data

### Property Types

18 property types: Title, Text, Number, Select, Multi-select, Date, Person, Files, Checkbox, URL, Email, Phone, Formula, Relation, Rollup, Created time, Created by, Last edited time.

## Templates

Start new pages from built-in templates:

- Meeting Notes
- Project Tracker
- Sprint Board
- Journal
- Wiki
- Reading List
- CRM

Save any page as a template for reuse.

## Import & Export

### Import From

- **Notion** — Export as Markdown & CSV from Notion, import the ZIP into Cept
- **Obsidian** — Point Cept at your vault directory or ZIP

### Export To

- **Markdown** — Plain Markdown files
- **HTML** — Styled HTML pages
- **PDF** — Print-ready documents
