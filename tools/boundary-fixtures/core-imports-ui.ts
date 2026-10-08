// lint-as: packages/core/src/fixture.ts
// expect: @nx/enforce-module-boundaries Circular dependency
// ui depends on core, so core importing ui is a cycle.
import { App } from '@cept/ui';

export const app = App;
