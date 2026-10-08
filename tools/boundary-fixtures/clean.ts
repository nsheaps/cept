// lint-as: packages/ui/src/fixture.ts
// expect: none
// Type-only imports of a concrete backend and the StorageBackend interface are allowed.
import type { GitBackend, StorageBackend } from '@cept/core';

export type Backends = StorageBackend | GitBackend;
