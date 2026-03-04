# Feature: Database Engine

## Status: Draft

## Overview
Core database engine that provides CRUD operations, filtering, sorting, grouping, and formula evaluation for Cept databases stored as YAML files.

## User Stories
- As a user, I want to create databases with custom properties, so that I can organize structured data
- As a user, I want to filter and sort my data, so that I can find what I need quickly
- As a user, I want formulas that compute values, so that I can derive data automatically

## Requirements

### Functional Requirements
FR-1: Support all 18 property types (title, text, number, select, multi_select, date, etc.)
FR-2: CRUD operations on database rows
FR-3: Filter rows by any property with standard operators
FR-4: Sort rows by one or more properties
FR-5: Group rows by a property value (for board/kanban view)
FR-6: Evaluate formula expressions referencing row properties
FR-7: Support relation and rollup property types

### Non-Functional Requirements
NFR-1: Filter/sort 1000 rows in < 100ms
NFR-2: Formula evaluation < 10ms per cell

## Design

### Data Model
Databases stored as YAML in `.cept/databases/<id>.yaml`. See spec Section 4.3.

### API / Interface
See `packages/core/src/database/index.ts` for the DatabaseEngine interface.

## Dependencies
- Depends on: StorageBackend (for reading/writing YAML files), models
- Depended on by: Table, Board, Calendar, Map, Gallery, List views

## Test Plan
- `features/database/table-view.feature`
- Unit tests for each property type, filter operator, sort, group, formula

## Research & References
- [Notion database properties](https://www.notion.so/help/database-properties)

## Revision History
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
