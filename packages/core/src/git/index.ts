export {
  AutoCommitEngine,
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
export type {
  BranchStrategyType,
  BranchStrategyConfig,
  BranchInfo,
} from './branch-strategy.js';

export {
  parseConflictMarkers,
  threeWayMerge,
  autoResolve,
} from './merge-engine.js';
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
