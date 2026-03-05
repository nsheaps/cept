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
import { SettingsModal, DEFAULT_SETTINGS } from './settings/SettingsModal.js';
import type { CeptSettings, SpaceInfo } from './settings/SettingsModal.js';
import { DOCS_PAGES, DOCS_CONTENT, DOCS_SPACE_INFO, getDocsSourceUrl } from './docs/docs-content.js';
import {
  useStorage,
  useWorkspacePersistence,
  saveSettingsToBackend,
  resetSettingsOnBackend,
  clearAllData,
  readPageContent,
  writePageContent,
  deletePageContent,
} from './storage/StorageContext.js';
import { LandingPage } from './landing/LandingPage.js';
import { AppMenu } from './app-menu/AppMenu.js';
import { FolderView } from './editor/FolderView.js';
import { ImportDialog } from './import-export/ImportDialog.js';
import type { ImportSource } from './import-export/ImportDialog.js';
import { ExportDialog } from './import-export/ExportDialog.js';
import { CeptSearchIndex } from '@cept/core';
import type { ImportedPage, PageContent } from '@cept/core';
import { createSpace as createSpaceInBackend, switchSpace as switchSpaceInBackend, deleteSpace as deleteSpaceInBackend, renameSpace as renameSpaceInBackend, loadSpaces } from './storage/SpaceManager.js';
import { restoreRoute, replaceRoute, pushRoute, parseRoute } from '../router.js';


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
export function App() {
  const backend = useStorage();
  const { state: persisted, settings: initialSettings, ready, save } = useWorkspacePersistence(backend);

  // Demo mode: determined by showDemoContent setting (auto-detected on nsheaps.github.io)
  const shouldShowDemo = initialSettings.showDemoContent;

  const [pages, setPages] = useState<PageTreeNode[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>(undefined);
  const [pageContents, setPageContents] = useState<Record<string, string>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [spaceName, setSpaceName] = useState<string>('My Space');
  const [trash, setTrash] = useState<SidebarPageRef[]>([]);
  const [favorites, setFavorites] = useState<SidebarPageRef[]>([]);
  const [recentPages, setRecentPages] = useState<SidebarPageRef[]>([]);
  const [settings, setSettings] = useState<CeptSettings>({ ...DEFAULT_SETTINGS });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'about' | 'data' | 'spaces'>('settings');
  const [activeSpace, setActiveSpace] = useState<'user' | 'docs'>('user');
  const [docsSelectedPageId, setDocsSelectedPageId] = useState<string | undefined>('docs-index');
  const [docsPages, setDocsPages] = useState<PageTreeNode[]>(DOCS_PAGES);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>('notion');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [userSpaceId, setUserSpaceId] = useState('default');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchIndexRef = useRef(new CeptSearchIndex());

  // Apply loaded state once backend is ready
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!ready || initializedRef.current) return;
    initializedRef.current = true;

    setSettings(initialSettings);

    if (persisted) {
      setPages(persisted.pages);
      setSelectedPageId(persisted.selectedPageId);
      setFavorites(persisted.favorites ?? []);
      setRecentPages(persisted.recentPages ?? []);
      setSpaceName(persisted.spaceName ?? 'My Space');
      setHasStarted(true);
      setTrash([]);
      // Load selected page content from backend
      if (persisted.selectedPageId) {
        void readPageContent(backend, persisted.selectedPageId).then((content) => {
          if (content !== null) {
            setPageContents((prev) => ({ ...prev, [persisted.selectedPageId!]: content }));
          }
        });
      }
    } else if (shouldShowDemo) {
      setPages(DEMO_PAGES);
      setSelectedPageId('welcome');
      const demoContents: Record<string, string> = { welcome: DEMO_CONTENT, 'getting-started': DEMO_GETTING_STARTED_CONTENT, features: DEMO_FEATURES_CONTENT, notes: '' };
      setPageContents(demoContents);
      setSpaceName('Demo Space');
      setHasStarted(true);
      // Write demo content to individual files
      void Promise.all(Object.entries(demoContents).map(([id, html]) => writePageContent(backend, id, html)));
    }
  }, [ready, persisted, initialSettings, shouldShowDemo, backend]);

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


  // Deep linking: restore route from URL on load (handles 404 redirect + legacy hash)
  // Runs exactly once after initialization has populated pages.
  const routeRestoredRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current || routeRestoredRef.current) return;
    // Wait until pages are actually populated (or we confirmed there are none)
    if (!hasStarted && !persisted) return;
    routeRestoredRef.current = true;

    const route = restoreRoute();
    if (route.space === 'docs') {
      setActiveSpace('docs');
      if (route.pageId) setDocsSelectedPageId(route.pageId);
    } else if (route.pageId) {
      const node = findNode(pages, route.pageId);
      if (node) {
        setSelectedPageId(route.pageId);
        setPages((prev) => expandToNode(prev, route.pageId!));
      }
      if (route.spaceId && route.spaceId !== 'default' && route.spaceId !== userSpaceId) {
        void switchSpaceInBackend(backend, route.spaceId).then(() => {
          setUserSpaceId(route.spaceId);
        });
      }
    }
  }, [hasStarted, pages, persisted, backend, userSpaceId]);

  // Deep linking: update URL when selected page or space changes.
  // Guarded: never fires during initial render or on the landing page.
  useEffect(() => {
    if (!initializedRef.current || !routeRestoredRef.current) return;
    if (!hasStarted) return;

    if (activeSpace === 'docs') {
      replaceRoute({ space: 'docs', pageId: docsSelectedPageId });
    } else if (selectedPageId) {
      replaceRoute({ space: 'user', spaceId: userSpaceId, pageId: selectedPageId });
    } else if (userSpaceId !== 'default') {
      replaceRoute({ space: 'user', spaceId: userSpaceId });
    } else {
      replaceRoute({ space: 'user', spaceId: 'default' });
    }
  }, [selectedPageId, activeSpace, userSpaceId, docsSelectedPageId, hasStarted]);

  // Listen for back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseRoute();
      if (route.space === 'docs') {
        setActiveSpace('docs');
        if (route.pageId) setDocsSelectedPageId(route.pageId);
      } else {
        setActiveSpace('user');
        if (route.pageId && route.pageId !== selectedPageId) {
          const node = findNode(pages, route.pageId);
          if (node) {
            setSelectedPageId(route.pageId);
            setPages((prev) => expandToNode(prev, route.pageId!));
          }
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedPageId, pages]);

  // Persist tree state to backend (debounced) — page content is saved separately per-file
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!initializedRef.current) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      save({ pages, favorites, recentPages, selectedPageId, spaceName });
    }, 300);
  }, [pages, favorites, recentPages, selectedPageId, spaceName, save]);

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
    setShowTrash(false);
    setPages((prev) => expandToNode(prev, id));
    const node = findNode(pages, id);
    if (node) {
      addToRecent(id, node.title, node.icon);
    }
    // Load page content from backend if not already cached
    if (!pageContents[id]) {
      void readPageContent(backend, id).then((content) => {
        if (content !== null) {
          setPageContents((prev) => ({ ...prev, [id]: content }));
        }
      });
    }
    // Close sidebar on narrow screens after selecting a page
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [pages, addToRecent, pageContents, backend]);

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
    void writePageContent(backend, newPage.id, '');
    if (!hasStarted) setHasStarted(true);
  }, [hasStarted, backend]);

  const handlePageRename = useCallback((id: string, title: string) => {
    setPages((prev) => renameNode(prev, id, title));
    // Update recent/favorites references
    setRecentPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    setFavorites((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
  }, []);

  const handlePageDelete = useCallback((id: string) => {
    const node = findNode(pages, id);
    if (node) {
      const ancestors = findAncestorIds(pages, id);
      const parentId = ancestors && ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
      setTrash((prev) => [...prev, { id: node.id, title: node.title, icon: node.icon, parentId }]);
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
    if (item.parentId && findNode(pages, item.parentId)) {
      setPages((prev) => addChild(prev, item.parentId!, restoredPage));
    } else {
      setPages((prev) => [...prev, restoredPage]);
    }
  }, [trash, pages]);

  const handlePermanentDelete = useCallback((id: string) => {
    setTrash((prev) => prev.filter((t) => t.id !== id));
    setPageContents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void deletePageContent(backend, id);
  }, [backend]);

  const handleEmptyTrash = useCallback(() => {
    setTrash((prev) => {
      for (const item of prev) {
        setPageContents((pc) => {
          const next = { ...pc };
          delete next[item.id];
          return next;
        });
        void deletePageContent(backend, item.id);
      }
      return [];
    });
  }, [backend]);

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
        id: duplicateId,
        title: `${original.title} (copy)`,
        icon: original.icon,
        cover: original.cover,
        children: [],
      };
      // Copy content only (not children)
      const content = pageContents[id] ?? '';
      setPageContents((pc) => ({ ...pc, [duplicateId]: content }));
      void writePageContent(backend, duplicateId, content);
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
  }, [pageContents, backend]);

  const handlePageMoveToRoot = useCallback((id: string) => {
    setPages((prev) => moveNode(prev, id, undefined));
  }, []);

  const handleContentUpdate = useCallback((html: string) => {
    if (!selectedPageId) return;
    setPageContents((prev) => ({ ...prev, [selectedPageId]: html }));

    // Debounced write to backend
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void writePageContent(backend, selectedPageId, html);
    }, 500);
  }, [selectedPageId, backend]);

  // Keep search index in sync with page content
  const indexedRef = useRef(new Set<string>());
  useEffect(() => {
    const idx = searchIndexRef.current;
    const allPages = flattenPages(pages);
    const currentIds = new Set(allPages.map((p) => p.id));

    // Index pages that have content
    for (const page of allPages) {
      const html = pageContents[page.id];
      if (html !== undefined) {
        const plainText = html.replace(/<[^>]+>/g, '');
        void idx.indexPage(page.id, page.title, plainText, page.title);
        indexedRef.current.add(page.id);
      }
    }

    // Remove pages that no longer exist
    for (const id of indexedRef.current) {
      if (!currentIds.has(id)) {
        void idx.removePage(id);
        indexedRef.current.delete(id);
      }
    }
  }, [pages, pageContents]);

  const handleSearch = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) return [];
    return searchIndexRef.current.search(query);
  }, []);

  const handleStartWriting = useCallback(() => {
    setHasStarted(true);
    const firstPage: PageTreeNode = {
      id: `page-${Date.now()}`,
      title: 'Welcome',
      icon: '\u{1F44B}',
      children: [],
    };
    const content = '<p>Start typing here...</p>';
    setPages([firstPage]);
    setPageContents({ [firstPage.id]: content });
    setSelectedPageId(firstPage.id);
    void writePageContent(backend, firstPage.id, content);
  }, [backend]);

  const handleResetDemo = useCallback(() => {
    // Always recreate — if space was renamed, this creates what is effectively a duplicate
    setPages(DEMO_PAGES);
    const demoContents: Record<string, string> = { welcome: DEMO_CONTENT, 'getting-started': DEMO_GETTING_STARTED_CONTENT, features: DEMO_FEATURES_CONTENT, notes: '' };
    setPageContents(demoContents);
    setSelectedPageId('welcome');
    setFavorites([]);
    setRecentPages([]);
    setTrash([]);
    setSpaceName('Demo Space');
    setHasStarted(true);
    void Promise.all(Object.entries(demoContents).map(([id, html]) => writePageContent(backend, id, html)));
  }, [backend]);

  const handleClearAllData = useCallback(() => {
    void clearAllData(backend);
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
  }, [backend]);

  const handleSettingsChange = useCallback((updated: CeptSettings) => {
    setSettings(updated);
    void saveSettingsToBackend(backend, updated);
  }, [backend]);

  const handleResetSettings = useCallback(() => {
    void resetSettingsOnBackend(backend);
    setSettings({ ...DEFAULT_SETTINGS });
  }, [backend]);

  const handleSpaceRename = useCallback((id: string, name: string) => {
    if (id === userSpaceId || id === 'default') {
      setSpaceName(name);
    }
    void renameSpaceInBackend(backend, id, name);
  }, [backend, userSpaceId]);

  const handleDeleteSpace = useCallback((id: string) => {
    void deleteSpaceInBackend(backend, id).then(() => {
      if (id === userSpaceId) {
        // Reload from the new active space
        void loadSpaces(backend).then((manifest) => {
          setUserSpaceId(manifest.activeSpaceId);
          // Reset to empty state — the new space will be loaded on next persist cycle
          setPages([]);
          setPageContents({});
          setSelectedPageId(undefined);
          setFavorites([]);
          setRecentPages([]);
          setTrash([]);
          setSpaceName(manifest.spaces[0]?.name ?? 'My Space');
        });
      }
    });
  }, [backend, userSpaceId]);

  const handleCreateSpace = useCallback((name: string) => {
    void createSpaceInBackend(backend, name).then((newSpace) => {
      setUserSpaceId(newSpace.id);
      setPages([]);
      setPageContents({});
      setSelectedPageId(undefined);
      setFavorites([]);
      setRecentPages([]);
      setTrash([]);
      setSpaceName(name);
      setHasStarted(true);
    });
  }, [backend]);

  const handleSwitchSpace = useCallback((id: string) => {
    void switchSpaceInBackend(backend, id).then(() => {
      setUserSpaceId(id);
      // For now, switching reloads — a full implementation would load from the space's stored state
      void loadSpaces(backend).then((manifest) => {
        const space = manifest.spaces.find((s) => s.id === id);
        if (space) {
          setSpaceName(space.name);
          setPages([]);
          setPageContents({});
          setSelectedPageId(undefined);
          setFavorites([]);
          setRecentPages([]);
          setTrash([]);
          setHasStarted(true);
        }
      });
    });
  }, [backend]);

  const handleImportComplete = useCallback((importedPages: ImportedPage[]) => {
    for (const page of importedPages) {
      const newPage: PageTreeNode = {
        id: page.targetPath.replace(/[^a-zA-Z0-9-_]/g, '-'),
        title: page.title,
        children: [],
      };
      setPages((prev) => [...prev, newPage]);
      setPageContents((prev) => ({ ...prev, [newPage.id]: page.content }));
      void writePageContent(backend, newPage.id, page.content);
    }
    if (!hasStarted) setHasStarted(true);
  }, [backend, hasStarted]);

  const handleOpenImport = useCallback((source: ImportSource) => {
    setImportSource(source);
    setImportDialogOpen(true);
  }, []);

  const handleOpenExport = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleOpenSettings = useCallback((tab: 'settings' | 'about' | 'data' | 'spaces' = 'settings') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const handleOpenDocs = useCallback(() => {
    setActiveSpace('docs');
    setDocsSelectedPageId('docs-index');
    setDocsPages(DOCS_PAGES);
    pushRoute({ space: 'docs', pageId: 'docs-index' });
  }, []);

  const handleBackToUserSpace = useCallback(() => {
    setActiveSpace('user');
    pushRoute({ space: 'user', spaceId: userSpaceId, pageId: selectedPageId });
  }, [userSpaceId, selectedPageId]);

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
        source: `Browser (${backend.type === 'browser' ? 'IndexedDB' : backend.type})`,
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
    { id: 'import-notion', title: 'Import from Notion', icon: '\u{1F4E5}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenImport('notion'); } },
    { id: 'import-obsidian', title: 'Import from Obsidian', icon: '\u{1F4E5}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenImport('obsidian'); } },
    { id: 'export-page', title: 'Export Current Page', icon: '\u{1F4E4}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenExport(); } },
    { id: 'manage-spaces', title: 'Manage Spaces', icon: '\u{1F4C2}', category: 'Spaces', action: () => { setCommandPaletteOpen(false); handleOpenSettings('spaces'); } },
  ], [handlePageAdd, handleOpenExport, handleOpenSettings, handleOpenImport]);

  const currentContent = selectedPageId ? (pageContents[selectedPageId] ?? '') : '';
  const contentLoaded = selectedPageId ? (selectedPageId in pageContents) : false;
  const docsSelectedNode = docsSelectedPageId ? findNode(docsPages, docsSelectedPageId) : undefined;
  const selectedNode = selectedPageId ? findNode(pages, selectedPageId) : undefined;
  const showOnboarding = !hasStarted;

  // Show loading state while backend loads persisted data
  if (!ready) {
    return (
      <div className="h-dvh flex items-center justify-center bg-white dark:bg-gray-900 text-gray-500" data-testid="app-loading">
        Loading...
      </div>
    );
  }

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
        <AppMenu
          pageId={activeSpace === 'user' ? selectedPageId : undefined}
          isFavorite={selectedPageId ? favorites.some((f) => f.id === selectedPageId) : false}
          onToggleFavorite={handleToggleFavorite}
          onRename={() => {
            const titleEl = document.querySelector('[data-testid="page-title"]') as HTMLElement;
            titleEl?.click();
          }}
          onDuplicate={handlePageDuplicate}
          onDelete={handlePageDelete}
        />
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
            onOpenTrash={() => { setShowTrash(true); setSelectedPageId(undefined); }}
            spaceName={spaceName}
            onSpaceRename={(name) => handleSpaceRename('default', name)}
            spaces={[...spaceInfoList.map((s) => ({ id: s.id, name: s.name })), { id: '__docs__', name: 'Cept Docs' }]}
            activeSpaceId={userSpaceId}
            onSwitchSpace={(id) => {
              if (id === '__docs__') {
                handleOpenDocs();
              } else {
                handleSwitchSpace(id);
              }
            }}
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
                  {getDocsSourceUrl(docsSelectedPageId) && (
                    <a
                      className="cept-docs-banner-link"
                      href={getDocsSourceUrl(docsSelectedPageId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="docs-source-link"
                    >
                      View source
                    </a>
                  )}
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
                {docsSelectedNode && docsSelectedNode.children.length > 0 && (
                  <FolderView
                    children={docsSelectedNode.children}
                    onPageSelect={handleDocsPageSelect}
                  />
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 mt-20">
                <p>Select a documentation page from the sidebar</p>
              </div>
            )
          ) : showOnboarding ? (
            <LandingPage
              onStartWriting={handleStartWriting}
              onTryDemo={handleResetDemo}
              onOpenDocs={handleOpenDocs}
            />
          ) : showTrash ? (
            <div className="cept-trash-view" data-testid="trash-view">
              <h2 className="cept-trash-view-title">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
                </svg>
                Trash
              </h2>
              {trash.length === 0 ? (
                <p className="cept-trash-view-empty">Trash is empty</p>
              ) : (
                <>
                  <div className="cept-trash-view-list">
                    {trash.map((item) => (
                      <div key={item.id} className="cept-trash-view-item" data-testid={`trash-item-${item.id}`}>
                        <span className="cept-trash-view-item-icon">{item.icon ?? '\u{1F4C4}'}</span>
                        <span className="cept-trash-view-item-title">{item.title || 'Untitled'}</span>
                        <button
                          className="cept-trash-view-action"
                          onClick={() => handleRestoreFromTrash(item.id)}
                          data-testid={`trash-restore-${item.id}`}
                        >
                          Restore
                        </button>
                        <button
                          className="cept-trash-view-action cept-trash-view-action--danger"
                          onClick={() => handlePermanentDelete(item.id)}
                          data-testid={`trash-delete-${item.id}`}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="cept-trash-view-empty-btn"
                    onClick={handleEmptyTrash}
                    data-testid="empty-trash"
                  >
                    Empty trash
                  </button>
                </>
              )}
            </div>
          ) : selectedPageId && selectedNode ? (
            <>
              <PageHeader
                pageId={selectedPageId}
                title={selectedNode.title}
                icon={selectedNode.icon}
                cover={selectedNode.cover}
                isFavorite={favorites.some((f) => f.id === selectedPageId)}
                onRename={handlePageRename}
                onDuplicate={handlePageDuplicate}
                onDelete={handlePageDelete}
                onToggleFavorite={handleToggleFavorite}
              />
              {contentLoaded ? (
                <CeptEditor
                  key={selectedPageId}
                  content={currentContent}
                  placeholder="Type '/' for commands..."
                  onUpdate={handleContentUpdate}
                />
              ) : (
                <div className="text-center text-gray-400 mt-8" data-testid="page-loading">Loading...</div>
              )}
              {selectedNode.children.length > 0 && (
                <FolderView
                  children={selectedNode.children}
                  onPageSelect={handlePageSelect}
                />
              )}
            </>
          ) : (
            <div className="cept-empty-state" data-testid="empty-state">
              <p className="cept-empty-state-text">
                Select a page from the sidebar, or{' '}
                <button
                  className="cept-empty-state-link"
                  onClick={() => handlePageAdd()}
                  data-testid="empty-state-create"
                >
                  start typing to create a new one
                </button>
              </p>
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
        activeSpaceId={userSpaceId}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={handleSettingsChange}
        onResetSettings={handleResetSettings}
        onDeleteSpace={handleDeleteSpace}
        onSpaceRename={handleSpaceRename}
        onCreateSpace={handleCreateSpace}
        onSwitchSpace={handleSwitchSpace}
        onClearAllData={handleClearAllData}
        onRecreateDemoSpace={handleResetDemo}
        onImportNotion={() => handleOpenImport('notion')}
        onImportObsidian={() => handleOpenImport('obsidian')}
        onExport={handleOpenExport}
        backend={backend}
        onNavigateToPage={(pageId) => { setSettingsOpen(false); handlePageSelect(pageId); }}
      />
      <ImportDialog
        isOpen={importDialogOpen}
        source={importSource}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        page={selectedPageId && selectedNode ? {
          title: selectedNode.title,
          markdown: (pageContents[selectedPageId] ?? '').replace(/<[^>]+>/g, ''),
          path: `pages/${selectedPageId}.html`,
        } as PageContent : null}
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

<h2>Tables</h2>
<h3>Simple Table</h3>
<table><thead><tr><th>Feature</th><th>Status</th><th>Notes</th></tr></thead><tbody><tr><td>Rich text editing</td><td>Complete</td><td>Full inline formatting</td></tr><tr><td>Slash commands</td><td>Complete</td><td>Type / to insert blocks</td></tr><tr><td>Drag &amp; drop</td><td>Complete</td><td>Reorder blocks freely</td></tr></tbody></table>

<h2>Advanced</h2>
<h3>Math Equation</h3>
<div data-type="math-block" data-math="E = mc^2"></div>
<p>Inline math is also supported: The formula <span data-type="inline-math" data-math="a^2 + b^2 = c^2"></span> is the Pythagorean theorem.</p>

<h3>Mermaid Diagram</h3>
<div data-type="mermaid" data-mermaid="graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[OK]\n  B -->|No| D[Cancel]"></div>
`;

const DEMO_GETTING_STARTED_CONTENT = `
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
