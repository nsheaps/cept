import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@cept/ui';
import '@cept/ui/styles/globals.css';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
