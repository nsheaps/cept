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
} from './config.js';
export type {
  PickedFile,
  ParseResult,
  SpaceConfig,
  CeptFolderConfig,
  ConfigLayer,
  MergedFolderConfig,
  IgnoreMatcher,
} from './config.js';
export { discoverSpaces, walkSpaces, findGitRoot, DEFAULT_MAX_DEPTH } from './discover.js';
export type {
  DiscoveryBackend,
  DiscoveredSpace,
  NestedMarker,
  DiscoverOptions,
  DiscoveryEvent,
  DiscoveryResult,
} from './discover.js';
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
} from './tree.js';
export type { PageNode, SpaceTree, TreeReadBackend, Moved } from './tree.js';
