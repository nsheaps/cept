import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CeptEditor } from './editor/CeptEditor.js';
import { Sidebar } from './sidebar/Sidebar.js';
import type { SidebarPageRef } from './sidebar/Sidebar.js';
import type { PageTreeNode } from './sidebar/PageTreeItem.js';
import { expandToNode, getBreadcrumbs, renameNode, removeNode, moveNode, findNode, addChild, findAncestorIds } from './sidebar/page-tree-utils.js';
import { Breadcrumbs } from './topbar/Breadcrumbs.js';
import { CommandPalette } from './command-palette/CommandPalette.js';
import type { CommandItem } from './command-palette/CommandPalette.js';
import { SearchPanel } from './search/SearchPanel.js';
import type { SearchResult } from './search/SearchPanel.js';
import { PageHeader } from './page-header/PageHeader.js';
import { SettingsModal, loadSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from './settings/SettingsModal.js';
import type { CeptSettings, SpaceInfo } from './settings/SettingsModal.js';
import { DOCS_PAGES, DOCS_CONTENT, DOCS_SPACE_INFO } from './docs/docs-content.js';

interface AppProps {
  // No props needed — demo mode is controlled by settings
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

const MAX_RECENT = 10;
const STORAGE_KEY = 'cept-workspace';

interface PersistedState {
  pages: PageTreeNode[];
  pageContents: Record<string, string>;
  favorites: SidebarPageRef[];
  recentPages: SidebarPageRef[];
  selectedPageId?: string;
  spaceName?: string;
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function savePersistedState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function flattenPages(nodes: PageTreeNode[]): SidebarPageRef[] {
  const result: SidebarPageRef[] = [];
  for (const n of nodes) {
    result.push({ id: n.id, title: n.title, icon: n.icon });
    if (n.children.length > 0) {
      result.push(...flattenPages(n.children));
    }
  }
  return result;
}

/**
 * Root application component.
 * Renders the main Cept workspace UI.
 */
export function App(_props?: AppProps) {
  // Load persisted state and settings once
  const persisted = useMemo(() => loadPersistedState(), []);
  const initialSettings = useMemo(() => loadSettings(), []);

  // Demo mode: determined by showDemoContent setting (auto-detected on nsheaps.github.io)
  const shouldShowDemo = initialSettings.showDemoContent;
  const hasPersisted = !!persisted;

  const [pages, setPages] = useState<PageTreeNode[]>(
    persisted?.pages ?? (shouldShowDemo ? DEMO_PAGES : []),
  );
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(
    persisted?.selectedPageId ?? (shouldShowDemo ? 'welcome' : undefined),
  );
  const [pageContents, setPageContents] = useState<Record<string, string>>(
    persisted?.pageContents ?? (shouldShowDemo ? { welcome: DEMO_CONTENT, 'getting-started': DEMO_GETTING_STARTED_CONTENT, features: DEMO_FEATURES_CONTENT, notes: '' } : {}),
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(shouldShowDemo || hasPersisted);

  // Space name — persisted, with sensible default
  const defaultSpaceName = shouldShowDemo && !hasPersisted ? 'Demo Space' : 'My Space';
  const [spaceName, setSpaceName] = useState<string>(persisted?.spaceName ?? defaultSpaceName);

  // Trash state
  const [trash, setTrash] = useState<SidebarPageRef[]>(hasPersisted ? [] : []);

  // Favorites state
  const [favorites, setFavorites] = useState<SidebarPageRef[]>(persisted?.favorites ?? []);

  // Recent pages state
  const [recentPages, setRecentPages] = useState<SidebarPageRef[]>(persisted?.recentPages ?? []);

  // Settings state
  const [settings, setSettings] = useState<CeptSettings>(() => initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'about' | 'data' | 'spaces'>('settings');

  // Active space: 'user' (default) or 'docs' (built-in read-only)
  const [activeSpace, setActiveSpace] = useState<'user' | 'docs'>('user');
  const [docsSelectedPageId, setDocsSelectedPageId] = useState<string | undefined>('docs-index');
  const [docsPages, setDocsPages] = useState<PageTreeNode[]>(DOCS_PAGES);

  // Track content save timeout
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Persist state to localStorage (debounced)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      savePersistedState({ pages, pageContents, favorites, recentPages, selectedPageId, spaceName });
    }, 300);
  }, [pages, pageContents, favorites, recentPages, selectedPageId, spaceName]);

  const breadcrumbItems = useMemo(() => {
    if (!selectedPageId) return [];
    return getBreadcrumbs(pages, selectedPageId) ?? [];
  }, [pages, selectedPageId]);

  const addToRecent = useCallback((id: string, title: string, icon?: string) => {
    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return [{ id, title, icon }, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  const handlePageSelect = useCallback((id: string) => {
    setSelectedPageId(id);
    setPages((prev) => expandToNode(prev, id));
    const node = findNode(pages, id);
    if (node) {
      addToRecent(id, node.title, node.icon);
    }
    // Close sidebar on narrow screens after selecting a page
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [pages, addToRecent]);

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
    setPageContents((prev) => ({ ...prev, [newPage.id]: '' }));
    setSelectedPageId(newPage.id);
    if (!hasStarted) setHasStarted(true);
  }, [hasStarted]);

  const handlePageRename = useCallback((id: string, title: string) => {
    setPages((prev) => renameNode(prev, id, title));
    // Update recent/favorites references
    setRecentPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    setFavorites((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
  }, []);

  const handlePageDelete = useCallback((id: string) => {
    const node = findNode(pages, id);
    if (node) {
      setTrash((prev) => [...prev, { id: node.id, title: node.title, icon: node.icon }]);
    }
    setPages((prev) => {
      const { tree } = removeNode(prev, id);
      return tree;
    });
    setSelectedPageId((prev) => (prev === id ? undefined : prev));
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    setRecentPages((prev) => prev.filter((r) => r.id !== id));
  }, [pages]);

  const handleRestoreFromTrash = useCallback((id: string) => {
    const item = trash.find((t) => t.id === id);
    if (!item) return;
    setTrash((prev) => prev.filter((t) => t.id !== id));
    const restoredPage: PageTreeNode = {
      id: item.id,
      title: item.title,
      icon: item.icon,
      children: [],
    };
    setPages((prev) => [...prev, restoredPage]);
  }, [trash]);

  const handlePermanentDelete = useCallback((id: string) => {
    setTrash((prev) => prev.filter((t) => t.id !== id));
    setPageContents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleEmptyTrash = useCallback(() => {
    setTrash((prev) => {
      for (const item of prev) {
        setPageContents((pc) => {
          const next = { ...pc };
          delete next[item.id];
          return next;
        });
      }
      return [];
    });
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.id === id);
      if (exists) {
        return prev.filter((f) => f.id !== id);
      }
      const node = findNode(pages, id);
      if (!node) return prev;
      return [...prev, { id: node.id, title: node.title, icon: node.icon }];
    });
  }, [pages]);

  const handlePageDuplicate = useCallback((id: string) => {
    setPages((prev) => {
      const original = findNode(prev, id);
      if (!original) return prev;
      const duplicateId = `page-${Date.now()}`;
      const duplicate: PageTreeNode = {
        ...structuredClone(original),
        id: duplicateId,
        title: `${original.title} (copy)`,
      };
      // Copy content
      setPageContents((pc) => ({ ...pc, [duplicateId]: pc[id] ?? '' }));
      const ancestors = findAncestorIds(prev, id);
      if (!ancestors || ancestors.length === 0) {
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

  const handleContentUpdate = useCallback((html: string) => {
    if (!selectedPageId) return;
    setPageContents((prev) => ({ ...prev, [selectedPageId]: html }));

    // Debounced save indication (for future persistence)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      // Future: backend.writeFile(...)
    }, 500);
  }, [selectedPageId]);

  const handleSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    const q = query.toLowerCase();
    if (!q) return [];
    const allPages = flattenPages(pages);
    const results: SearchResult[] = [];
    for (const page of allPages) {
      const content = pageContents[page.id] ?? '';
      const titleMatch = page.title.toLowerCase().includes(q);
      const contentText = content.replace(/<[^>]+>/g, '');
      const contentMatch = contentText.toLowerCase().includes(q);
      if (titleMatch || contentMatch) {
        let snippet = '';
        if (contentMatch) {
          const idx = contentText.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(contentText.length, idx + q.length + 40);
          snippet = (start > 0 ? '...' : '') + contentText.slice(start, end) + (end < contentText.length ? '...' : '');
        }
        results.push({
          pageId: page.id,
          title: page.title,
          snippet,
          path: page.title,
          score: titleMatch ? 2 : 1,
          matchType: titleMatch ? 'title' : 'content',
        });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  }, [pages, pageContents]);

  const handleStartWriting = useCallback(() => {
    setHasStarted(true);
    const firstPage: PageTreeNode = {
      id: `page-${Date.now()}`,
      title: 'Welcome',
      icon: '\u{1F44B}',
      children: [],
    };
    setPages([firstPage]);
    setPageContents({ [firstPage.id]: '<h1>Welcome to Cept</h1><p>Start typing here...</p>' });
    setSelectedPageId(firstPage.id);
  }, []);

  const handleResetDemo = useCallback(() => {
    // Always recreate — if space was renamed, this creates what is effectively a duplicate
    setPages(DEMO_PAGES);
    setPageContents({ welcome: DEMO_CONTENT, 'getting-started': DEMO_GETTING_STARTED_CONTENT, features: DEMO_FEATURES_CONTENT, notes: '' });
    setSelectedPageId('welcome');
    setFavorites([]);
    setRecentPages([]);
    setTrash([]);
    setSpaceName('Demo Space');
    setHasStarted(true);
  }, []);

  const handleClearAllData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    resetSettings();
    setSettings({ ...DEFAULT_SETTINGS });
    setPages([]);
    setPageContents({});
    setSelectedPageId(undefined);
    setFavorites([]);
    setRecentPages([]);
    setTrash([]);
    setSpaceName('My Space');
    setHasStarted(false);
    setSettingsOpen(false);
  }, []);

  const handleSettingsChange = useCallback((updated: CeptSettings) => {
    setSettings(updated);
    saveSettings(updated);
  }, []);

  const handleResetSettings = useCallback(() => {
    resetSettings();
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const handleSpaceRename = useCallback((id: string, name: string) => {
    if (id === 'default') {
      setSpaceName(name);
    }
  }, []);

  const handleDeleteSpace = useCallback((_id: string) => {
    // Currently only one space — delete it
    setPages([]);
    setPageContents({});
    setSelectedPageId(undefined);
    setFavorites([]);
    setRecentPages([]);
    setTrash([]);
    setHasStarted(false);
  }, []);

  const handleOpenSettings = useCallback((tab: 'settings' | 'about' | 'data' | 'spaces' = 'settings') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const handleOpenDocs = useCallback(() => {
    setActiveSpace('docs');
    setDocsSelectedPageId('docs-index');
    setDocsPages(DOCS_PAGES);
  }, []);

  const handleBackToUserSpace = useCallback(() => {
    setActiveSpace('user');
  }, []);

  const handleDocsPageSelect = useCallback((id: string) => {
    setDocsSelectedPageId(id);
    setDocsPages((prev) => expandToNode(prev, id));
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handleDocsPageToggle = useCallback((id: string) => {
    setDocsPages((prev) => toggleNode(prev, id));
  }, []);

  const spaceInfoList = useMemo((): SpaceInfo[] => {
    const list: SpaceInfo[] = [];
    if (hasStarted || pages.length > 0) {
      const contentSize = Object.values(pageContents).reduce((sum, c) => sum + (c?.length ?? 0), 0);
      list.push({
        id: 'default',
        name: spaceName,
        source: 'Browser (localStorage)',
        pageCount: flattenPages(pages).length,
        contentSize,
      });
    }
    list.push(DOCS_SPACE_INFO);
    return list;
  }, [hasStarted, pages, pageContents, spaceName]);

  const commandItems: CommandItem[] = useMemo(() => [
    { id: 'new-page', title: 'New Page', icon: '\u{1F4C4}', category: 'Pages', action: () => handlePageAdd() },
    { id: 'search', title: 'Search', icon: '\u{1F50D}', category: 'Navigation', action: () => { setCommandPaletteOpen(false); setSearchOpen(true); } },
    { id: 'toggle-sidebar', title: 'Toggle Sidebar', icon: '\u{1F4CB}', category: 'View', action: () => { setSidebarOpen((p) => !p); setCommandPaletteOpen(false); } },
  ], [handlePageAdd]);

  const currentContent = selectedPageId ? (pageContents[selectedPageId] ?? '') : '';
  const selectedNode = selectedPageId ? findNode(pages, selectedPageId) : undefined;
  const showOnboarding = !hasStarted;

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
        <button
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setSidebarOpen((p) => !p)}
          data-testid="sidebar-toggle"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold">Cept</h1>
        {breadcrumbItems.length > 0 && (
          <Breadcrumbs items={breadcrumbItems} onNavigate={handlePageSelect} />
        )}
        <div className="ml-auto" />
      </header>
      <main className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <div className="cept-sidebar-backdrop" onClick={() => setSidebarOpen(false)} data-testid="sidebar-backdrop" />
        )}
        {sidebarOpen && activeSpace === 'user' && (
          <Sidebar
            pages={pages}
            favorites={favorites}
            recentPages={recentPages}
            trash={trash}
            selectedPageId={selectedPageId}
            onPageSelect={handlePageSelect}
            onPageToggle={handlePageToggle}
            onPageAdd={handlePageAdd}
            onPageRename={handlePageRename}
            onPageDuplicate={handlePageDuplicate}
            onPageDelete={handlePageDelete}
            onPageMoveToRoot={handlePageMoveToRoot}
            onToggleFavorite={handleToggleFavorite}
            onRestoreFromTrash={handleRestoreFromTrash}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
            onSearch={() => setSearchOpen(true)}
            onOpenSettings={handleOpenSettings}
            onOpenDocs={handleOpenDocs}
            spaceName={spaceName}
          />
        )}
        {sidebarOpen && activeSpace === 'docs' && (
          <Sidebar
            pages={docsPages}
            favorites={[]}
            recentPages={[]}
            trash={[]}
            selectedPageId={docsSelectedPageId}
            onPageSelect={handleDocsPageSelect}
            onPageToggle={handleDocsPageToggle}
            onPageAdd={() => {/* read-only */}}
            onPageRename={() => {/* read-only */}}
            onPageDuplicate={() => {/* read-only */}}
            onPageDelete={() => {/* read-only */}}
            onPageMoveToRoot={() => {/* read-only */}}
            onToggleFavorite={() => {/* read-only */}}
            onRestoreFromTrash={() => {/* read-only */}}
            onPermanentDelete={() => {/* read-only */}}
            onEmptyTrash={() => {/* read-only */}}
            onSearch={() => setSearchOpen(true)}
            readOnly
            spaceName="Cept Docs"
            onBackToSpace={handleBackToUserSpace}
          />
        )}
        <section className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
          {activeSpace === 'docs' ? (
            docsSelectedPageId && DOCS_CONTENT[docsSelectedPageId] ? (
              <>
                <div className="cept-docs-banner" data-testid="docs-banner">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="1" width="12" height="14" rx="1" />
                    <path d="M5 5h6M5 8h6M5 11h3" />
                  </svg>
                  <span>Read-only — sourced from <code>docs/</code> in the Git repository</span>
                  <button className="cept-docs-banner-back" onClick={handleBackToUserSpace} data-testid="docs-back-to-space">
                    Back to my space
                  </button>
                </div>
                <CeptEditor
                  key={docsSelectedPageId}
                  content={DOCS_CONTENT[docsSelectedPageId]}
                  placeholder=""
                  onUpdate={() => {/* read-only */}}
                  editable={false}
                />
              </>
            ) : (
              <div className="text-center text-gray-400 mt-20">
                <p>Select a documentation page from the sidebar</p>
              </div>
            )
          ) : showOnboarding ? (
            <div className="max-w-lg mx-auto mt-12">
              <h2 className="text-2xl font-bold mb-4">Get Started</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Choose how to store your space:
              </p>
              <div className="mt-4 space-y-3">
                <button
                  onClick={handleStartWriting}
                  className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
                  data-testid="start-writing"
                >
                  <strong>Start writing</strong>
                  <span className="block text-sm text-gray-500">
                    Browser storage — zero setup, works immediately
                  </span>
                </button>
                <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors opacity-50 cursor-not-allowed" disabled>
                  <strong>Open a folder</strong>
                  <span className="block text-sm text-gray-500">
                    Local filesystem ��� coming soon
                  </span>
                </button>
                <button className="block w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors opacity-50 cursor-not-allowed" disabled>
                  <strong>Connect a Git repo</strong>
                  <span className="block text-sm text-gray-500">
                    Version history, collaboration — coming soon
                  </span>
                </button>
              </div>
            </div>
          ) : selectedPageId && selectedNode ? (
            <>
              <PageHeader
                pageId={selectedPageId}
                title={selectedNode.title}
                icon={selectedNode.icon}
                isFavorite={favorites.some((f) => f.id === selectedPageId)}
                onRename={handlePageRename}
                onDuplicate={handlePageDuplicate}
                onDelete={handlePageDelete}
                onToggleFavorite={handleToggleFavorite}
              />
              <CeptEditor
                key={selectedPageId}
                content={currentContent}
                placeholder="Type '/' for commands..."
                onUpdate={handleContentUpdate}
              />
            </>
          ) : (
            <div className="text-center text-gray-400 mt-20">
              <p>Select a page or create a new one</p>
            </div>
          )}
        </section>
      </main>
      <CommandPalette
        isOpen={commandPaletteOpen}
        items={commandItems}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <SearchPanel
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={handleSearch}
        onResultSelect={(pageId) => { handlePageSelect(pageId); setSearchOpen(false); }}
      />
      <SettingsModal
        isOpen={settingsOpen}
        initialTab={settingsTab}
        settings={settings}
        spaces={spaceInfoList}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
        onResetSettings={handleResetSettings}
        onDeleteSpace={handleDeleteSpace}
        onSpaceRename={handleSpaceRename}
        onClearAllData={handleClearAllData}
        onRecreateDemoSpace={handleResetDemo}
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
<p>This is a demo space running in your browser. All data is stored locally.</p>
<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>Type <code>/</code> anywhere to see all available block types. Try it now!</p></div>
<h2>Getting Started</h2>
<p>Cept is a fully-featured Notion clone that works offline. You can create pages, databases, and templates \u2014 all stored locally in your browser.</p>
<h3>Try These Features</h3>
<ul>
  <li><p>Type text to create paragraphs</p></li>
  <li><p>Use <strong>bold</strong>, <em>italic</em>, and <s>strikethrough</s></p></li>
  <li><p>Create nested lists by pressing Tab</p></li>
</ul>
<ol>
  <li><p>Numbered lists work too</p></li>
  <li><p>Just like you\u2019d expect</p></li>
</ol>
<p>Start typing below to try the editor...</p>
`;

const DEMO_FEATURES_CONTENT = `
<h1>Block Types</h1>
<p>Cept supports a wide variety of content blocks. Type <code>/</code> in the editor to insert any of these.</p>

<h2>Text Blocks</h2>
<h3>Headings</h3>
<p>Three levels of headings are available: H1, H2, and H3.</p>

<h3>Code Block</h3>
<pre><code class="language-javascript">function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));</code></pre>

<h3>Blockquote</h3>
<blockquote><p>The best way to predict the future is to invent it. \u2014 Alan Kay</p></blockquote>

<h3>Divider</h3>
<p>A horizontal rule separates sections:</p>
<hr>

<h2>Lists</h2>
<h3>Bullet List</h3>
<ul>
  <li><p>First item</p></li>
  <li><p>Second item</p></li>
  <li><p>Third item</p></li>
</ul>

<h3>Numbered List</h3>
<ol>
  <li><p>Step one</p></li>
  <li><p>Step two</p></li>
  <li><p>Step three</p></li>
</ol>

<h3>Task List</h3>
<ul data-type="taskList">
  <li data-type="taskItem" data-checked="true"><p>Completed task</p></li>
  <li data-type="taskItem" data-checked="false"><p>Pending task</p></li>
  <li data-type="taskItem" data-checked="false"><p>Another pending task</p></li>
</ul>

<h2>Blocks</h2>
<h3>Callout</h3>
<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>This is an informational callout. Use it to highlight important notes.</p></div>

<h3>Toggle</h3>
<details data-type="toggle"><summary>Click to expand</summary><div><p>This content is hidden by default and revealed when you click the toggle.</p></div></details>

<h2>Media</h2>
<h3>Image</h3>
<p>Use <code>/image</code> to insert an image from a URL.</p>

<h3>Embed</h3>
<p>Use <code>/embed</code> to embed YouTube, Vimeo, and other media.</p>

<h3>Bookmark</h3>
<p>Use <code>/bookmark</code> to create a rich link preview card.</p>

<h2>Layout</h2>
<h3>Columns</h3>
<div data-type="columns" data-columns="2"><div data-type="column"><p><strong>Left column</strong></p><p>Content in the left side of a two-column layout.</p></div><div data-type="column"><p><strong>Right column</strong></p><p>Content in the right side of a two-column layout.</p></div></div>

<h2>Advanced</h2>
<h3>Math Equation</h3>
<div data-type="math-block" data-math="E = mc^2"></div>
<p>Inline math is also supported: The formula <span data-type="inline-math" data-math="a^2 + b^2 = c^2"></span> is the Pythagorean theorem.</p>

<h3>Mermaid Diagram</h3>
<div data-type="mermaid" data-mermaid="graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[OK]\n  B -->|No| D[Cancel]"></div>
`;

const DEMO_GETTING_STARTED_CONTENT = `
<h1>Getting Started</h1>
<p>Welcome to Cept! Here\u2019s how to get started with your space.</p>

<h2>Creating Pages</h2>
<p>Click the <strong>+</strong> button in the sidebar to create a new page. Pages can be nested inside other pages to create a hierarchy.</p>

<h2>Using the Editor</h2>
<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>Type <code>/</code> to open the slash command menu. You can search for any block type by name.</p></div>

<h2>Keyboard Shortcuts</h2>
<ul>
  <li><p><strong>Cmd/Ctrl + K</strong> \u2014 Open command palette</p></li>
  <li><p><strong>Cmd/Ctrl + B</strong> \u2014 Bold text</p></li>
  <li><p><strong>Cmd/Ctrl + I</strong> \u2014 Italic text</p></li>
  <li><p><strong>Cmd/Ctrl + U</strong> \u2014 Underline text</p></li>
  <li><p><strong>Cmd/Ctrl + Shift + S</strong> \u2014 Strikethrough</p></li>
</ul>

<h2>Organizing Your Space</h2>
<ol>
  <li><p><strong>Favorites</strong> \u2014 Right-click a page and add it to favorites for quick access</p></li>
  <li><p><strong>Nested pages</strong> \u2014 Click the + on a page to create a sub-page</p></li>
  <li><p><strong>Trash</strong> \u2014 Deleted pages go to trash and can be restored</p></li>
</ol>
`;
