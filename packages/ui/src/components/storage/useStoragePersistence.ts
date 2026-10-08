import { useCallback, useRef } from 'react';
import { checkStoragePersistence, storageWarningText } from './storage-persistence.js';
import type { StorageManagerLike } from './storage-persistence.js';

/**
 * Returns a function to call when a space is created in browser storage
 * (REQ-WEB-004). The first call asks for persistent storage and shows a
 * warning for each problem found; later calls do nothing. The guard lives in
 * the component that uses the hook (`App`), which is mounted once per page
 * load; remounting it would ask again.
 */
export function useStoragePersistence(
  warn: (text: string) => void,
  storage?: StorageManagerLike | null,
): () => Promise<void> {
  const asked = useRef(false);
  return useCallback(async () => {
    if (asked.current) return;
    asked.current = true;
    const warnings = await checkStoragePersistence(storage);
    for (const warning of warnings) warn(storageWarningText(warning));
  }, [warn, storage]);
}
