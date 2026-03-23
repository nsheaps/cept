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
} from './backend.js';

export { BrowserFsBackend } from './browser-fs.js';
export { LocalFsBackend } from './local-fs.js';
export { WebFsBackend, pickDirectory, persistDirectoryHandle, loadDirectoryHandle } from './web-fs.js';
export { GitBackend } from './git-backend.js';
export type { GitAuth, GitHttp, GitFs } from './git-backend.js';
