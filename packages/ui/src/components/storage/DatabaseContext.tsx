/**
 * DatabaseContext — React context providing access to the CeptDatabaseEngine.
 *
 * The engine is lazily created from the current StorageBackend.
 * Components use `useDatabaseEngine()` to get the engine instance.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { CeptDatabaseEngine } from '@cept/core';
import type { StorageBackend } from '@cept/core';

const DatabaseEngineContext = createContext<CeptDatabaseEngine | null>(null);

export function DatabaseProvider({
  backend,
  children,
}: {
  backend: StorageBackend;
  children: ReactNode;
}) {
  const engine = useMemo(() => new CeptDatabaseEngine(backend), [backend]);
  return (
    <DatabaseEngineContext.Provider value={engine}>
      {children}
    </DatabaseEngineContext.Provider>
  );
}

export function useDatabaseEngine(): CeptDatabaseEngine {
  const engine = useContext(DatabaseEngineContext);
  if (!engine) {
    throw new Error('useDatabaseEngine must be used within a DatabaseProvider');
  }
  return engine;
}
