import { useState, useCallback, useMemo, useEffect } from 'react';
import { CeptEditor } from './editor/CeptEditor.js';
import { Sidebar } from './sidebar/Sidebar.js';
import type { PageTreeNode } from './sidebar/PageTreeItem.js';
import { expandToNode, getBreadcrumbs, renameNode, removeNode, moveNode, findNode, addChild, findAncestorIds } from './sidebar/page-tree-utils.js';
import { Breadcrumbs } from './topbar/Breadcrumbs.js';
import { CommandPalette } from './command-palette/CommandPalette.js';
import type { CommandItem } from './command-palette/CommandPalette.js';

interface AppProps {
  demoMode?: boolean;
}

const DEMO_PAGES: PageTreeNode[] = [
  {
    id: 'welcome',
    title: 'Welcome to Cept',
    icon: '\u{1F44B}',
    isExpanded: true,
    children: [
      { id: 'getting-started', title: 'Getting Started', icon: '\u{1F680}', children: [] },
      { id: 'features', title: 'Features', icon: '\u2728', children: [] },
    ],
  },
  {
    id: 'notes',
    title: 'Notes',
    icon: '\u{1F4DD}',
    children: [],
  },
];

/**
 * Root application component.
 * Renders the main Cept workspace UI.
 */
export function App({ demoMode }: AppProps) {
  const [pages, setPages] = useState<PageTreeNode[]>(demoMode ? DEMO_PAGES : []);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(
    demoMode ? 'welcome' : undefined,
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const breadcrumbItems = useMemo(() => {
    if (!selectedPageId) return [];
    return getBreadcrumbs(pages, selectedPageId) ?? [];
  }, [pages, selectedPageId]);

  const handlePageSelect = useCallback((id: string) => {
    setSelectedPageId(id);
    setPages((prev) => expandToNode(prev, id));
  }, []);

  const handlePageToggle = useCallback((id: string) => {
    setPages((prev) => toggleNode(prev, id));
  }, []);

  const handlePageAdd = useCallback((parentId?: string) => {
    const newPage: PageTreeNode = {
      id: `page-${Date.now()}`,
      title: 'Untitled',
      children: [],
    };
    if (parentId) {
      setPages((prev) => addChild(prev, parentId, newPage));
    } else {
      setPages((prev) => [...prev, newPage]);
    }
    setSelectedPageId(newPage.id);
  }, []);

  const handlePageRename = useCallback((id: string, title: string) => {
    setPages((prev) => renameNode(prev, id, title));
  }, []);

  const handlePageDelete = useCallback((id: string) => {
    setPages((prev) => {
      const { tree } = removeNode(prev, id);
      return tree;
    });
    setSelectedPageId((prev) => (prev === id ? undefined : prev));
  }, []);

  const handlePageDuplicate = useCallback((id: string) => {
    setPages((prev) => {
      const original = findNode(prev, id);
      if (!original) return prev;
      const duplicate: PageTreeNode = {
        ...structuredClone(original),
        id: `page-${Date.now()}`,
        title: `${original.title} (copy)`,
      };
      // Insert after the original at the same level
      const ancestors = findAncestorIds(prev, id);
      if (!ancestors || ancestors.length === 0) {
        // Root level
        const idx = prev.findIndex((n) => n.id === id);
        const result = [...prev];
        result.splice(idx + 1, 0, duplicate);
        return result;
      }
      const parentId = ancestors[ancestors.length - 1];
      return addChild(prev, parentId, duplicate);
    });
  }, []);

  const handlePageMoveToRoot = useCallback((id: string) => {
    setPages((prev) => moveNode(prev, id, undefined));
  }, []);

  const commandItems: CommandItem[] = useMemo(() => [
    { id: 'new-page', title: 'New Page', icon: '\u{1F4C4}', category: 'Pages', action: () => handlePageAdd() },
    { id: 'search', title: 'Search', icon: '\u{1F50D}', category: 'Navigation', action: () => {} },
  ], [handlePageAdd]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
        <h1 className="text-xl font-semibold">Cept</h1>
        {breadcrumbItems.length > 0 && (
          <Breadcrumbs items={breadcrumbItems} onNavigate={handlePageSelect} />
        )}
      </header>
      <main className="flex" style={{ height: 'calc(100vh - 49px)' }}>
        <Sidebar
          pages={pages}
          selectedPageId={selectedPageId}
          onPageSelect={handlePageSelect}
          onPageToggle={handlePageToggle}
          onPageAdd={handlePageAdd}
          onPageRename={handlePageRename}
          onPageDuplicate={handlePageDuplicate}
          onPageDelete={handlePageDelete}
          onPageMoveToRoot={handlePageMoveToRoot}
        />
        <section className="flex-1 p-8 overflow-y-auto">
          {demoMode || selectedPageId ? (
            <CeptEditor
              content={demoMode ? DEMO_CONTENT : ''}
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
      <CommandPalette
        isOpen={commandPaletteOpen}
        items={commandItems}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

function toggleNode(nodes: PageTreeNode[], id: string): PageTreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children.length > 0) {
      return { ...node, children: toggleNode(node.children, id) };
    }
    return node;
  });
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
