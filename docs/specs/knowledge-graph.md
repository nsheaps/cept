# Feature: Knowledge Graph

## Status: Draft

## Overview
Force-directed knowledge graph visualization showing all pages as nodes and their connections as edges. Supports global view (all pages), local view (neighborhood of current page), filters, color groups, and time-lapse animation.

## User Stories
- As a user, I want to see how my pages connect, so that I can discover relationships
- As a user, I want to explore my local page neighborhood, so that I can see related content
- As a user, I want to filter the graph, so that I can focus on what matters

## Requirements

### Functional Requirements
FR-1: Global graph shows all pages as nodes with links as edges
FR-2: Local graph shows neighborhood of current page with configurable depth (1-5)
FR-3: Filters: search, tags, orphans, attachments, path exclusion
FR-4: Color groups defined by search queries
FR-5: Node size proportional to connection count
FR-6: Interactive: pan, zoom, click to navigate, hover for preview
FR-7: Configurable physics: center force, repel force, link force, link distance

### Non-Functional Requirements
NFR-1: Render 1000+ nodes smoothly (60fps) using Web Worker + quadtree

## Design

### API / Interface
See `packages/core/src/graph/index.ts` for GraphNode, GraphEdge, GraphData types.

## Dependencies
- Depends on: StorageBackend, MarkdownParser (for extracting links)
- Libraries: d3-force (2D), 3d-force-graph (optional 3D)

## Test Plan
- `features/graph/global-graph.feature`
- `features/graph/local-graph.feature`
- `features/graph/graph-filters.feature`

## Research & References
- [Obsidian Graph View](https://help.obsidian.md/plugins/graph)
- [d3-force](https://d3js.org/d3-force)
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph)

## Revision History
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
