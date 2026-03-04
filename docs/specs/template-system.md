# Feature: Template System

## Status: Draft

## Overview
Template system for creating pages and databases from pre-defined templates stored in `.cept/templates/`.

## User Stories
- As a user, I want to create pages from templates, so that I don't start from scratch
- As a user, I want to save my pages as templates, so that I can reuse them

## Requirements

### Functional Requirements
FR-1: List available templates (built-in + user-created)
FR-2: Create a new page/database from a template
FR-3: Save any existing page/database as a template
FR-4: Delete templates
FR-5: Built-in starter templates: Meeting Notes, Project Tracker, Sprint Board, Journal, Wiki, Reading List, CRM

## Design

### API / Interface
See `packages/core/src/templates/index.ts` for the TemplateEngine interface.

## Dependencies
- Depends on: StorageBackend, MarkdownParser
- Depended on by: Template Gallery UI, New Page dialog

## Test Plan
- Unit tests for template CRUD operations
- Integration tests for template application

## Revision History
| Date | Author | Changes |
|---|---|---|
| 2026-03-04 | Claude | Initial draft |
