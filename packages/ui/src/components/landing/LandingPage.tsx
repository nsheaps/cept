/**
 * LandingPage — The first screen users see when visiting Cept on GitHub Pages.
 *
 * Provides an overview of what Cept is, links to documentation,
 * and actions to start writing or try the demo.
 */

export interface LandingPageProps {
  onStartWriting: () => void;
  onTryDemo: () => void;
  onOpenDocs: () => void;
}

export function LandingPage({ onStartWriting, onTryDemo, onOpenDocs }: LandingPageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12" data-testid="landing-page">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Cept</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          An open-source Notion alternative that runs entirely in your browser.
        </p>
        <p className="text-gray-500 dark:text-gray-500 mt-2">
          Privacy-first. Offline-first. No account required.
        </p>
      </div>

      {/* Primary actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
        <button
          onClick={onStartWriting}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          data-testid="start-writing"
        >
          Start writing
        </button>
        <button
          onClick={onTryDemo}
          className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 font-medium hover:border-blue-500 transition-colors"
          data-testid="try-demo"
        >
          Try the demo
        </button>
      </div>

      {/* Feature grid */}
      <div className="grid sm:grid-cols-2 gap-6 mb-12" data-testid="feature-grid">
        <FeatureCard
          title="Rich Block Editor"
          description="20+ block types including code, math, diagrams, callouts, toggles, tables, and columns. Use / to insert any block."
        />
        <FeatureCard
          title="Works Offline"
          description="Everything runs in your browser. Your data is stored locally in IndexedDB. No server, no account, no internet required."
        />
        <FeatureCard
          title="Multiple Storage Backends"
          description="Start in the browser, then connect a local folder or Git repository for versioning, sync, and collaboration."
        />
        <FeatureCard
          title="Open Source"
          description="MIT licensed. Your data is plain Markdown and YAML. No vendor lock-in. Fork it, self-host it, extend it."
        />
      </div>

      {/* What is the demo? */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-8" data-testid="demo-info">
        <h2 className="text-lg font-semibold mb-2">What is the demo?</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-3">
          The demo creates a pre-populated workspace with sample pages showing off
          all of Cept&apos;s features. You can edit, delete, or add pages freely.
          Everything is stored in your browser and never sent to a server.
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          You can reset the demo at any time from Settings, or clear all data
          and start fresh.
        </p>
      </div>

      {/* Getting started links */}
      <div className="space-y-4 mb-12">
        <h2 className="text-lg font-semibold">Learn more</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <LinkCard
            title="What is Cept?"
            description="Architecture, philosophy, and how it compares to Notion and Obsidian."
            onClick={onOpenDocs}
            testId="link-what-is"
          />
          <LinkCard
            title="Getting Started"
            description="Quick start guide, keyboard shortcuts, and feature overview."
            onClick={onOpenDocs}
            testId="link-getting-started"
          />
        </div>
      </div>

      {/* Storage options */}
      <div className="space-y-3" data-testid="storage-options">
        <h2 className="text-lg font-semibold">Storage options</h2>
        <div className="space-y-2">
          <button
            onClick={onStartWriting}
            className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
          >
            <strong>Browser storage</strong>
            <span className="block text-sm text-gray-500">
              IndexedDB — zero setup, works immediately, data stays on your device
            </span>
          </button>
          <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed" disabled>
            <strong>Local folder</strong>
            <span className="block text-sm text-gray-500">
              Plain Markdown files on your filesystem — coming soon
            </span>
          </button>
          <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed" disabled>
            <strong>Git repository</strong>
            <span className="block text-sm text-gray-500">
              Version history, sync, and collaboration via any Git host — coming soon
            </span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
        <a
          href="https://github.com/nsheaps/cept"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-500 transition-colors"
        >
          View on GitHub
        </a>
        <span className="mx-2">·</span>
        <span>MIT License</span>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

function LinkCard({ title, description, onClick, testId }: { title: string; description: string; onClick: () => void; testId: string }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
      data-testid={testId}
    >
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </button>
  );
}
