// lint-as: packages/ui/src/fixture.ts
// expect: cept/restricted-imports [concrete-backend]
import { BrowserFsBackend } from '@cept/core';

export const backend = new BrowserFsBackend();
