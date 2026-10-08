// lint-as: packages/core/src/storage/local-fs.ts
// expect: cept/restricted-imports "node:path"
// local-fs.ts is baselined for one node:path import; a second one must still fail.
import path from 'node:path';
import { join } from 'node:path';

export const paths = [path.sep, join];
