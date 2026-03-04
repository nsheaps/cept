import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@cept/ui';
import '@cept/ui/styles/globals.css';

const demoMode = import.meta.env.CEPT_DEMO_MODE === true ||
  new URLSearchParams(window.location.search).has('demo');

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <App demoMode={demoMode} />
    </StrictMode>,
  );
}
