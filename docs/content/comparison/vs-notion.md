# Cept vs Notion

Cept aims for feature parity with Notion while giving you full ownership of your data.

## Quick Comparison

| Feature | Cept | Notion |
|---------|------|--------|
| **Pricing** | Free, open source | Free tier + paid plans |
| **Data ownership** | Your device / your Git repo | Notion's servers |
| **Offline support** | Full offline, sync when online | Limited offline mode |
| **Privacy** | No telemetry, no third-party servers | Cloud-hosted, data on Notion servers |
| **Open source** | MIT licensed | Proprietary |
| **Block editor** | 20+ block types | 50+ block types |
| **Databases** | 6 views, 18 property types | 6 views, 20+ property types |
| **Version history** | Full Git log (unlimited) | 30 days (free) / unlimited (paid) |
| **Collaboration** | Git branches + CRDT | Real-time, built-in |
| **API** | Direct file access + Git | REST API |
| **Templates** | Built-in + custom | Large gallery |
| **Search** | Client-side, instant | Server-side |
| **Knowledge graph** | Built-in | Not available |
| **Self-hosting** | Yes (it's a static site) | No |
| **Mobile** | Coming soon | Available |
| **Import from Notion** | Supported | N/A |
| **File format** | Markdown + YAML | Proprietary |

## Where Cept Wins

### Data Ownership
Your notes are plain Markdown files (with YAML front matter for databases). You can read and edit them with any text editor, version them with Git, and move them to any other tool. There's zero lock-in.

### Privacy
Cept runs entirely on the client. No data leaves your device unless you choose to sync with a Git remote. There's no telemetry, no analytics, and no third-party servers.

### Version History
With Git as the sync layer, you get unlimited version history for free. Every edit is a commit. You can branch, diff, merge, and revert — just like code.

### Knowledge Graph
Cept includes a built-in interactive knowledge graph that visualizes page connections. Notion doesn't have this feature.

### Offline
Cept is offline-first by design. The entire app works without an internet connection. Notion's offline mode is limited and requires prior caching.

## Where Notion Wins

### Maturity
Notion has been in production for years with millions of users. Cept is new and still building toward feature parity.

### Real-time Collaboration
Notion's real-time collaboration is polished and battle-tested with features like comments, mentions, and permissions. Cept's collaboration model is based on Git, which is powerful but requires more technical knowledge.

### Ecosystem
Notion has a large ecosystem of integrations, templates, and third-party tools. Cept is just getting started.

### Mobile Apps
Notion has mature iOS and Android apps. Cept's mobile apps are still in development.

### Block Types
Notion supports more block types and database property types. Cept covers the most common ones and is adding more.

## Migrating from Notion

See the [migration guide](../migration/from-notion.md) for step-by-step instructions on importing your Notion workspace into Cept.
