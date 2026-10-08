// lint-as: docs/src/fixture.ts
// expect: @nx/enforce-module-boundaries "scope:docs" can only depend on libs tagged with "scope:shared"
// docs (scope:docs) may only import scope:shared projects; ui is scope:client.
import { App } from '@cept/ui';

export const app = App;
