import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return (
    <div>
      <h1>Cept</h1>
      <p>Loading...</p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
