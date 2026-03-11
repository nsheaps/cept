import { StrictMode, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { App, StorageProvider } from '@cept/ui';
import { BrowserFsBackend } from '@cept/core';
import '@cept/ui/styles/globals.css';
import { registerServiceWorker, consumeUpdateFlag } from './sw-register.js';
import { UpdateToast } from './UpdateToast.js';
import { getDbName } from './deploy-namespace.js';

const backend = new BrowserFsBackend(getDbName(import.meta.env.BASE_URL));

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
    void registerServiceWorker(
      `${import.meta.env.BASE_URL}service-worker.js`,
    );
  }, []);

  return (
    <StrictMode>
      <StorageProvider backend={backend}>
        <App />
      </StorageProvider>
      <UpdateToast
        version={__APP_VERSION__}
        visible={showUpdateToast}
        onDismiss={dismissToast}
      />
    </StrictMode>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<Root />);
}
