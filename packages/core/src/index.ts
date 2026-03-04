/**
 * @cept/core — Shared business logic for Cept
 *
 * This package contains all platform-independent business logic:
 * - StorageBackend abstraction + implementations
 * - Database engine (schema, CRUD, filter, sort, group, formulas)
 * - Markdown <-> Block tree parser/serializer
 * - Search index
 * - Template engine
 * - Knowledge graph builder
 * - CRDT bindings (Yjs)
 * - Auth provider abstraction
 */

export type { StorageBackend, BackendCapabilities, GitStorageBackend } from './storage/backend.js';
