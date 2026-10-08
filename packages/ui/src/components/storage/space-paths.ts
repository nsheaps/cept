/**
 * Where each space keeps its data inside a StorageBackend.
 *
 * The default space keeps the root paths it had before multiple spaces existed
 * (`.cept/workspace-state.json`, `pages/`); every other space lives under
 * `.cept/spaces/{id}/`. Shared by `StorageContext` and `SpaceManager` so the
 * layout is defined once.
 */

export const DEFAULT_SPACE_ID = 'default';

/** The workspace state file for a space. */
export function spaceWorkspaceFile(spaceId: string): string {
  if (spaceId === DEFAULT_SPACE_ID) return '.cept/workspace-state.json';
  return `.cept/spaces/${spaceId}/workspace-state.json`;
}

/** The pages directory for a space. */
export function spacePagesDir(spaceId: string): string {
  if (spaceId === DEFAULT_SPACE_ID) return 'pages';
  return `.cept/spaces/${spaceId}/pages`;
}

/** The folder holding all of a non-default space's data. */
export function spaceDataDir(spaceId: string): string {
  return `.cept/spaces/${spaceId}`;
}
