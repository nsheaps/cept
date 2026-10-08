# Feature: Storage Backends

## Status: Draft

## Overview

Cept supports three storage backends: Browser (IndexedDB), Local Folder (Node fs), and Git (isomorphic-git). All backends implement the same StorageBackend interface, ensuring the editor, database, and graph features work identically regardless of backend.

## User Stories

- As a new user, I want to start writing in my browser immediately, so that I don't need any setup
- As a power user, I want to open a local folder of Markdown files, so that I can use my existing notes
- As a team, I want to connect a Git repo, so that we get version history and collaboration

## Requirements

### Functional Requirements

FR-1: BrowserFsBackend must persist data in IndexedDB across browser sessions
FR-2: LocalFsBackend must read/write plain Markdown files to the native filesystem
FR-3: GitBackend must wrap a filesystem backend and add Git operations via isomorphic-git
FR-4: All backends must implement the StorageBackend interface identically
FR-5: Git-specific features (history, collab, sync) gated by BackendCapabilities, not backend type

### Non-Functional Requirements

NFR-1: BrowserFsBackend file read/write < 50ms for files under 100KB
NFR-2: LocalFsBackend must detect external file changes via watch()

## Design

### API / Interface

See `packages/core/src/storage/backend.ts` for the full TypeScript interface.

`LocalFsBackend` (`packages/desktop/src/local-fs.ts`) is the Node-fs implementation. It lives in `@cept/desktop`, not `@cept/core`, because core never imports platform modules (CLAUDE.md rule 1).

`MemoryBackend` (`packages/core/src/storage/memory.ts`) is an in-memory implementation for tests and ephemeral workspaces. Directories are implicit (a directory exists while a file lives under it), and `watch()` reports changes made through the same instance.

### Behavioural contract

`packages/core/src/storage/conformance.ts` is the executable specification every backend must pass (memory, browser-fs, web-fs and git over browser-fs run from `packages/core/src/storage/conformance.test.ts`; local-fs and the git working tree on a real directory run from `packages/desktop/src/local-fs.conformance.test.ts`, which imports the suite via `@cept/core/storage/conformance.js`). It fixes: missing file reads return `null`; writes round-trip bytes and create parent directories; `listDirectory` returns direct children only and `[]` for a missing directory; `stat` returns `null` for a missing path; `deleteFile` on a directory deletes everything under it (recursive) and on a missing path is a no-op; and `watch()` delivers create/modify/delete events for changes at or under the watched path (events carry workspace-relative paths with a leading `/`). `WebFsBackend` cannot watch (the File System Access API has no change notifications) and is checked only for a callable unsubscribe. Whether an emptied parent directory survives is deliberately unspecified.

## Dependencies

- Depends on: lightning-fs (browser), isomorphic-git (git)
- Depended on by: every other feature in the application

## Test Plan

- `features/storage/browser-backend.feature`
- `features/storage/local-folder.feature`
- Unit tests for each backend implementation

## Research & References

- [isomorphic-git docs](https://isomorphic-git.org/)
- [lightning-fs](https://github.com/nicolo-ribaudo/lightning-fs)

## Revision History

| Date       | Author | Changes       |
| ---------- | ------ | ------------- |
| 2026-03-04 | Claude | Initial draft |
