# Feature: Markdown Parser

## Status: Draft

## Overview
Bidirectional parser/serializer that converts between Markdown (with YAML front matter and HTML comment extensions) and Cept's internal Block tree representation.

## User Stories
- As a user, I want my notes stored as readable Markdown, so that I can edit them with any text editor
- As a developer, I want a reliable roundtrip parser, so that save/load never corrupts data

## Requirements

### Functional Requirements
FR-1: Parse CommonMark + GFM (headings, lists, code, quotes, links, images, tables)
FR-2: Parse YAML front matter into PageMeta
FR-3: Parse `<!-- cept:block -->` HTML comments into extended block types
FR-4: Serialize Block tree back to Markdown with identical output (roundtrip fidelity)
FR-5: Support all block types defined in the spec (callout, toggle, columns, mermaid, etc.)

### Non-Functional Requirements
NFR-1: Parse a 100KB document in < 100ms
NFR-2: Roundtrip fidelity — parse then serialize should produce identical output

## Design

### API / Interface
See `packages/core/src/markdown/index.ts` for the MarkdownParser interface.

## Dependencies
- Depends on: models (Block, PageMeta types)
- Depended on by: editor, storage backends, search index

## Test Plan
- Unit tests: roundtrip every block type
- Edge cases: empty documents, nested blocks, malformed front matter

## Research & References
- [CommonMark spec](https://spec.commonmark.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)

## Revision History
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
