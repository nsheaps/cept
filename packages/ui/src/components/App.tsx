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
import { DOCS_PAGES, DOCS_CONTENT, DOCS_SPACE_INFO, getDocsSourceUrl, resolveDocsContent } from './docs/docs-content.js';
import {
  useStorage,
  useWorkspacePersistence,
  saveSettingsToBackend,
  resetSettingsOnBackend,
  clearAllData,
  readPageContent,
  writePageContent,
  deletePageContent,
  saveSpaceState,
  loadSpaceState,
  readSpacePageContent,
  writeSpacePageContent,
  deleteSpacePageContent,
} from './storage/StorageContext.js';
import { LandingPage } from './landing/LandingPage.js';
import { AppMenu } from './app-menu/AppMenu.js';
import { FolderView } from './editor/FolderView.js';
import { ImportDialog } from './import-export/ImportDialog.js';
import type { ImportSource } from './import-export/ImportDialog.js';
import { ExportDialog } from './import-export/ExportDialog.js';
import { SpaceExportDialog } from './import-export/SpaceExportDialog.js';
import { SpaceImportDialog } from './import-export/SpaceImportDialog.js';
import { CeptSearchIndex } from '@cept/core';
import type { ImportedPage, PageContent } from '@cept/core';
import { createSpace as createSpaceInBackend, switchSpace as switchSpaceInBackend, deleteSpace as deleteSpaceInBackend, renameSpace as renameSpaceInBackend, loadSpaces, saveSpaces as saveSpacesManifest } from './storage/SpaceManager.js';
import type { SpacesManifest } from './storage/SpaceManager.js';
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
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 768,
  );
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
  const [spaceExportDialogOpen, setSpaceExportDialogOpen] = useState(false);
  const [spaceImportDialogOpen, setSpaceImportDialogOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [userSpaceId, setUserSpaceId] = useState('default');
  const [spacesManifest, setSpacesManifest] = useState<SpacesManifest | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchIndexRef = useRef(new CeptSearchIndex());

  // Space-aware page content helpers — for default space, use legacy paths for backward compat
  const currentReadPage = useCallback((pageId: string) => {
    if (userSpaceId === 'default') return readPageContent(backend, pageId);
    return readSpacePageContent(backend, userSpaceId, pageId);
  }, [backend, userSpaceId]);
  const currentWritePage = useCallback((pageId: string, content: string) => {
    if (userSpaceId === 'default') return writePageContent(backend, pageId, content);
    return writeSpacePageContent(backend, userSpaceId, pageId, content);
  }, [backend, userSpaceId]);
  const currentDeletePage = useCallback((pageId: string) => {
    if (userSpaceId === 'default') return deletePageContent(backend, pageId);
    return deleteSpacePageContent(backend, userSpaceId, pageId);
  }, [backend, userSpaceId]);

  /** Save current space state to its per-space workspace file */
  const saveCurrentSpaceState = useCallback((
    currentSpaceId: string,
    currentPages: PageTreeNode[],
    currentFavorites: SidebarPageRef[],
    currentRecentPages: SidebarPageRef[],
    currentSelectedPageId: string | undefined,
    currentSpaceName: string,
    currentPageContents: Record<string, string>,
  ) => {
    void saveSpaceState(backend, currentSpaceId, {
      pages: currentPages,
      favorites: currentFavorites,
      recentPages: currentRecentPages,
      selectedPageId: currentSelectedPageId,
      spaceName: currentSpaceName,
    });
    // Also write page contents to per-space dir
    for (const [pageId, content] of Object.entries(currentPageContents)) {
      if (content) {
        void writeSpacePageContent(backend, currentSpaceId, pageId, content);
      }
    }
  }, [backend]);

  /** Load a space's state from storage and apply it to React state */
  const loadAndApplySpaceState = useCallback(async (spaceId: string, name: string) => {
    const state = await loadSpaceState(backend, spaceId);
    if (state) {
      setPages(state.pages);
      setSelectedPageId(state.selectedPageId);
      setFavorites(state.favorites ?? []);
      setRecentPages(state.recentPages ?? []);
      setSpaceName(state.spaceName ?? name);
      setPageContents({});
      setTrash([]);
      setHasStarted(true);
      // Load selected page content
      if (state.selectedPageId) {
        const content = await readSpacePageContent(backend, spaceId, state.selectedPageId);
        if (content !== null) {
          setPageContents((prev) => ({ ...prev, [state.selectedPageId!]: content }));
        }
      }
    } else {
      // Empty space
      setPages([]);
      setPageContents({});
      setSelectedPageId(undefined);
      setFavorites([]);
      setRecentPages([]);
      setTrash([]);
      setSpaceName(name);
      setHasStarted(true);
    }
  }, [backend]);

  // Apply loaded state once backend is ready
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!ready || initializedRef.current) return;
    initializedRef.current = true;

    setSettings(initialSettings);

    // Load spaces manifest
    void loadSpaces(backend).then((manifest) => {
      setSpacesManifest(manifest);
      setUserSpaceId(manifest.activeSpaceId);
    });

    if (persisted) {
      setPages(persisted.pages);
      setSelectedPageId(persisted.selectedPageId);
      setFavorites(persisted.favorites ?? []);
      setRecentPages(persisted.recentPages ?? []);
      setSpaceName(persisted.spaceName ?? 'My Space');
      setHasStarted(true);
      setTrash([]);
      // Also save to per-space file so switching back works
      void saveSpaceState(backend, 'default', persisted);
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
      // Write demo content to individual files (both legacy location and per-space)
      void Promise.all(Object.entries(demoContents).map(([id, content]) => writePageContent(backend, id, content)));
      // Save demo state so switching back works
      void saveSpaceState(backend, 'default', {
        pages: DEMO_PAGES,
        favorites: [],
        recentPages: [],
        selectedPageId: 'welcome',
        spaceName: 'Demo Space',
      });
      // Update manifest to reflect demo space name
      void loadSpaces(backend).then((manifest) => {
        const defaultSpace = manifest.spaces.find((s) => s.id === 'default');
        if (defaultSpace && defaultSpace.name === 'My Space') {
          defaultSpace.name = 'Demo Space';
          void saveSpacesManifest(backend, manifest);
        }
        setSpacesManifest(manifest);
      });
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
      const state = { pages, favorites, recentPages, selectedPageId, spaceName };
      save(state);
      // Also save to per-space file
      void saveSpaceState(backend, userSpaceId, state);
    }, 300);
  }, [pages, favorites, recentPages, selectedPageId, spaceName, save, backend, userSpaceId]);

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
      void currentReadPage(id).then((content) => {
        if (content !== null) {
          setPageContents((prev) => ({ ...prev, [id]: content }));
        }
      });
    }
    // Close sidebar on narrow screens after selecting a page
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [pages, addToRecent, pageContents, currentReadPage]);

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
    void currentWritePage(newPage.id, '');
    if (!hasStarted) setHasStarted(true);
  }, [hasStarted, currentWritePage]);

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
    void currentDeletePage(id);
  }, [currentDeletePage]);

  const handleEmptyTrash = useCallback(() => {
    setTrash((prev) => {
      for (const item of prev) {
        setPageContents((pc) => {
          const next = { ...pc };
          delete next[item.id];
          return next;
        });
        void currentDeletePage(item.id);
      }
      return [];
    });
  }, [currentDeletePage]);

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
      void currentWritePage(duplicateId, content);
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
  }, [pageContents, currentWritePage]);

  const handlePageMoveToRoot = useCallback((id: string) => {
    setPages((prev) => moveNode(prev, id, undefined));
  }, []);

  const handleContentUpdate = useCallback((markdown: string) => {
    if (!selectedPageId) return;
    setPageContents((prev) => ({ ...prev, [selectedPageId]: markdown }));

    // Debounced write to backend
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void currentWritePage(selectedPageId, markdown);
    }, 500);
  }, [selectedPageId, currentWritePage]);

  // Keep search index in sync with page content
  const indexedRef = useRef(new Set<string>());
  useEffect(() => {
    const idx = searchIndexRef.current;
    const allPages = flattenPages(pages);
    const currentIds = new Set(allPages.map((p) => p.id));

    // Index pages that have content
    for (const page of allPages) {
      const md = pageContents[page.id];
      if (md !== undefined) {
        const plainText = md.replace(/[#*_~`>\[\]()|-]/g, '');
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
    void currentWritePage(firstPage.id, content);
  }, [currentWritePage]);

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
    setUserSpaceId('default');
    setHasStarted(true);
    void Promise.all(Object.entries(demoContents).map(([id, content]) => writePageContent(backend, id, content)));
    void saveSpaceState(backend, 'default', {
      pages: DEMO_PAGES, favorites: [], recentPages: [], selectedPageId: 'welcome', spaceName: 'Demo Space',
    });
  }, [backend]);

  const handleClearAllData = useCallback(() => {
    void clearAllData(backend);
    // Reset settings and then recreate the demo space so users start fresh
    setSettings({ ...DEFAULT_SETTINGS });
    setPages(DEMO_PAGES);
    const demoContents: Record<string, string> = { welcome: DEMO_CONTENT, 'getting-started': DEMO_GETTING_STARTED_CONTENT, features: DEMO_FEATURES_CONTENT, notes: '' };
    setPageContents(demoContents);
    setSelectedPageId('welcome');
    setFavorites([]);
    setRecentPages([]);
    setTrash([]);
    setSpaceName('Demo Space');
    setUserSpaceId('default');
    setHasStarted(true);
    setSettingsOpen(false);
    void Promise.all(Object.entries(demoContents).map(([id, content]) => writePageContent(backend, id, content)));
    void saveSpaceState(backend, 'default', {
      pages: DEMO_PAGES, favorites: [], recentPages: [], selectedPageId: 'welcome', spaceName: 'Demo Space',
    });
    // Reset spaces manifest to just the default space
    const freshManifest: SpacesManifest = {
      activeSpaceId: 'default',
      spaces: [{ id: 'default', name: 'Demo Space', createdAt: new Date().toISOString() }],
    };
    void saveSpacesManifest(backend, freshManifest);
    setSpacesManifest(freshManifest);
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
    if (id === userSpaceId) {
      setSpaceName(name);
    }
    void renameSpaceInBackend(backend, id, name).then(() => {
      void loadSpaces(backend).then((manifest) => setSpacesManifest(manifest));
    });
  }, [backend, userSpaceId]);

  const handleDeleteSpace = useCallback((id: string) => {
    void deleteSpaceInBackend(backend, id).then(() => {
      void loadSpaces(backend).then((manifest) => {
        setSpacesManifest(manifest);
        if (id === userSpaceId) {
          const targetId = manifest.activeSpaceId;
          const targetSpace = manifest.spaces.find((s) => s.id === targetId);
          setUserSpaceId(targetId);
          void loadAndApplySpaceState(targetId, targetSpace?.name ?? 'My Space');
        }
      });
    });
  }, [backend, userSpaceId, loadAndApplySpaceState]);

  const handleCreateSpace = useCallback((name: string) => {
    // Save current space state before switching
    saveCurrentSpaceState(userSpaceId, pages, favorites, recentPages, selectedPageId, spaceName, pageContents);
    void createSpaceInBackend(backend, name).then((newSpace) => {
      void loadSpaces(backend).then((manifest) => {
        setSpacesManifest(manifest);
      });
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
  }, [backend, userSpaceId, pages, favorites, recentPages, selectedPageId, spaceName, pageContents, saveCurrentSpaceState]);

  const handleSwitchSpace = useCallback((id: string) => {
    // Save current space state before switching
    saveCurrentSpaceState(userSpaceId, pages, favorites, recentPages, selectedPageId, spaceName, pageContents);
    void switchSpaceInBackend(backend, id).then(() => {
      setUserSpaceId(id);
      void loadSpaces(backend).then((manifest) => {
        setSpacesManifest(manifest);
        const space = manifest.spaces.find((s) => s.id === id);
        void loadAndApplySpaceState(id, space?.name ?? 'My Space');
      });
    });
  }, [backend, userSpaceId, pages, favorites, recentPages, selectedPageId, spaceName, pageContents, saveCurrentSpaceState, loadAndApplySpaceState]);

  const handleImportComplete = useCallback((importedPages: ImportedPage[]) => {
    for (const page of importedPages) {
      const newPage: PageTreeNode = {
        id: page.targetPath.replace(/[^a-zA-Z0-9-_]/g, '-'),
        title: page.title,
        children: [],
      };
      setPages((prev) => [...prev, newPage]);
      setPageContents((prev) => ({ ...prev, [newPage.id]: page.content }));
      void currentWritePage(newPage.id, page.content);
    }
    if (!hasStarted) setHasStarted(true);
  }, [currentWritePage, hasStarted]);

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
    const source = `Browser (${backend.type === 'browser' ? 'IndexedDB' : backend.type})`;
    if (spacesManifest) {
      for (const space of spacesManifest.spaces) {
        if (space.id === userSpaceId) {
          // Active space — use live React state for accurate counts
          const contentSize = Object.values(pageContents).reduce((sum, c) => sum + (c?.length ?? 0), 0);
          list.push({
            id: space.id,
            name: spaceName,
            source,
            pageCount: flattenPages(pages).length,
            contentSize,
            createdAt: space.createdAt,
          });
        } else {
          list.push({
            id: space.id,
            name: space.name,
            source,
            pageCount: 0,
            contentSize: 0,
            createdAt: space.createdAt,
          });
        }
      }
    } else if (hasStarted || pages.length > 0) {
      // Fallback before manifest loads
      const contentSize = Object.values(pageContents).reduce((sum, c) => sum + (c?.length ?? 0), 0);
      list.push({
        id: 'default',
        name: spaceName,
        source,
        pageCount: flattenPages(pages).length,
        contentSize,
      });
    }
    list.push(DOCS_SPACE_INFO);
    return list;
  }, [hasStarted, pages, pageContents, spaceName, spacesManifest, userSpaceId, backend.type]);

  const commandItems: CommandItem[] = useMemo(() => [
    { id: 'new-page', title: 'New Page', icon: '\u{1F4C4}', category: 'Pages', action: () => handlePageAdd() },
    { id: 'search', title: 'Search', icon: '\u{1F50D}', category: 'Navigation', action: () => { setCommandPaletteOpen(false); setSearchOpen(true); } },
    { id: 'toggle-sidebar', title: 'Toggle Sidebar', icon: '\u{1F4CB}', category: 'View', action: () => { setSidebarOpen((p) => !p); setCommandPaletteOpen(false); } },
    { id: 'import-notion', title: 'Import from Notion', icon: '\u{1F4E5}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenImport('notion'); } },
    { id: 'import-obsidian', title: 'Import from Obsidian', icon: '\u{1F4E5}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenImport('obsidian'); } },
    { id: 'export-page', title: 'Export Current Page', icon: '\u{1F4E4}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); handleOpenExport(); } },
    { id: 'export-space', title: 'Export Space as ZIP', icon: '\u{1F4E6}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); setSpaceExportDialogOpen(true); } },
    { id: 'import-space', title: 'Import Space from ZIP', icon: '\u{1F4E5}', category: 'Import / Export', action: () => { setCommandPaletteOpen(false); setSpaceImportDialogOpen(true); } },
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
            onSpaceRename={(name) => handleSpaceRename(userSpaceId, name)}
            spaces={spaceInfoList.map((s) => ({ id: s.id, name: s.name }))}
            activeSpaceId={userSpaceId}
            onSwitchSpace={(id) => {
              if (id === 'cept-docs') {
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
                      className="cept-docs-source-icon"
                      href={getDocsSourceUrl(docsSelectedPageId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="docs-source-link"
                      title="View source on GitHub"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                      </svg>
                    </a>
                  )}
                  <button className="cept-docs-banner-back" onClick={handleBackToUserSpace} data-testid="docs-back-to-space">
                    Back to my space
                  </button>
                </div>
                <CeptEditor
                  key={docsSelectedPageId}
                  content={resolveDocsContent(DOCS_CONTENT[docsSelectedPageId])}
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
          markdown: pageContents[selectedPageId] ?? '',
          path: `pages/${selectedPageId}.md`,
        } as PageContent : null}
      />
      <SpaceExportDialog
        isOpen={spaceExportDialogOpen}
        onClose={() => setSpaceExportDialogOpen(false)}
        backend={backend}
        spaceId={userSpaceId}
        spaceName={spaceName}
      />
      <SpaceImportDialog
        isOpen={spaceImportDialogOpen}
        onClose={() => setSpaceImportDialogOpen(false)}
        backend={backend}
        spaces={spaceInfoList.filter((s) => s.id !== 'cept-docs').map((s) => ({ id: s.id, name: s.name }))}
        onImportComplete={() => {
          // Refresh space list after import
          void loadSpaces(backend).then((manifest) => {
            setSpacesManifest(manifest);
          });
        }}
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


const DEMO_CONTENT = `This is a demo space running in your browser. All data is stored locally.

<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>Type <code>/</code> anywhere to see all available block types. Try it now!</p></div>

## Getting Started

Cept is a fully-featured Notion clone that works offline. You can create pages, databases, and templates — all stored locally in your browser.

### Try These Features

- Type text to create paragraphs
- Use **bold**, *italic*, and ~~strikethrough~~
- Create nested lists by pressing Tab

1. Numbered lists work too
2. Just like you'd expect

### Links

Links are styled with [blue underlines](https://example.com) so they stand out from surrounding text. You can also add links with **Cmd/Ctrl + K** or the inline toolbar.

Start typing below to try the editor...
`;

const DEMO_FEATURES_CONTENT = `Cept supports a wide variety of content blocks. Type \`/\` in the editor to insert any of these.

## Text Formatting

**Bold text** with \`Cmd/Ctrl + B\`, *italic text* with \`Cmd/Ctrl + I\`, <u>underline</u> with \`Cmd/Ctrl + U\`, ~~strikethrough~~ with \`Cmd/Ctrl + Shift + S\`, and \`inline code\` with \`Cmd/Ctrl + E\`.

You can also add [links like this](https://example.com) and combine **_multiple_ ~~styles~~** together.

## Headings

Three levels of headings are available. Type \`# \`, \`## \`, or \`### \` to create them.

## Code Block

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));
\`\`\`

## Blockquote

> The best way to predict the future is to invent it. — Alan Kay
>
> Blockquotes use \`> \` on every line.

---

## Lists

### Bullet List

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Numbered List

1. Step one
2. Step two
3. Step three

### Task List

- [x] Completed task
- [ ] Pending task
- [ ] Another pending task

---

## Callout

<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>This is an informational callout. Use <code>/callout</code> or <code>Cmd/Ctrl + Shift + C</code> to create one.</p></div>

<div data-type="callout" data-icon="\u26A0\uFE0F" data-color="warning"><p>Callouts support different icons and colors. Change them by editing the icon or color attribute.</p></div>

## Toggle

Click the arrow to expand or collapse toggle blocks:

<details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Click me to expand</summary><div class="cept-toggle-content"><p>This is hidden content inside a toggle. You can put any content here, including lists, code blocks, and more.</p></div></details>

<details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Toggle with a list inside</summary><div class="cept-toggle-content"><ul><li><p>Bullet lists</p></li><li><p>Numbered lists</p></li><li><p>Task lists with checkboxes</p></li></ul></div></details>

<details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Nested toggle (toggle in toggle)</summary><div class="cept-toggle-content"><p>This outer toggle contains another toggle:</p><details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Inner toggle</summary><div class="cept-toggle-content"><p>Nested content inside the inner toggle.</p></div></details></div></details>

Type \`> \` at the start of a line to create a toggle (like Notion), or use \`/toggle\`.

---

## Tables

| Feature | Status | Notes |
| --- | --- | --- |
| Rich text editing | Complete | Full inline formatting |
| Slash commands | Complete | Type / to insert blocks |
| Drag & drop | Complete | Reorder blocks freely |
| Toggle blocks | Complete | Collapsible content |
| Callouts | Complete | Highlighted notes |

---

## Math Equation

Use \`/math\` to insert a math equation block (e.g. $E = mc^2$).

Inline math is also supported: The formula $a^2 + b^2 = c^2$ is the Pythagorean theorem.

## Mermaid Diagram

Use \`/mermaid\` to insert flowcharts, sequence diagrams, and more.

## Media Blocks

- **Image** — Use \`/image\` to insert an image from a URL
- **Embed** — Use \`/embed\` to embed YouTube, Vimeo, and other media
- **Bookmark** — Use \`/bookmark\` to create a rich link preview card

## Layout

**Columns** — Use \`/columns\` to split content side by side (2 or 3 columns).
`;

const DEMO_GETTING_STARTED_CONTENT = `Welcome to Cept! Here's how to get started with your space.

## Creating Pages

Click the **+** button in the sidebar to create a new page. Pages can be nested inside other pages to create a hierarchy.

## Using the Editor

<div data-type="callout" data-icon="\uD83D\uDCA1" data-color="default"><p>Type <code>/</code> to open the slash command menu. You can search for any block type by name.</p></div>

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| \`Cmd/Ctrl + K\` | Open command palette |
| \`Cmd/Ctrl + B\` | Bold text |
| \`Cmd/Ctrl + I\` | Italic text |
| \`Cmd/Ctrl + U\` | Underline text |
| \`Cmd/Ctrl + E\` | Inline code |
| \`Cmd/Ctrl + Shift + S\` | Strikethrough |
| \`Cmd/Ctrl + Shift + H\` | Highlight |
| \`Cmd/Ctrl + Shift + C\` | Callout |
| \`Cmd/Ctrl + \\\\\` | Toggle sidebar |

## Organizing Your Space

1. **Favorites** — Right-click a page and add it to favorites for quick access
2. **Nested pages** — Click the + on a page to create a sub-page
3. **Trash** — Deleted pages go to trash and can be restored

## Managing Spaces

Cept supports multiple storage backends:

<details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Browser Storage (Default)</summary><div class="cept-toggle-content"><p>Your data is stored in your browser using IndexedDB. No setup required — just start typing. Data persists across sessions but is local to this browser.</p></div></details>

<details data-type="toggle" class="cept-toggle"><summary class="cept-toggle-summary">Git Repository (Coming Soon)</summary><div class="cept-toggle-content"><p>Connect a Git repository for version history, collaboration, and sync across devices. Public repositories can be browsed anonymously; private repositories require authentication.</p></div></details>

To manage spaces, open **Settings** (gear icon) and go to the **Data & Cache** tab.
`;
