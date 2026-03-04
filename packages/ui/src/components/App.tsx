import { CeptEditor } from './editor/CeptEditor.js';

interface AppProps {
  demoMode?: boolean;
}

/**
 * Root application component.
 * Renders the main Cept workspace UI.
 */
export function App({ demoMode }: AppProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <h1 className="text-xl font-semibold">Cept</h1>
      </header>
      <main className="flex">
        <aside className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500">Sidebar (coming soon)</p>
        </aside>
        <section className="flex-1 p-8">
          {demoMode ? (
            <CeptEditor
              content={DEMO_CONTENT}
              placeholder="Type '/' for commands..."
            />
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-4">Get Started</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Choose how to store your workspace:
              </p>
              <div className="mt-4 space-y-3">
                <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors">
                  <strong>Start writing</strong>
                  <span className="block text-sm text-gray-500">
                    Browser storage — zero setup, works immediately
                  </span>
                </button>
                <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors">
                  <strong>Open a folder</strong>
                  <span className="block text-sm text-gray-500">
                    Local filesystem — plain Markdown files
                  </span>
                </button>
                <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors">
                  <strong>Connect a Git repo</strong>
                  <span className="block text-sm text-gray-500">
                    Version history, collaboration, sync
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const DEMO_CONTENT = `
<h1>Welcome to Cept</h1>
<p>This is a demo workspace running in your browser. All data is stored in IndexedDB.</p>
<h2>Getting Started</h2>
<p>Cept is a fully-featured Notion clone that works offline. You can create pages, databases, and templates — all stored locally in your browser.</p>
<h3>Try These Features</h3>
<ul>
  <li>Type text to create paragraphs</li>
  <li>Use <strong>bold</strong>, <em>italic</em>, and <s>strikethrough</s></li>
  <li>Create nested lists by pressing Tab</li>
</ul>
<ol>
  <li>Numbered lists work too</li>
  <li>Just like you'd expect</li>
</ol>
<p>Start typing below to try the editor...</p>
`;
