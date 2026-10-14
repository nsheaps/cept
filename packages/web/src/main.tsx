// Buffer polyfill — isomorphic-git requires Node's Buffer global in the browser
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { StrictMode, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { App, FolderHostProvider, GitAuthsProvider, StorageProvider } from '@cept/ui';
import { BrowserFsBackend, GitAuthRegistry } from '@cept/core';
import '@cept/ui/styles/globals.css';
import {
  registerServiceWorker,
  consumeUpdateFlag,
  unregisterServiceWorker,
} from './sw-register.js';
import { UpdateToast } from './UpdateToast.js';
import { PreviewToast } from './PreviewToast.js';
import { getDbName, isKillSwitch } from './deploy-namespace.js';
import { createFolderHost } from './folder-host.js';
import { LocalStorageAuthIndexStore } from './auth-index-store.js';
import { EncryptedTokenStore } from './token-store.js';

const dbName = getDbName(import.meta.env.BASE_URL);
const backend = new BrowserFsBackend(dbName);
// Folders on this device, where the browser can open them (REQ-WS-012).
const folderHost = createFolderHost(`${dbName}-folders`);
// Git token auths: tokens kept encrypted, the secret-free list in localStorage (REQ-AUTH-012, REQ-AUTH-019).
const gitAuths = new GitAuthRegistry({
  tokenStore: new EncryptedTokenStore(`${dbName}-auth`),
  indexStore: new LocalStorageAuthIndexStore(`${dbName}:auth-index`),
});

// Initialize the workspace structure (creates dirs if needed, no-ops if they exist)
void backend.initialize({ name: 'My Space' });

function Root() {
  const [showUpdateToast, setShowUpdateToast] = useState(false);

  const dismissToast = useCallback(() => setShowUpdateToast(false), []);

  useEffect(() => {
    // Check if we just reloaded after a SW update
    if (consumeUpdateFlag()) {
      setShowUpdateToast(true);
    }

    // `?no-sw` is the way out of a broken worker: remove it instead of registering it
    if (isKillSwitch(new URL(window.location.href))) {
      void unregisterServiceWorker(import.meta.env.BASE_URL);
      return;
    }

    // Register the service worker (import.meta.env.BASE_URL includes trailing slash)
    void registerServiceWorker(`${import.meta.env.BASE_URL}service-worker.js`);
  }, []);

  return (
    <StrictMode>
      <StorageProvider backend={backend}>
        <FolderHostProvider host={folderHost}>
          <GitAuthsProvider auths={gitAuths}>
            <App />
          </GitAuthsProvider>
        </FolderHostProvider>
      </StorageProvider>
      <UpdateToast version={__APP_VERSION__} visible={showUpdateToast} onDismiss={dismissToast} />
      <PreviewToast
        prNumber={__PR_NUMBER__}
        repoUrl={__REPO_URL__}
        productionUrl={__PRODUCTION_URL__}
      />
    </StrictMode>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<Root />);
}
