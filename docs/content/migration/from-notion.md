# Migrate from Notion

Import your entire Notion workspace into Cept.

## Export from Notion

1. Open Notion and go to **Settings & members**
2. Scroll down to **Export all workspace content**
3. Choose **Markdown & CSV** format
4. Click **Export** and download the ZIP file

## Import into Cept

1. Open Cept and go to **Settings > Import**
2. Select **Import from Notion**
3. Choose the downloaded ZIP file
4. Configure import options:
   - **Convert links** — Transform Notion-style links to Cept wiki-links (recommended)
   - **Import databases** — Include CSV database files
   - **Import images** — Include embedded images and attachments
5. Click **Import**

## What Gets Imported

| Notion Feature | Cept Equivalent |
|---------------|-----------------|
| Pages | Pages with full hierarchy |
| Sub-pages | Nested pages |
| Databases (CSV) | Database pages |
| Wiki-links | `[[wiki-links]]` |
| Headings, lists, quotes | Preserved as-is |
| Images & attachments | Imported as assets |
| Code blocks | Preserved with language |
| Tables | Markdown tables |

## What's Not Imported

- Notion-specific blocks (synced blocks, linked databases)
- Page permissions and sharing settings
- Comments and discussions
- Page analytics

## After Import

- Review the imported pages in your sidebar
- Check wiki-links are correctly connected
- Verify database data imported correctly
- Set up Git sync if desired for versioning
