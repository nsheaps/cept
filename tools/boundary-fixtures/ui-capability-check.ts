// lint-as: packages/ui/src/fixture.ts
// expect: none
// Gating on capabilities is the allowed form; other `type` comparisons are unaffected.
import type { StorageBackend } from '@cept/core';

export function showHistory(backend: StorageBackend, block: { type: string }): boolean {
  return backend.capabilities.history && block.type !== 'git-diff';
}
