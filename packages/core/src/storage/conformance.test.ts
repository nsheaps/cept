/**
 * Runs the shared StorageBackend conformance suite against every backend.
 */

import * as fs from 'node:fs/promises';
import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import 'fake-indexeddb/auto';
import { describeStorageBackendConformance } from './conformance.js';
import { MemoryBackend } from './memory.js';
import { BrowserFsBackend } from './browser-fs.js';
import { WebFsBackend } from './web-fs.js';
import { createMockRoot } from './web-fs.testing.js';
import { LocalFsBackend } from './local-fs.js';
import { GitBackend } from './git-backend.js';

describeStorageBackendConformance('MemoryBackend', () => ({ backend: new MemoryBackend() }), {
  watch: true,
});

describeStorageBackendConformance(
  'BrowserFsBackend',
  () => ({ backend: new BrowserFsBackend(`conformance-${crypto.randomUUID()}`) }),
  { watch: true },
);

describeStorageBackendConformance('WebFsBackend (mock handles)', () => ({
  backend: new WebFsBackend(createMockRoot()),
}));

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
