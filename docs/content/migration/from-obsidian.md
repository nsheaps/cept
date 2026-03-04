# Migrate from Obsidian

Import your Obsidian vault into Cept.

## Import Process

1. Open Cept and go to **Settings > Import** (coming soon)
2. Select **Import from Obsidian**
3. Choose your vault directory (or a ZIP of your vault)
4. Configure import options:
   - **Convert links** — Transform `[[wiki-links]]` to Cept format
   - **Import attachments** — Include images and other files
   - **Ignore paths** — Folders to skip (`.obsidian`, `.trash` by default)
5. Click **Import**

## What Gets Imported

| Obsidian Feature | Cept Equivalent |
|-----------------|-----------------|
| Markdown files | Pages |
| Wiki-links `[[Page]]` | Wiki-links (converted) |
| Tags `#tag` | Preserved in content |
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
- `.obsidian/` configuration
- Canvas files
- Community plugin metadata
- Dataview queries (converted to plain text)

## Link Conversion

Obsidian wiki-links are converted to Cept format:

- `[[Page Name]]` → `[[/path/to/Page Name.md|Page Name]]`
- `[[Page Name|Display Text]]` → `[[/path/to/Page Name.md|Display Text]]`
- `[[Page Name#Heading]]` → `[[/path/to/Page Name.md#Heading|Page Name]]`

## Tags

Tags from both front matter and inline `#tag` syntax are preserved. They appear in the imported content exactly as written.

## Why Switch?

See the full [Cept vs Obsidian comparison](../comparison/vs-obsidian.md) for details on what you gain by switching.
