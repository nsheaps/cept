/**
 * FolderHost — how the app reaches real folders on this device (REQ-WS-012,
 * REQ-WEB-023). The host (the web app) builds it from the File System Access
 * API, because ui never constructs a concrete backend (CLAUDE.md rule 3).
 * Without a FolderHost, "Open folder" is not offered.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { FolderHandleStore, StorageBackend } from '@cept/core';

export interface FolderHost {
  /** Show the folder picker; call only from a click. Null when the user cancels. */
  pick(): Promise<FileSystemDirectoryHandle | null>;
  /** A backend over a picked folder. Creating it writes nothing. */
  open(handle: FileSystemDirectoryHandle): StorageBackend;
  /** Picked folders kept across reloads, keyed by the id of the space they open. */
  handles: FolderHandleStore;
}

const FolderHostContext = createContext<FolderHost | null>(null);

export function FolderHostProvider({
  host,
  children,
}: {
  host: FolderHost | null;
  children: ReactNode;
}) {
  return <FolderHostContext.Provider value={host}>{children}</FolderHostContext.Provider>;
}

/** The host's folder access, or null when this host cannot open folders. */
export function useFolderHost(): FolderHost | null {
  return useContext(FolderHostContext);
}
