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
export { MemoryBackend } from './storage/index.js';
export { ScopedBackend } from './storage/index.js';
export { GitBackend } from './storage/index.js';
export {
  WebFsBackend,
  pickDirectory,
  folderPermission,
  createFolderHandleStore,
  restoreFolders,
  reconnectFolder,
} from './storage/index.js';
export type { FolderPermission, FolderHandleStore, RestoredFolder } from './storage/index.js';
export type { GitAuth, GitHttp, GitFs } from './storage/index.js';
export {
  createGitHttp,
  GitAuthRequiredError,
  GitDivergedError,
  GIT_REPOS_DIR,
  countUnpushedCommits,
  openRemoteClone,
  remoteCloneDir,
  syncRemoteClone,
} from './storage/index.js';
export type { RemoteCloneOptions, RemoteCloneResult } from './storage/index.js';

// Auth
export type {
  AuthProvider,
  AuthProviderType,
  AuthToken,
  SSHKey,
  RepoInfo,
  HttpAuth,
  GitHubOAuthConfig,
  TokenStore,
  DeviceFlowVerification,
  FetchFn,
  PatAccount,
  PatAuthConfig,
  PatAuthFailure,
  PatGrants,
} from './auth/index.js';
export {
  GitHubAuthProvider,
  MemoryTokenStore,
  AuthPendingError,
  AuthSlowDownError,
  PatAuthProvider,
  PatAuthError,
  PAT_STORE_KEY,
  redactTokens,
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
export { CeptDatabaseEngine } from './database/index.js';
export {
  resolveRelation,
  getRelatedValues,
  computeRollup,
  addReverseRelation,
  removeReverseRelation,
} from './database/index.js';
export type {
  RelationValue,
  RollupFunction,
  RelationConfig,
  RollupConfig,
} from './database/index.js';

// Search
export type { SearchIndex, SearchResult, SearchOptions } from './search/index.js';
export { CeptSearchIndex } from './search/index.js';

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
export { CeptTemplateEngine } from './templates/index.js';
export {
  getBuiltInTemplates,
  getTemplatesByCategory,
  getBuiltInTemplate,
  getTemplateCategories,
  applyTemplateVariables,
  searchTemplates,
} from './templates/index.js';
export type { BuiltInTemplate, TemplateCategory } from './templates/index.js';

// Markdown
export type {
  MarkdownParser,
  ParsedPage,
  FrontMatterSplit,
  FrontMatterKeyBlock,
  PageFrontMatter,
  ReservedFrontMatterKey,
} from './markdown/index.js';
export {
  CeptMarkdownParser,
  RESERVED_FRONT_MATTER_KEYS,
  firstHeading,
  frontMatterKeyBlocks,
  frontMatterPrefix,
  joinFrontMatter,
  pageTitle,
  readFrontMatter,
  setFrontMatterKey,
  splitFrontMatter,
} from './markdown/index.js';

// Git
export {
  AutoCommitEngine,
  commitPathName,
  generateCommitMessage,
  matchesPattern,
} from './git/index.js';
export type {
  AutoCommitConfig,
  FileChange,
  AutoCommitStatus,
  AutoCommitListener,
  AutoCommitEvent,
} from './git/index.js';
export {
  BranchStrategyManager,
  generateBranchName,
  isCeptBranch,
  parseBranchName,
  listCeptBranches,
  generateDeviceId,
  generateSessionId,
} from './git/index.js';
export type { BranchStrategyType, BranchStrategyConfig, BranchInfo } from './git/index.js';
export { parseConflictMarkers, threeWayMerge, autoResolve } from './git/index.js';
export {
  CONFLICT_MARKERS,
  conflictCopyPath,
  hasConflictMarkers,
  mergeText,
  planMerge,
} from './git/index.js';
export type { ConflictResolution, TextMergeResult } from './git/index.js';
export type {
  MergeConflict,
  ResolutionStrategy,
  ResolvedConflict,
  MergeAttemptResult,
  AutoMergeConfig,
} from './git/index.js';
export {
  listPageHistory,
  openLocalRepository,
  PAGE_HISTORY_PAGE_SIZE,
  pageVersionContent,
  pageVersionDiff,
  readOnlyGitFs,
} from './git/index.js';
export type { LocalRepository, PageHistory } from './git/index.js';
export { GitSpaceSession, RecordingBackend, SyncEngine } from './git/index.js';
export type {
  GitSpaceLocalChanges,
  GitSpaceNewBranchResult,
  GitSpaceSessionOptions,
  GitSpaceSyncResult,
} from './git/index.js';
export {
  SyncError,
  classifyPushReason,
  classifyPushReasons,
  classifySyncError,
  conflictPaths,
  isRetryableSyncError,
  DEFAULT_SYNC_SETTINGS,
  SYNC_SETTINGS_EXCLUDE,
  SYNC_SETTINGS_PATH,
  commitIdentityFor,
  fallbackBranchName,
  loadSyncSettings,
  parseSyncSettings,
  saveSyncSettings,
  serializeSyncSettings,
  trackedBranch,
  withExcludeLine,
} from './git/index.js';
export type {
  SyncErrorKind,
  CommitIdentity,
  GitHubUserIdentity,
  SyncSettings,
} from './git/index.js';
export type {
  SyncConfig,
  SyncState,
  SyncStatus,
  SyncEventType,
  SyncEvent,
  SyncListener,
} from './git/index.js';

// CRDT
export type { SyncTransport, AwarenessUser } from './crdt/index.js';
export { CollaborationProvider } from './crdt/index.js';
export type {
  CollaborationConfig,
  CollaborationState,
  CollaborationEvent,
  CollaborationListener,
  DocumentState,
} from './crdt/index.js';
export { DatabaseSyncAdapter, generateChangeId } from './crdt/index.js';
export type {
  DatabaseChange,
  ApplyChangeCallback,
  DatabaseSyncConfig,
  DatabaseSyncEvent,
  DatabaseSyncEventType,
  DatabaseSyncListener,
  BroadcastFn,
} from './crdt/index.js';
export { OfflineQueue } from './crdt/index.js';
export type {
  ConnectionState,
  OfflineQueueConfig,
  OfflineQueueEvent,
  OfflineQueueEventType,
  OfflineQueueListener,
  SendFn,
} from './crdt/index.js';

// Importers
export {
  cleanNotionFilename,
  convertNotionLinks,
  extractTitle,
  getMimeType,
  importNotionZip,
} from './importers/index.js';
export type {
  NotionImportOptions,
  ImportedPage,
  ImportedAsset,
  NotionImportResult,
  ImportError,
  ImportProgress,
  ProgressCallback,
  ZipEntry,
  ZipReader,
} from './importers/index.js';
export {
  extractTags,
  convertObsidianLinks,
  extractObsidianTitle,
  importObsidianVault,
} from './importers/index.js';
export type {
  ObsidianImportOptions,
  ObsidianImportResult,
  VaultFile,
  VaultReader,
} from './importers/index.js';

// Exporters
export {
  convertWikiLinksToMarkdown,
  serializeFrontMatter,
  markdownToHtml,
  wrapHtmlDocument,
  exportPage,
  exportPages,
  DEFAULT_CSS,
} from './exporters/index.js';
export type {
  ExportFormat,
  ExportOptions,
  ExportedFile,
  ExportResult,
  ExportError,
  PageContent,
} from './exporters/index.js';

// Space config (space.cept.yaml, .cept.yaml)
export {
  SPACE_MARKER_YAML,
  SPACE_MARKER_YML,
  CEPT_CONFIG_YAML,
  CEPT_CONFIG_YML,
  SPACE_CONFIG_VERSION,
  spaceConfigSchema,
  pickSpaceMarker,
  pickCeptConfigFile,
  findSpaceMarker,
  parseSpaceConfig,
  serializeSpaceConfig,
  updateSpaceConfigText,
  parseCeptConfig,
  serializeCeptConfig,
  mergeFolderConfigs,
  createIgnoreMatcher,
  isDefaultHidden,
} from './space/index.js';
export type {
  PickedFile,
  ParseResult,
  SpaceConfig,
  CeptFolderConfig,
  ConfigLayer,
  MergedFolderConfig,
  IgnoreMatcher,
} from './space/index.js';

// Space folder tree (pages as files, path-based ids)
export {
  readSpaceTree,
  findPage,
  readPageText,
  writePageText,
  createPage,
  movePage,
  applyMoves,
  isPageFile,
  pickFolderPage,
  NEW_FOLDER_PAGE,
} from './space/index.js';
export type { PageNode, SpaceTree, TreeReadBackend, Moved } from './space/index.js';

// Space autodiscovery (find the spaces in every repository a GitHub token can read)
export { autodiscoverSpaces, AutodiscoveryError, MemoryEtagCache } from './space/index.js';
export type {
  RemoteSpace,
  LostSpace,
  AutodiscoveryOptions,
  AutodiscoveryResult,
  AutodiscoveryWarning,
  AutodiscoveryWarningKind,
  CachedResponse,
  EtagCache,
} from './space/index.js';

// Space discovery (find every space.cept.yaml below a folder, read-only)
export { discoverSpaces, walkSpaces } from './space/index.js';
export type {
  DiscoveredSpace,
  DiscoverOptions,
  DiscoveryResult,
  DiscoveryEvent,
  NestedMarker,
} from './space/index.js';
