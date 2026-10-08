// Prints `version=<installed @playwright/test version>` for $GITHUB_OUTPUT, so
// the browser cache key and image cannot drift from the runtime when Renovate
// bumps it.
import { readFileSync } from 'node:fs';

const pkgPath = import.meta.resolve('@playwright/test/package.json').replace('file://', '');
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
console.log(`version=${version}`);
