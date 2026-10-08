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
export { MemoryBackend } from './memory.js';
export { ScopedBackend } from './scoped.js';
export {
  WebFsBackend,
  pickDirectory,
  folderPermission,
  createFolderHandleStore,
  restoreFolders,
  reconnectFolder,
} from './web-fs.js';
export type { FolderPermission, FolderHandleStore, RestoredFolder } from './web-fs.js';
export { GitBackend, GitDivergedError, createGitHttp } from './git-backend.js';
export type { GitAuth, GitHttp, GitFs } from './git-backend.js';
export {
  GIT_REPOS_DIR,
  GitAuthRequiredError,
  countUnpushedCommits,
  remoteCloneDir,
  syncRemoteClone,
} from './git-clone.js';
export type { RemoteCloneOptions, RemoteCloneResult } from './git-clone.js';
