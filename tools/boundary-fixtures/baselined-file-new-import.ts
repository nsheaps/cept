// lint-as: packages/ui/src/components/storage/git-space.ts
// expect: cept/restricted-imports [concrete-backend]
// git-space.ts is baselined for GitBackend and BrowserFsBackend only; a new
// concrete backend import in the same file must still fail.
import { LocalFsBackend } from '@cept/core';

export const backend = LocalFsBackend;
