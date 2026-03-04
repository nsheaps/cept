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
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
