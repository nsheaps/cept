# Feature: Full-Text Search

## Status: Draft

## Overview
Client-side full-text search index that enables instant search across all pages, titles, and database values.

## User Stories
- As a user, I want to search my workspace instantly, so that I can find any page or content quickly

## Requirements

### Functional Requirements
FR-1: Index page titles, content, and database property values
FR-2: Return ranked results with relevance scoring
FR-3: Show snippets with highlighted matches
FR-4: Rebuild index on workspace open and incrementally on edits

### Non-Functional Requirements
NFR-1: Search results < 50ms for workspaces with 1000 pages

## Design

### API / Interface
See `packages/core/src/search/index.ts` for the SearchIndex interface.

## Dependencies
- Depends on: StorageBackend, MarkdownParser
- Depended on by: Search UI, Command Palette

## Test Plan
- Unit tests for indexing and query accuracy
- Performance benchmarks

## Revision History
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
