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
            <div>
              <h2 className="text-2xl font-bold mb-4">Welcome to Cept</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                This is a demo workspace running in your browser. All data is stored in IndexedDB.
              </p>
              <div className="prose dark:prose-invert max-w-none">
                <h3>Getting Started</h3>
                <p>
                  Cept is a fully-featured Notion clone that works offline. You can create pages,
                  databases, and templates — all stored locally in your browser.
                </p>
                <h3>Sample Content</h3>
                <ul>
                  <li>Try creating a new page with the sidebar</li>
                  <li>Use slash commands (/) to insert different block types</li>
                  <li>Create a database to organize your data</li>
                  <li>Explore the knowledge graph to see connections</li>
                </ul>
              </div>
            </div>
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
