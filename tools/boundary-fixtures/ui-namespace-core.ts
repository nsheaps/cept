// lint-as: packages/ui/src/fixture.ts
// expect: cept/restricted-imports "*" from "@cept/core"
// A namespace import hides which names it uses, so it could reach a concrete backend.
import * as core from '@cept/core';

export const backend = new core.BrowserFsBackend();
