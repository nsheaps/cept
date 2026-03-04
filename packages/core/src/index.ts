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

// Storage
export type {
  StorageBackend,
  GitStorageBackend,
  BackendCapabilities,
  WorkspaceConfig,
  DirEntry,
  FileStat,
  FsEvent,
  FsEventType,
  Unsubscribe,
  CommitHash,
  CommitInfo,
  PushResult,
  MergeResult,
  DiffResult,
  LogOptions,
  Branch,
  BranchOperations,
  RemoteOperations,
} from './storage/index.js';
export { BrowserFsBackend } from './storage/index.js';
export { LocalFsBackend } from './storage/index.js';
export { GitBackend } from './storage/index.js';
export type { GitAuth } from './storage/index.js';

// Auth
export type {
  AuthProvider,
  AuthProviderType,
  AuthToken,
  SSHKey,
  RepoInfo,
  HttpAuth,
} from './auth/index.js';

// Models
export type {
  UUID,
  ISODateTime,
  PageMeta,
  BlockType,
  Block,
  PropertyType,
  PropertyDefinition,
  SelectOption,
  ViewType,
  SortDirection,
  SortConfig,
  FilterOperator,
  FilterConfig,
  ViewConfig,
  DatabaseSchema,
  DatabaseRow,
  Location,
} from './models/index.js';

// Database
export type { DatabaseEngine, DatabaseQuery, GroupedRows } from './database/index.js';

// Search
export type { SearchIndex, SearchResult, SearchOptions } from './search/index.js';

// Graph
export type {
  GraphNode,
  GraphEdge,
  GraphData,
  GraphNodeType,
  GraphEdgeType,
  GraphColorGroup,
  GraphFilters,
  GraphPhysics,
} from './graph/index.js';

// Templates
export type { TemplateEngine, TemplateMeta, TemplateType } from './templates/index.js';

// Markdown
export type { MarkdownParser, ParsedPage } from './markdown/index.js';
export { CeptMarkdownParser } from './markdown/index.js';

// CRDT
export type { SyncTransport, AwarenessUser } from './crdt/index.js';
