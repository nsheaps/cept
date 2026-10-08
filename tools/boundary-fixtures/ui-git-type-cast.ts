// lint-as: packages/ui/src/fixture.ts
// expect: cept/no-git-type-check backend.capabilities
import type { StorageBackend } from '@cept/core';

export function showHistory(backend: StorageBackend): boolean {
  return (backend.type as string) === `git`;
}
