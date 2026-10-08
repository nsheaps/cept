// lint-as: packages/core/src/fixture.ts
// expect: cept/restricted-imports [platform]
import { readFile } from 'node:fs/promises';

export const read = readFile;
