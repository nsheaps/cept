# Feature: Markdown Pipeline

## Status: Live (editor), Phase 1

## Overview

One parser and serializer reads and writes every page (D-15, D-49). It converts between Markdown with front matter and ProseMirror JSON, the document the editor holds. remark/mdast (unified, remark-gfm, remark-math) does the parsing and writing; [prosemirror.ts](../../packages/core/src/markdown/prosemirror.ts) maps mdast to ProseMirror JSON and back.

## User Stories

- As a user, I want my notes stored as readable Markdown, so that I can edit them with any text editor
- As a developer, I want a reliable round-trip, so that save and load never corrupt data

## Requirements

### Functional Requirements

FR-1: Parse CommonMark + GFM (headings, lists, code, quotes, links, images, tables, task lists, footnotes) and math (`$`, `$$`).
FR-2: Keep front matter byte for byte when it is not edited ([front-matter.ts](../../packages/core/src/markdown/front-matter.ts)).
FR-3: Load Cept's own blocks from their HTML encoding (callout, toggle, columns, embed, bookmark, image figure; [html-blocks.ts](../../packages/core/src/markdown/html-blocks.ts)) and annotated fences (mermaid) through fenced-block plugins.
FR-4: Save an unedited page byte for byte, and write only edited or new blocks through remark-stringify.
FR-4a: Write underline and highlight, which Markdown has no syntax for, as `<u>…</u>` and `<mark>…</mark>` (`<mark data-color="…">` for a colour), and read those exact tag pairs back as marks.
FR-5: Keep Markdown the pipeline does not model (unknown HTML, comments, reference definitions) as `rawBlock`/`rawInline` source.

### Non-Functional Requirements

NFR-1: Parse a 100KB document in < 100ms
NFR-2: Round-trip fidelity, checked by the corpus in `packages/core/src/markdown/__fixtures__/`

## Design

### API / Interface

- `parseMarkdownDocument(markdown)` returns `{ frontMatter, doc, sources }`: the front matter, the ProseMirror document, and each top-level block's source.
- `serializeMarkdownDocument(doc, original?, frontMatter?)` writes a document, reusing the source of every block that matches one in `original`.
- `claimFencedBlocks` / `releaseFencedBlocks` turn annotated fences into plugin nodes and back.

The editor uses these through [markdown-bridge.ts](../../packages/ui/src/components/editor/markdown-bridge.ts): it loads a page, takes the document as the editor holds it as the save baseline, writes Markdown on every update, and reads and writes the clipboard as Markdown (Shift+paste keeps plain text).

## Dependencies

- Depends on: unified, remark-parse, remark-gfm, remark-math, remark-stringify, js-yaml
- Depended on by: the editor (`CeptEditor`); the static renderer and exporters are to follow (REQ-SSG-004)

## Test Plan

- Core: the round-trip corpus (load and save unchanged, full rewrite re-parses equal, full rewrite byte for byte with listed exceptions).
- Editor: every corpus fixture loaded into the editor schema saves unchanged (`document-extensions.test.ts`); the bridge saves untouched blocks verbatim after an edit (`markdown-bridge.test.ts`, `CeptEditor.test.tsx`).

## Research & References

- [CommonMark spec](https://spec.commonmark.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)

## Revision History

| Date       | Author | Changes                                                                          |
| ---------- | ------ | -------------------------------------------------------------------------------- |
| 2026-03-04 | Claude | Initial draft                                                                    |
| 2026-10-12 | Claude | Describe the remark pipeline the editor uses; `CeptMarkdownParser` retired (49b) |
