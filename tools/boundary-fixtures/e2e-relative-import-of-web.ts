// lint-as: e2e/fixture.ts
// expect: @nx/enforce-module-boundaries Projects cannot be imported by a relative or absolute path
// App projects (web, desktop, mobile, signaling) are not importable by name, and a path into
// another project is rejected, so the only cross-project imports are of core and ui.
import { App } from '../packages/web/src/main';

export const app = App;
