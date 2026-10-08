// Buffer polyfill — isomorphic-git requires Node's Buffer global in the browser
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { StrictMode, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { App, FolderHostProvider, StorageProvider } from '@cept/ui';
import { BrowserFsBackend } from '@cept/core';
import '@cept/ui/styles/globals.css';
import { registerServiceWorker, consumeUpdateFlag } from './sw-register.js';
import { UpdateToast } from './UpdateToast.js';
import { PreviewToast } from './PreviewToast.js';
import { getDbName } from './deploy-namespace.js';
import { createFolderHost } from './folder-host.js';

const dbName = getDbName(import.meta.env.BASE_URL);
const backend = new BrowserFsBackend(dbName);
// Folders on this device, where the browser can open them (REQ-WS-012).
const folderHost = createFolderHost(`${dbName}-folders`);

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

    // Register the service worker (import.meta.env.BASE_URL includes trailing slash)
    void registerServiceWorker(`${import.meta.env.BASE_URL}service-worker.js`);
  }, []);

  return (
    <StrictMode>
      <StorageProvider backend={backend}>
        <FolderHostProvider host={folderHost}>
          <App />
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
