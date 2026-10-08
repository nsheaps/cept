/**
 * Runs the shared StorageBackend conformance suite against every backend.
 */

import 'fake-indexeddb/auto';
import { describeStorageBackendConformance } from './conformance.js';
import { MemoryBackend } from './memory.js';
import { BrowserFsBackend } from './browser-fs.js';
import { WebFsBackend } from './web-fs.js';
import { createMockRoot } from './web-fs.testing.js';
import { GitBackend } from './git-backend.js';
import type { GitFs } from './git-backend.js';

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

describeStorageBackendConformance(
  'GitBackend (over BrowserFsBackend)',
  () => {
    const underlying = new BrowserFsBackend(`conformance-git-${crypto.randomUUID()}`);
    const backend = new GitBackend({
      underlying,
      dir: '/',
      fs: underlying.getRawFs() as unknown as GitFs,
      authorName: 'Conformance',
      authorEmail: 'conformance@example.com',
    });
    return { backend, cleanup: () => backend.close() };
  },
  { watch: true },
);
