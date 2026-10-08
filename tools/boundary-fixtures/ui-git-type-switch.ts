// lint-as: packages/ui/src/fixture.ts
// expect: cept/no-git-type-check backend.capabilities
import type { StorageBackend } from '@cept/core';

export function label(backend: StorageBackend): string {
  switch (backend.type) {
    case 'git':
      return 'Git';
    default:
      return 'Local';
  }
}
