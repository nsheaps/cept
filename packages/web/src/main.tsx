import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { App, StorageProvider } from '@cept/ui';
import { BrowserFsBackend } from '@cept/core';
import '@cept/ui/styles/globals.css';

const backend = new BrowserFsBackend('cept-workspace');

// Initialize the workspace structure (creates dirs if needed, no-ops if they exist)
void backend.initialize({ name: 'My Space' });

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <StorageProvider backend={backend}>
        <App />
      </StorageProvider>
    </StrictMode>,
  );
}
