export {
  AutoCommitEngine,
  commitPathName,
  generateCommitMessage,
  matchesPattern,
} from './auto-commit.js';
export type {
  AutoCommitConfig,
  FileChange,
  AutoCommitStatus,
  AutoCommitListener,
  AutoCommitEvent,
} from './auto-commit.js';

export {
  BranchStrategyManager,
  generateBranchName,
  isCeptBranch,
  parseBranchName,
  listCeptBranches,
  generateDeviceId,
  generateSessionId,
} from './branch-strategy.js';
export type { BranchStrategyType, BranchStrategyConfig, BranchInfo } from './branch-strategy.js';

export { parseConflictMarkers, threeWayMerge, autoResolve } from './merge-engine.js';
export type {
  MergeConflict,
  ResolutionStrategy,
  ResolvedConflict,
  MergeAttemptResult,
  AutoMergeConfig,
} from './merge-engine.js';

export { SyncEngine } from './sync-engine.js';
export type {
  SyncConfig,
  SyncState,
  SyncStatus,
  SyncEventType,
  SyncEvent,
  SyncListener,
} from './sync-engine.js';

export {
  SyncError,
  classifyPushReason,
  classifyPushReasons,
  classifySyncError,
  conflictPaths,
  isRetryableSyncError,
} from './sync-errors.js';
export type { SyncErrorKind } from './sync-errors.js';

export {
  DEFAULT_SYNC_SETTINGS,
  SYNC_SETTINGS_EXCLUDE,
  SYNC_SETTINGS_PATH,
  commitIdentityFor,
  loadSyncSettings,
  parseSyncSettings,
  saveSyncSettings,
  serializeSyncSettings,
  trackedBranch,
  withExcludeLine,
} from './sync-policy.js';
export type { CommitIdentity, GitHubUserIdentity, SyncSettings } from './sync-policy.js';

export { GitSpaceSession, RecordingBackend } from './git-space-session.js';
export type { GitSpaceSessionOptions, GitSpaceSyncResult } from './git-space-session.js';
