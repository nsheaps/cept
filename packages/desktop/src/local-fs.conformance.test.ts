/**
 * Runs the shared StorageBackend conformance suite against the Node-fs backends
 * (LocalFsBackend, and GitBackend working on a real directory through it).
 */

import * as fs from 'node:fs/promises';
import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GitBackend } from '@cept/core';
import { describeStorageBackendConformance } from '@cept/core/storage/conformance.js';
import { LocalFsBackend } from './local-fs.js';

async function tempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describeStorageBackendConformance(
  'LocalFsBackend (temp dir)',
  async () => {
    const dir = await tempDir('cept-conformance-local-');
    const backend = new LocalFsBackend(dir);
    return {
      backend,
      cleanup: async () => {
        await backend.close();
        await fs.rm(dir, { recursive: true, force: true });
      },
    };
  },
  { watch: true },
);

describeStorageBackendConformance(
  'GitBackend (working tree, temp dir)',
  async () => {
    const dir = await tempDir('cept-conformance-git-');
    const backend = new GitBackend({
      underlying: new LocalFsBackend(dir),
      dir,
      fs: nodeFs,
      authorName: 'Conformance',
      authorEmail: 'conformance@example.com',
    });
    return {
      backend,
      cleanup: async () => {
        await backend.close();
        await fs.rm(dir, { recursive: true, force: true });
      },
    };
  },
  { watch: true },
);
