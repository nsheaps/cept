import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CeptEditor } from './editor/CeptEditor.js';
import { Sidebar } from './sidebar/Sidebar.js';
import type { SidebarPageRef } from './sidebar/Sidebar.js';
import type { PageTreeNode } from './sidebar/PageTreeItem.js';
import {
  expandToNode,
  getBreadcrumbs,
  renameNode,
  removeNode,
  moveNode,
  findNode,
  addChild,
  findAncestorIds,
} from './sidebar/page-tree-utils.js';
import { Breadcrumbs } from './topbar/Breadcrumbs.js';
import { CommandPalette } from './command-palette/CommandPalette.js';
import type { CommandItem } from './command-palette/CommandPalette.js';
import { SearchPanel } from './search/SearchPanel.js';
import type { SearchResult } from './search/SearchPanel.js';
import { PageHeader } from './page-header/PageHeader.js';
import { SettingsModal, DEFAULT_SETTINGS } from './settings/SettingsModal.js';
import type { CeptSettings, SpaceInfo } from './settings/SettingsModal.js';
import { useTheme } from './settings/useTheme.js';
import {
  DOCS_PAGES,
  DOCS_CONTENT,
  DOCS_SPACE_INFO,
  getDocsSourceUrl,
  resolveDocsContent,
} from './docs/docs-content.js';
import {
  useStorage,
  useWorkspacePersistence,
  saveSettingsToBackend,
  resetSettingsOnBackend,
  clearAllData,
} from './storage/StorageContext.js';
import { LandingPage } from './landing/LandingPage.js';
import { AppMenu } from './app-menu/AppMenu.js';
import { FolderView } from './editor/FolderView.js';
import { ImportDialog } from './import-export/ImportDialog.js';
import type { ImportSource } from './import-export/ImportDialog.js';
import { ExportDialog } from './import-export/ExportDialog.js';
import { AddSpaceWizardModal } from './settings/AddSpaceWizardModal.js';
import { OpenFolderDialog } from './settings/OpenFolderDialog.js';
import { Toast, useToast } from './shared/Toast.js';
import type { RemoteSpaceConfig } from './settings/AddSpaceWizardModal.js';
import { applyMoves, CeptSearchIndex, MemoryBackend, reconnectFolder } from '@cept/core';
import type { ImportedPage, PageContent, StorageBackend } from '@cept/core';
import { generateRemoteSpaceId, parseRemoteSpaceId } from './storage/SpaceManager.js';
import type { SpaceSnapshot, SpaceStats, SpacesManifest } from './storage/SpaceManager.js';
import { useSpaces } from './storage/useSpaces.js';
import type { FolderChange } from './storage/folder-space.js';
import { initFolderSpace } from './storage/folder-space.js';
import { useFolderHost } from './storage/folder-host.js';
import {
  findSavedFolder,
  folderSpaceAt,
  inspectFolder,
  restoreFolderSpaces,
} from './storage/folder-open.js';
import type { FolderContents, FolderSpaceChoice } from './storage/folder-open.js';
import {
  canHostGitClone,
  cloneErrorMessage,
  cloneRemoteRepo,
  normalizeRepoUrl,
} from './storage/git-space.js';
import { useGitHubAccount } from './settings/github-account.js';
import { probePlatform, spaceSources } from './storage/platform.js';
import {
  restoreRoute,
  peekRoute,
  replaceRoute,
  pushRoute,
  parseRoute,
  resolveRoute,
  isRemoteSpaceId,
  setUseGitPrefix,
} from '../router.js';
import type { AppRoute } from '../router.js';
import { NotFoundPage } from './shared/NotFoundPage.js';
import { gitCorsProxy } from '../config/git-proxy.js';

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

/** The demo is a session-only memory space, so it never touches the user's spaces. */
const DEMO_SPACE_ID = 'demo';
const DEMO_SPACE_NAME = 'Demo Space';

const DEMO_SNAPSHOT: SpaceSnapshot = {
  pages: DEMO_PAGES,
  favorites: [],
  recentPages: [],
  selectedPageId: 'welcome',
  spaceName: DEMO_SPACE_NAME,
};

function demoPageContents(): Record<string, string> {
  return {
    welcome: DEMO_CONTENT,
    'getting-started': DEMO_GETTING_STARTED_CONTENT,
    features: DEMO_FEATURES_CONTENT,
    notes: '',
  };
}

/** Whether the page URL asks for the demo (`?demo`, or a link to a page in it). */
function demoRequestedByUrl(): boolean {
  try {
    // `?demo`, or a link into the demo (it lives in memory, so it is opened fresh).
    return (
      new URLSearchParams(window.location.search).has('demo') ||
      peekRoute().spaceId === DEMO_SPACE_ID
    );
  } catch {
    return false;
  }
}

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

/** A space with no pages yet. */
function emptySnapshot(spaceName: string): SpaceSnapshot {
  return { pages: [], favorites: [], recentPages: [], selectedPageId: undefined, spaceName };
}

/** A space freshly cloned from a remote: its pages, the first one selected. */
function clonedSnapshot(pages: PageTreeNode[], spaceName: string): SpaceSnapshot {
  return { pages, favorites: [], recentPages: [], selectedPageId: pages[0]?.id, spaceName };
}

/**
 * Root application component.
 * Renders the main Cept workspace UI.
 */
export function App() {
  const backend = useStorage();
  const { state: persisted, settings: initialSettings, ready } = useWorkspacePersistence(backend);

  // Demo mode: the showDemoContent setting (on by default in builds with
  // VITE_DEMO_DEFAULT) opens the demo when there is nothing saved yet.
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
  useTheme(settings.themeMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'settings' | 'about' | 'spaces'>('settings');
  const [addSpaceWizardOpen, setAddSpaceWizardOpen] = useState(false);
  const [activeSpace, setActiveSpace] = useState<'user' | 'docs'>('user');
  const [docsSelectedPageId, setDocsSelectedPageId] = useState<string | undefined>('docs-index');
  const [docsPages, setDocsPages] = useState<PageTreeNode[]>(DOCS_PAGES);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSource, setImportSource] = useState<ImportSource>('notion');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  // The URL named a page or space that does not exist.
  const [notFound, setNotFound] = useState<{ path: string } | undefined>(undefined);
  const {
    manager: spaces,
    manifest: spacesManifest,
    setManifest: setSpacesManifest,
    activeId: userSpaceId,
    setActiveId: setUserSpaceId,
  } = useSpaces(backend);
  // The GitHub sign-in, for cloning private repositories (null without a host sign-in).
  const gitAuth = useGitHubAccount()?.gitAuth;
  const [cloneStatus, setCloneStatus] = useState<{
    active: boolean;
    message?: string;
    error?: string;
  }>({ active: false });
  const [spaceLoadError, setSpaceLoadError] = useState<string | undefined>(undefined);
  // Folders on this device (REQ-WS-012): null when this host cannot open them.
  const folderHost = useFolderHost();
  /** Saved folders the browser wants asked about again, by space id. */
  const waitingFoldersRef = useRef(new Map<string, FileSystemDirectoryHandle>());
  /** The page a link named in a folder space that was not connected yet. */
  const pendingFolderPageRef = useRef<{ spaceId: string; pageId: string } | null>(null);
  /** The active folder space whose folder must be reconnected from a click. */
  const [folderToReconnect, setFolderToReconnect] = useState<
    { id: string; name: string } | undefined
  >(undefined);
  /**
   * A folder picked to reconnect a space whose saved handle is gone, holding a
   * space with another name: it is bound only after the user confirms.
   */
  const [reconnectMismatch, setReconnectMismatch] = useState<
    { id: string; handle: FileSystemDirectoryHandle; foundName: string } | undefined
  >(undefined);
  /**
   * The space whose saved folder the user would not allow: the next reconnect
   * picks the folder again instead of asking for the same one.
   */
  const [pickToReconnect, setPickToReconnect] = useState<string | undefined>(undefined);
  /** A picked folder that is not a space, waiting for the user to choose what to open. */
  const [pickedFolder, setPickedFolder] = useState<
    | { handle: FileSystemDirectoryHandle; folder: StorageBackend; contents: FolderContents }
    | undefined
  >(undefined);
  /** Spaces opened this session whose conversion to folders still keeps a backup. */
  const [conversionBackups, setConversionBackups] = useState<Record<string, boolean>>({});
  /** Page counts, sizes and slugs of the listed spaces, read while settings are open. */
  const [spaceStats, setSpaceStats] = useState<Record<string, SpaceStats | null>>({});
  const { messages: toastMessages, addToast, dismissToast } = useToast();
  const lastSyncCheckRef = useRef<Record<string, number>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchIndexRef = useRef(new CeptSearchIndex());

  // Page content of the active space
  const currentReadPage = useCallback(
    (pageId: string) => spaces.readPage(userSpaceId, pageId),
    [spaces, userSpaceId],
  );
  const currentWritePage = useCallback(
    (pageId: string, content: string) => spaces.writePage(userSpaceId, pageId, content),
    [spaces, userSpaceId],
  );
  const currentDeletePage = useCallback(
    (pageId: string) => spaces.deletePage(userSpaceId, pageId),
    [spaces, userSpaceId],
  );

  // Folder spaces (REQ-WS-001): page ids are file paths, so renaming or moving
  // a page changes its id and the ids of everything under it.
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const trashRef = useRef(trash);
  trashRef.current = trash;
  const pendingWriteRef = useRef<{ pageId: string; content: string } | undefined>(undefined);

  /** Write the content waiting on the save debounce now, so a rename never strands it. */
  const flushPendingWrite = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const pending = pendingWriteRef.current;
    pendingWriteRef.current = undefined;
    if (pending) await currentWritePage(pending.pageId, pending.content);
  }, [currentWritePage]);

  /**
   * Run a page operation on the active folder space, carry every page id the
   * app holds over to the paths that moved, and reload the tree from disk.
   * A refused operation (a taken or reserved name) is shown as a toast.
   */
  const runFolderChange = useCallback(
    async (op: () => Promise<FolderChange>): Promise<FolderChange | null> => {
      await flushPendingWrite();
      let change: FolderChange;
      try {
        change = await op();
      } catch (err) {
        addToast(err instanceof Error ? err.message : String(err), 'error');
        return null;
      }
      const remap = (id: string) => applyMoves(id, change.moved);
      const remapTree = (nodes: PageTreeNode[]): PageTreeNode[] =>
        nodes.map((n) => ({ ...n, id: remap(n.id), children: remapTree(n.children) }));
      const hidden = new Set(trashRef.current.map((t) => remap(t.id)));
      const next = await spaces.pageTree(userSpaceId, remapTree(pagesRef.current), hidden);
      const titles = new Map(flattenPages(next).map((p) => [p.id, p.title]));
      const relabel = (refs: SidebarPageRef[]) =>
        refs.map((r) => {
          const id = remap(r.id);
          return { ...r, id, title: titles.get(id) ?? r.title };
        });
      setPages(next);
      setSelectedPageId((prev) => prev && remap(prev));
      setFavorites(relabel);
      setRecentPages(relabel);
      setTrash((prev) =>
        prev.map((t) => ({
          ...t,
          id: remap(t.id),
          ...(t.parentId ? { parentId: remap(t.parentId) } : {}),
        })),
      );
      setPageContents((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, content]) => [remap(id), content])),
      );
      return change;
    },
    [flushPendingWrite, addToast, spaces, userSpaceId],
  );

  /** Save the active space's state and in-memory page contents to its own files */
  const saveActiveSpace = useCallback(() => {
    void spaces.saveState(
      userSpaceId,
      { pages, favorites, recentPages, selectedPageId, spaceName },
      pageContents,
    );
  }, [spaces, userSpaceId, pages, favorites, recentPages, selectedPageId, spaceName, pageContents]);

  /** Show a space: replace the page tree, sidebar lists and loaded contents */
  const applySpace = useCallback(
    (snapshot: SpaceSnapshot, contents: Record<string, string> = {}) => {
      setPages(snapshot.pages);
      setSelectedPageId(snapshot.selectedPageId);
      setFavorites(snapshot.favorites);
      setRecentPages(snapshot.recentPages);
      setSpaceName(snapshot.spaceName);
      setPageContents(contents);
      setTrash([]);
      setHasStarted(true);
    },
    [],
  );

  /** Load a space's state from storage and show it */
  const loadAndApplySpaceState = useCallback(
    async (spaceId: string, name: string) => {
      setSpaceLoadError(undefined);
      setFolderToReconnect(undefined);
      if (!spaces.isConnected(spaceId)) {
        // A folder space after a reload: the browser asks again for its folder.
        applySpace(emptySnapshot(name));
        setFolderToReconnect({ id: spaceId, name });
        return [];
      }
      try {
        const { snapshot, selectedContent, converted, backupKept } = await spaces.open(
          spaceId,
          name,
        );
        const selected = snapshot?.selectedPageId;
        applySpace(
          snapshot ?? emptySnapshot(name),
          selected ? { [selected]: selectedContent ?? '' } : {},
        );
        setConversionBackups((prev) => ({ ...prev, [spaceId]: backupKept ?? false }));
        if (converted) {
          addToast(
            `"${snapshot?.spaceName ?? name}" now keeps its pages as files and folders. A backup is kept until you confirm in Settings > Spaces.`,
            'info',
          );
        }
        if (!snapshot?.pages.length && isRemoteSpaceId(spaceId)) {
          // Remote space with no persisted content
          setSpaceLoadError(
            `Content for "${name}" could not be loaded. Try refreshing the space from Settings > Spaces.`,
          );
        }
        return snapshot?.pages ?? [];
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load space';
        applySpace(emptySnapshot(name));
        setSpaceLoadError(`Error loading "${name}": ${message}`);
        return [];
      }
    },
    [spaces, applySpace, addToast],
  );

  /** Show a freshly cloned remote space and save it as that space's state */
  const applyClonedSpace = useCallback(
    async (
      spaceId: string,
      name: string,
      clonedPages: PageTreeNode[],
      clonedContents: Record<string, string>,
    ) => {
      const snapshot = clonedSnapshot(clonedPages, name);
      applySpace(snapshot, clonedContents);
      await spaces.saveState(spaceId, snapshot, clonedContents);
    },
    [spaces, applySpace],
  );

  /** Open a fresh demo in its own memory space and make it active. */
  const openDemoSpace = useCallback(async () => {
    const contents = demoPageContents();
    const { manifest } = await spaces.create(DEMO_SPACE_NAME, undefined, {
      kind: 'memory',
      backend: new MemoryBackend(),
      id: DEMO_SPACE_ID,
    });
    await spaces.saveState(DEMO_SPACE_ID, DEMO_SNAPSHOT, contents);
    setSpacesManifest(manifest);
    setUserSpaceId(DEMO_SPACE_ID);
    applySpace(DEMO_SNAPSHOT, contents);
  }, [spaces, applySpace, setSpacesManifest, setUserSpaceId]);

  // Apply loaded state once backend is ready
  const initializedRef = useRef(false);
  // Set once the startup space has loaded, so a deep link is resolved against its pages.
  const [startupDone, setStartupDone] = useState(false);
  useEffect(() => {
    if (!ready || initializedRef.current) return;
    initializedRef.current = true;
    const done = () => setStartupDone(true);

    setSettings(initialSettings);

    // Load spaces manifest and then determine which space to restore
    void spaces.load().then(async (manifest) => {
      // Connect saved folders the browser still allows; the rest wait for a click.
      if (folderHost) {
        try {
          const waiting = await restoreFolderSpaces(spaces, manifest, folderHost);
          waitingFoldersRef.current = waiting;
        } catch {
          // Their spaces stay listed and offer to reconnect when opened.
        }
      }
      setSpacesManifest(manifest);
      const activeId = manifest.activeSpaceId;
      setUserSpaceId(activeId);

      // `?demo` opens the demo whatever is saved; the saved spaces stay as they are.
      if (demoRequestedByUrl()) {
        void openDemoSpace().finally(done);
        return;
      }

      // Open the active space from storage. A saved flat space (the default
      // one included) is converted to folders as it opens (REQ-WS-025).
      if (activeId !== 'default' || persisted) {
        const space = manifest.spaces.find((s) => s.id === activeId);
        void loadAndApplySpaceState(activeId, space?.name ?? 'My Space').finally(done);
      } else if (shouldShowDemo) {
        void openDemoSpace().finally(done);
      } else {
        done();
      }
    }, done);
  }, [
    ready,
    persisted,
    initialSettings,
    shouldShowDemo,
    spaces,
    folderHost,
    setSpacesManifest,
    setUserSpaceId,
    loadAndApplySpaceState,
    openDemoSpace,
  ]);

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

  // Sync the router's git URL prefix setting with the app settings
  useEffect(() => {
    setUseGitPrefix(settings.redirectToGitUrl);
  }, [settings.redirectToGitUrl]);

  // Deep linking: restore route from URL on load (handles 404 redirect + legacy hash)
  // Runs exactly once after initialization has populated pages.
  const routeRestoredRef = useRef(false);
  // True while a deep link is still being resolved, so the URL is not replaced before then.
  const routeResolvingRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current || routeRestoredRef.current || !startupDone) return;
    // Wait until pages are actually populated (or we confirmed there are none)
    if (!hasStarted && !persisted) return;
    routeRestoredRef.current = true;
    routeResolvingRef.current = true;
    const routeDone = () => {
      routeResolvingRef.current = false;
    };

    const parsed = restoreRoute();
    // Read after restoring, so a link that came through the 404 redirect shows its own path.
    const requestedPath = window.location.pathname;

    /** Show the route's page, following the migration map for a page of an old flat space. */
    const showRoutePage = async (spaceId: string, pageId: string, tree: PageTreeNode[]) => {
      if (!spaces.isConnected(spaceId)) {
        // A folder space waiting to be reconnected: show the page once it is.
        routeDone();
        pendingFolderPageRef.current = { spaceId, pageId };
        return;
      }
      let id: string | null = pageId;
      if (!findNode(tree, id)) {
        id = await spaces.movedPageId(spaceId, pageId).catch(() => null);
        if (!id || !findNode(tree, id)) {
          routeDone();
          setNotFound({ path: requestedPath });
          return;
        }
      }
      routeDone();
      const found = id;
      setSelectedPageId(found);
      setPages((prev) => expandToNode(prev, found));
    };

    if (parsed.notFound) {
      routeDone();
      setNotFound({ path: requestedPath });
    } else if (parsed.space === 'docs') {
      routeDone();
      setActiveSpace('docs');
      if (parsed.pageId) setDocsSelectedPageId(parsed.pageId);
    } else if (
      parsed.spaceId &&
      parsed.spaceId !== userSpaceId &&
      // A bare `/` names the default space but no page, so it stays in the current space.
      (parsed.spaceId !== 'default' || parsed.pageId)
    ) {
      // URL points to a different space — try to switch to it
      const switchToExistingSpace = (manifest: SpacesManifest, route: AppRoute) => {
        const space = manifest.spaces.find((s) => s.id === route.spaceId);
        if (!space) {
          routeDone();
          return;
        }
        void spaces
          .switch(route.spaceId)
          .then(async ({ manifest: switched }) => {
            setUserSpaceId(route.spaceId);
            setSpacesManifest(switched);
            const tree = await loadAndApplySpaceState(route.spaceId, space.name);
            if (route.pageId) await showRoutePage(route.spaceId, route.pageId, tree);
            else routeDone();
          })
          .catch(routeDone);
      };

      void spaces
        .load()
        .then((manifest) => {
          // A git URL's path is split between an existing space's subpath and the page.
          const route = resolveRoute(
            parsed,
            manifest.spaces.map((s) => s.id),
          );
          if (route.spaceId === userSpaceId) {
            if (route.pageId) void showRoutePage(route.spaceId, route.pageId, pages);
            else routeDone();
            return;
          }
          const existingSpace = manifest.spaces.find((s) => s.id === route.spaceId);
          if (existingSpace) {
            switchToExistingSpace(manifest, route);
            return;
          }
          // The demo lives in memory, so a reload opens a fresh one at the linked page.
          if (route.spaceId === DEMO_SPACE_ID) {
            void openDemoSpace()
              .then(async () => {
                if (route.pageId)
                  await showRoutePage(DEMO_SPACE_ID, route.pageId, DEMO_SNAPSHOT.pages);
                else routeDone();
              })
              .catch(routeDone);
            return;
          }

          // Space not found — if it's a remote space ID, auto-create it by cloning
          if (isRemoteSpaceId(route.spaceId) && canHostGitClone(backend)) {
            const parsed = parseRemoteSpaceId(route.spaceId);
            if (parsed) {
              const autoSetupGitSpace = async () => {
                const repoName = parsed.repo.split('/').pop() ?? 'Remote';
                const name = parsed.subPath
                  ? `${repoName}/${parsed.subPath.replace(/\/$/, '')}`
                  : repoName;
                const displayName = `${name} (${parsed.branch})`;

                setCloneStatus({ active: true, message: `Cloning ${parsed.repo}...` });
                try {
                  const remoteUrl = normalizeRepoUrl(parsed.repo);
                  const subPath = parsed.subPath || undefined;
                  const {
                    pages: clonedPages,
                    pageContents: clonedContents,
                    access,
                  } = await cloneRemoteRepo(backend, {
                    spaceId: generateRemoteSpaceId(remoteUrl, parsed.branch, subPath),
                    url: parsed.repo,
                    branch: parsed.branch,
                    subPath,
                    corsProxy: gitCorsProxy(),
                    auth: await gitAuth?.(),
                  });

                  const { space: newSpace, manifest: updatedManifest } = await spaces.createRemote(
                    displayName,
                    remoteUrl,
                    parsed.branch,
                    subPath,
                    access,
                  );

                  setSpacesManifest(updatedManifest);
                  setUserSpaceId(newSpace.id);
                  setActiveSpace('user');
                  await applyClonedSpace(newSpace.id, displayName, clonedPages, clonedContents);

                  setCloneStatus({ active: false });

                  if (route.pageId) void showRoutePage(newSpace.id, route.pageId, clonedPages);
                  else routeDone();
                } catch (err) {
                  routeDone();
                  setCloneStatus({ active: false, error: cloneErrorMessage(err, 'Clone failed') });
                }
              };
              void autoSetupGitSpace();
            } else {
              routeDone();
            }
          } else if (!isRemoteSpaceId(route.spaceId)) {
            // A local space that does not exist here.
            routeDone();
            setNotFound({ path: requestedPath });
          } else {
            routeDone();
          }
        })
        .catch(routeDone);
    } else if (parsed.pageId && parsed.spaceId === userSpaceId) {
      void showRoutePage(userSpaceId, parsed.pageId, pages);
    } else {
      routeDone();
    }
  }, [
    startupDone,
    hasStarted,
    pages,
    persisted,
    backend,
    spaces,
    userSpaceId,
    setSpacesManifest,
    setUserSpaceId,
    loadAndApplySpaceState,
    applyClonedSpace,
    openDemoSpace,
    gitAuth,
  ]);

  // Background sync: auto-refresh remote spaces every 5 minutes
  const SYNC_INTERVAL_MS = 5 * 60 * 1000;
  useEffect(() => {
    if (!hasStarted || !spacesManifest || !isRemoteSpaceId(userSpaceId)) return;
    if (!canHostGitClone(backend)) return;

    const spaceMeta = spacesManifest.spaces.find((s) => s.id === userSpaceId);
    if (!spaceMeta?.remoteUrl || !spaceMeta.branch) return;

    // Check if we've synced recently enough
    const lastCheck = lastSyncCheckRef.current[userSpaceId] ?? 0;
    const now = Date.now();
    if (now - lastCheck < SYNC_INTERVAL_MS) return;

    // Also check lastSyncedAt from metadata
    if (spaceMeta.lastSyncedAt) {
      const lastSynced = new Date(spaceMeta.lastSyncedAt).getTime();
      if (now - lastSynced < SYNC_INTERVAL_MS) {
        lastSyncCheckRef.current[userSpaceId] = now;
        return;
      }
    }

    lastSyncCheckRef.current[userSpaceId] = now;

    // Start background sync
    const syncSpace = async () => {
      addToast(`Syncing ${spaceMeta.name}...`, 'info');

      try {
        const oldPageIds = new Set(pages.map((p) => p.id));

        const {
          pages: clonedPages,
          pageContents: clonedContents,
          access,
        } = await cloneRemoteRepo(backend, {
          spaceId: userSpaceId,
          url: spaceMeta.remoteUrl!,
          branch: spaceMeta.branch!,
          subPath: spaceMeta.subPath || undefined,
          corsProxy: gitCorsProxy(),
          auth: await gitAuth?.(),
        });

        const manifest = await spaces.markSynced(userSpaceId, access);

        // Persist the refreshed pages
        await spaces.saveState(
          userSpaceId,
          clonedSnapshot(clonedPages, spaceMeta.name),
          clonedContents,
        );

        // Update UI state
        setPages(clonedPages);
        setPageContents(clonedContents);
        if (!selectedPageId || !clonedContents[selectedPageId]) {
          setSelectedPageId(clonedPages[0]?.id);
        }

        // Update manifest
        setSpacesManifest(manifest);

        // Check if current page was updated
        const newPageIds = new Set(clonedPages.map((p) => p.id));
        const hasChanges =
          oldPageIds.size !== newPageIds.size || [...oldPageIds].some((id) => !newPageIds.has(id));

        if (hasChanges) {
          addToast(`"${spaceMeta.name}" updated with new content.`, 'success');
        } else {
          addToast(`"${spaceMeta.name}" is up to date.`, 'success');
        }
      } catch (err) {
        const message = cloneErrorMessage(err, 'Sync failed');
        addToast(`Sync failed for "${spaceMeta.name}": ${message}`, 'error');
      }
    };

    void syncSpace();
  }, [hasStarted, userSpaceId, spacesManifest, backend, spaces, gitAuth]);

  // Deep linking: update URL when selected page or space changes.
  // Guarded: never fires during initial render or on the landing page.
  useEffect(() => {
    if (!initializedRef.current || !routeRestoredRef.current) return;
    if (!hasStarted) return;
    // Keep the URL that was not found in the address bar, and leave a deep link alone until it resolves.
    if (notFound || routeResolvingRef.current) return;

    if (activeSpace === 'docs') {
      replaceRoute({ space: 'docs', pageId: docsSelectedPageId });
    } else if (selectedPageId) {
      replaceRoute({ space: 'user', spaceId: userSpaceId, pageId: selectedPageId });
    } else if (userSpaceId !== 'default') {
      replaceRoute({ space: 'user', spaceId: userSpaceId });
    } else {
      replaceRoute({ space: 'user', spaceId: 'default' });
    }
  }, [selectedPageId, activeSpace, userSpaceId, docsSelectedPageId, hasStarted, notFound]);

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
            setNotFound(undefined);
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
  // The state save in flight, so a layout change can wait for it to land.
  const persistSaveRef = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!initializedRef.current) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      const state = { pages, favorites, recentPages, selectedPageId, spaceName };
      // Each space, the default one included, saves its own state file.
      persistSaveRef.current = spaces.saveState(userSpaceId, state).catch(() => undefined);
    }, 300);
  }, [pages, favorites, recentPages, selectedPageId, spaceName, spaces, userSpaceId]);

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

  const handlePageSelect = useCallback(
    (id: string) => {
      routeResolvingRef.current = false;
      setNotFound(undefined);
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
    },
    [pages, addToRecent, pageContents, currentReadPage],
  );

  const handlePageToggle = useCallback((id: string) => {
    setPages((prev) => toggleNode(prev, id));
  }, []);

  const handlePageAdd = useCallback(
    (parentId?: string) => {
      if (spaces.isFolder(userSpaceId)) {
        void runFolderChange(() => spaces.addPage(userSpaceId, parentId)).then((change) => {
          if (!change) return;
          setPageContents((prev) => ({ ...prev, [change.pageId]: '' }));
          setSelectedPageId(change.pageId);
          setPages((prev) => expandToNode(prev, change.pageId));
        });
        return;
      }
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
    },
    [hasStarted, currentWritePage, spaces, userSpaceId, runFolderChange],
  );

  const handlePageRename = useCallback(
    (id: string, title: string) => {
      if (spaces.isFolder(userSpaceId)) {
        void runFolderChange(() => spaces.renamePage(userSpaceId, id, title));
        return;
      }
      setPages((prev) => renameNode(prev, id, title));
      // Update recent/favorites references
      setRecentPages((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
      setFavorites((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    },
    [spaces, userSpaceId, runFolderChange],
  );

  const handlePageDelete = useCallback(
    (id: string) => {
      const node = findNode(pages, id);
      if (node) {
        const ancestors = findAncestorIds(pages, id);
        const parentId =
          ancestors && ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
        setTrash((prev) => [
          ...prev,
          { id: node.id, title: node.title, icon: node.icon, parentId },
        ]);
      }
      setPages((prev) => {
        const { tree } = removeNode(prev, id);
        return tree;
      });
      setSelectedPageId((prev) => (prev === id ? undefined : prev));
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      setRecentPages((prev) => prev.filter((r) => r.id !== id));
    },
    [pages],
  );

  const handleRestoreFromTrash = useCallback(
    (id: string) => {
      const item = trash.find((t) => t.id === id);
      if (!item) return;
      setTrash((prev) => prev.filter((t) => t.id !== id));
      if (spaces.isFolder(userSpaceId)) {
        // The page never left the disk: show the tree again without hiding it.
        // The deleted node left `pages`, so pass its icon back in from the trash entry.
        const hidden = new Set(trash.filter((t) => t.id !== id).map((t) => t.id));
        const previous: PageTreeNode[] = [
          ...pagesRef.current,
          {
            id: item.id,
            title: item.title,
            ...(item.icon ? { icon: item.icon } : {}),
            children: [],
          },
        ];
        void spaces.pageTree(userSpaceId, previous, hidden).then(setPages);
        return;
      }
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
    },
    [trash, pages, spaces, userSpaceId],
  );

  const handlePermanentDelete = useCallback(
    (id: string) => {
      setTrash((prev) => prev.filter((t) => t.id !== id));
      setPageContents((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      void currentDeletePage(id);
    },
    [currentDeletePage],
  );

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

  const handleToggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const exists = prev.find((f) => f.id === id);
        if (exists) {
          return prev.filter((f) => f.id !== id);
        }
        const node = findNode(pages, id);
        if (!node) return prev;
        return [...prev, { id: node.id, title: node.title, icon: node.icon }];
      });
    },
    [pages],
  );

  const handlePageDuplicate = useCallback(
    (id: string) => {
      if (spaces.isFolder(userSpaceId)) {
        void runFolderChange(() => spaces.duplicatePage(userSpaceId, id));
        return;
      }
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
    },
    [pageContents, currentWritePage, spaces, userSpaceId, runFolderChange],
  );

  const handlePageMoveToRoot = useCallback(
    (id: string) => {
      if (spaces.isFolder(userSpaceId)) {
        void runFolderChange(() => spaces.movePageToRoot(userSpaceId, id));
        return;
      }
      setPages((prev) => moveNode(prev, id, undefined));
    },
    [spaces, userSpaceId, runFolderChange],
  );

  const handleContentUpdate = useCallback(
    (markdown: string) => {
      if (!selectedPageId) return;
      setPageContents((prev) => ({ ...prev, [selectedPageId]: markdown }));

      // Debounced write to backend
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      pendingWriteRef.current = { pageId: selectedPageId, content: markdown };
      saveTimeoutRef.current = setTimeout(() => {
        void flushPendingWrite();
      }, 500);
    },
    [selectedPageId, flushPendingWrite],
  );

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
    const content = '<p>Start typing here...</p>';
    void (async () => {
      // A new space starts in the folder layout, so it never needs converting.
      if (await spaces.startFolder(userSpaceId, spaceName)) {
        const change = await runFolderChange(() =>
          spaces.addPage(userSpaceId, undefined, 'Welcome', content),
        );
        if (!change) return;
        setPages((prev) =>
          prev.map((p) => (p.id === change.pageId ? { ...p, icon: '\u{1F44B}' } : p)),
        );
        setPageContents({ [change.pageId]: content });
        setSelectedPageId(change.pageId);
        return;
      }
      const firstPage: PageTreeNode = {
        id: `page-${Date.now()}`,
        title: 'Welcome',
        icon: '\u{1F44B}',
        children: [],
      };
      setPages([firstPage]);
      setPageContents({ [firstPage.id]: content });
      setSelectedPageId(firstPage.id);
      void currentWritePage(firstPage.id, content);
    })();
  }, [currentWritePage, spaces, userSpaceId, spaceName, runFolderChange]);

  const handleResetDemo = useCallback(() => {
    // The demo is thrown away on reset, so only save a real space: saving the
    // demo here would race the rebind of its id to a fresh backend.
    if (userSpaceId !== DEMO_SPACE_ID) saveActiveSpace();
    setSpaceLoadError(undefined);
    setActiveSpace('user');
    void openDemoSpace();
  }, [userSpaceId, saveActiveSpace, openDemoSpace]);

  const handleClearAllData = useCallback(() => {
    // Drop any pending save of the old state so it cannot land after the clear
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    setSettings({ ...DEFAULT_SETTINGS });
    setSettingsOpen(false);
    setSpaceLoadError(undefined);
    setActiveSpace('user');
    const freshManifest: SpacesManifest = {
      activeSpaceId: 'default',
      spaces: [{ id: 'default', name: 'My Space', createdAt: new Date().toISOString() }],
    };
    // Clear storage first, then show the demo in its own memory space: the
    // emptied default space is left empty.
    void clearAllData(backend)
      .then(() => saveSettingsToBackend(backend, DEFAULT_SETTINGS))
      .then(() => spaces.save(freshManifest))
      .then(() => openDemoSpace());
  }, [backend, spaces, openDemoSpace]);

  const handleSettingsChange = useCallback(
    (updated: CeptSettings) => {
      setSettings(updated);
      void saveSettingsToBackend(backend, updated);
    },
    [backend],
  );

  const handleResetSettings = useCallback(() => {
    void resetSettingsOnBackend(backend);
    setSettings({ ...DEFAULT_SETTINGS });
  }, [backend]);

  /** Rename a space (and its `space.cept.yaml`); a refused rename changes nothing and says why. */
  const handleSpaceRename = useCallback(
    (id: string, name: string, slug?: string) => {
      void spaces
        .rename(id, name, slug)
        .then((manifest) => {
          if (id === userSpaceId) setSpaceName(name);
          setSpacesManifest(manifest);
        })
        .catch((err: unknown) => {
          addToast(
            `Could not rename the space: ${err instanceof Error ? err.message : String(err)}`,
            'error',
          );
        });
    },
    [spaces, userSpaceId, setSpacesManifest, addToast],
  );

  /**
   * Delete a space, or remove a folder space from Cept (its folder is kept).
   * Deleting the last space leaves a new, empty one (REQ-WS-024).
   */
  const handleDeleteSpace = useCallback(
    (id: string) => {
      waitingFoldersRef.current.delete(id);
      void folderHost?.handles.remove(id).catch(() => undefined);
      void spaces
        .delete(id)
        .then(({ manifest, active }) => {
          setSpacesManifest(manifest);
          if (id === userSpaceId) {
            setUserSpaceId(active.id);
            void loadAndApplySpaceState(active.id, active.name);
          }
        })
        .catch((err: unknown) => {
          addToast(
            `Could not remove the space: ${err instanceof Error ? err.message : String(err)}`,
            'error',
          );
        });
    },
    [
      spaces,
      folderHost,
      userSpaceId,
      setSpacesManifest,
      setUserSpaceId,
      loadAndApplySpaceState,
      addToast,
    ],
  );

  /** Keep a space's conversion to folders: its flat-layout backup is deleted. */
  const handleKeepConversion = useCallback(
    async (id: string) => {
      try {
        await spaces.confirmConversion(id);
        setConversionBackups((prev) => ({ ...prev, [id]: false }));
        addToast('The backup of the old layout was deleted.', 'success');
      } catch (err) {
        addToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [spaces, addToast],
  );

  /** Undo a space's conversion to folders and reopen it in the flat layout. */
  const handleUndoConversion = useCallback(
    async (id: string) => {
      const active = id === userSpaceId;
      try {
        if (active) {
          // Nothing still waiting to be saved may land after the old layout is back.
          await flushPendingWrite();
          if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
          await persistSaveRef.current;
        }
        await spaces.undoConversion(id);
        setConversionBackups((prev) => ({ ...prev, [id]: false }));
        if (active) {
          const name = spacesManifest?.spaces.find((s) => s.id === id)?.name ?? spaceName;
          await loadAndApplySpaceState(id, name);
        }
        addToast('The space is back in its old layout.', 'success');
      } catch (err) {
        addToast(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [
      spaces,
      userSpaceId,
      spacesManifest,
      spaceName,
      flushPendingWrite,
      loadAndApplySpaceState,
      addToast,
    ],
  );

  const handleCreateSpace = useCallback(
    (name: string) => {
      saveActiveSpace();
      setSpaceLoadError(undefined);
      // Switch to user view (important when creating from docs view)
      setActiveSpace('user');
      void spaces.create(name).then(({ space, manifest }) => {
        setSpacesManifest(manifest);
        setUserSpaceId(space.id);
        applySpace(emptySnapshot(name));
      });
    },
    [spaces, saveActiveSpace, setSpacesManifest, setUserSpaceId, applySpace],
  );

  const handleSwitchSpace = useCallback(
    (id: string) => {
      saveActiveSpace();
      setSpaceLoadError(undefined);
      routeResolvingRef.current = false;
      setNotFound(undefined);
      void spaces.switch(id).then(({ space, manifest }) => {
        setUserSpaceId(id);
        setSpacesManifest(manifest);
        void loadAndApplySpaceState(id, space.name);
      });
    },
    [spaces, saveActiveSpace, setSpacesManifest, setUserSpaceId, loadAndApplySpaceState],
  );

  /**
   * Open a space in a picked folder: the space it already has (picking the
   * same folder again goes back to it), or a new folder space. Reads only;
   * nothing is written to the folder (REQ-WS-019).
   */
  const openFolderSpace = useCallback(
    async (
      handle: FileSystemDirectoryHandle,
      folder: StorageBackend,
      subPath: string,
      name: string,
    ) => {
      if (!folderHost) return;
      setPickedFolder(undefined);
      const manifest = await spaces.load();
      const savedId = await findSavedFolder(manifest, folderHost.handles, handle, subPath);
      const saved = savedId ? manifest.spaces.find((s) => s.id === savedId) : undefined;
      if (saved) {
        waitingFoldersRef.current.delete(saved.id);
        spaces.connectFolder(saved, folder);
        setActiveSpace('user');
        handleSwitchSpace(saved.id);
        return;
      }
      saveActiveSpace();
      setSpaceLoadError(undefined);
      setNotFound(undefined);
      setActiveSpace('user');
      const id = `folder-${crypto.randomUUID()}`;
      try {
        await folderHost.handles.save(id, handle);
      } catch {
        addToast(`"${name}" opens now, but will need to be picked again after a reload.`, 'info');
      }
      const created = await spaces.create(name, undefined, {
        kind: 'folder',
        backend: folder,
        ...(subPath ? { subPath } : {}),
        id,
      });
      setSpacesManifest(created.manifest);
      setUserSpaceId(id);
      await loadAndApplySpaceState(id, name);
    },
    [
      folderHost,
      spaces,
      saveActiveSpace,
      handleSwitchSpace,
      setSpacesManifest,
      setUserSpaceId,
      loadAndApplySpaceState,
      addToast,
    ],
  );

  /**
   * "Open folder": show the folder picker (this must run from a click), then
   * open the space the folder is, or ask which space in it to open.
   */
  const handleOpenFolder = useCallback(async () => {
    if (!folderHost) return;
    let handle: FileSystemDirectoryHandle | null;
    try {
      handle = await folderHost.pick();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not open that folder', 'error');
      return;
    }
    if (!handle) return;
    const folder = folderHost.open(handle);
    try {
      const contents = await inspectFolder(folder, handle.name);
      if (contents.root?.error) {
        addToast(
          `"${handle.name}" has a space.cept.yaml Cept cannot use: ${contents.root.error}. Fix that file, or pick a subfolder to open a space inside it.`,
          'error',
        );
      } else if (contents.root) {
        await openFolderSpace(handle, folder, '', contents.root.name);
      } else {
        setPickedFolder({ handle, folder, contents });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Could not read "${handle.name}": ${message}`, 'error');
    }
  }, [folderHost, openFolderSpace, addToast]);

  /** Make the picked folder a space: write its marker, the one file Cept adds, then open it. */
  const handleMakeFolderSpace = useCallback(async () => {
    if (!pickedFolder) return;
    const { handle, folder } = pickedFolder;
    try {
      await initFolderSpace(folder, handle.name);
      await openFolderSpace(handle, folder, '', handle.name);
    } catch (err) {
      setPickedFolder(undefined);
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Could not make "${handle.name}" a space: ${message}`, 'error');
    }
  }, [pickedFolder, openFolderSpace, addToast]);

  /** Open a space found in a subfolder of the picked folder. */
  const handleOpenNestedSpace = useCallback(
    (choice: FolderSpaceChoice) => {
      if (!pickedFolder) return;
      const { handle, folder } = pickedFolder;
      void openFolderSpace(handle, folder, choice.path, choice.name).catch((err: unknown) => {
        addToast(err instanceof Error ? err.message : String(err), 'error');
      });
    },
    [pickedFolder, openFolderSpace, addToast],
  );

  /**
   * Bind `handle` to the folder space being reconnected and show it. A newly
   * picked handle is saved so the next reload can restore it.
   */
  const bindReconnectedFolder = useCallback(
    async (
      target: { id: string; name: string },
      handle: FileSystemDirectoryHandle,
      picked: boolean,
    ) => {
      if (!folderHost) return;
      const space = spacesManifest?.spaces.find((s) => s.id === target.id);
      if (!space) return;
      if (picked) await folderHost.handles.save(target.id, handle).catch(() => undefined);
      setReconnectMismatch(undefined);
      setPickToReconnect(undefined);
      waitingFoldersRef.current.delete(target.id);
      spaces.connectFolder(space, folderHost.open(handle));
      const tree = await loadAndApplySpaceState(target.id, target.name);
      const pending = pendingFolderPageRef.current;
      pendingFolderPageRef.current = null;
      if (pending?.spaceId === target.id && findNode(tree, pending.pageId)) {
        setSelectedPageId(pending.pageId);
        setPages((prev) => expandToNode(prev, pending.pageId));
      }
    },
    [folderHost, spacesManifest, spaces, loadAndApplySpaceState],
  );

  /**
   * Ask the browser again for the folder of the active folder space (this
   * must run from a click). Without a saved handle, the user picks it again,
   * and the picked folder must hold the space: one holding a space with
   * another name is bound only after the user confirms.
   */
  const handleReconnectFolder = useCallback(async () => {
    const target = folderToReconnect;
    if (!target || !folderHost) return;
    const space = spacesManifest?.spaces.find((s) => s.id === target.id);
    if (!space) return;
    let handle: FileSystemDirectoryHandle | null = null;
    if (pickToReconnect !== target.id) {
      handle = waitingFoldersRef.current.get(target.id) ?? null;
      if (!handle) handle = await folderHost.handles.load(target.id).catch(() => null);
    }
    if (handle) {
      if (!(await reconnectFolder(handle))) {
        setPickToReconnect(target.id);
        addToast(
          `Cept was not allowed to open the folder "${handle.name}". Pick the folder to open it.`,
          'error',
        );
        return;
      }
      await bindReconnectedFolder(target, handle, false);
      return;
    }
    setReconnectMismatch(undefined);
    try {
      handle = await folderHost.pick();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not open that folder', 'error');
      return;
    }
    if (!handle) return;
    let found: FolderSpaceChoice | null;
    try {
      found = await folderSpaceAt(folderHost.open(handle), handle.name, space.subPath ?? '');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Could not read "${handle.name}": ${message}`, 'error');
      return;
    }
    if (!found || found.error) {
      const marker = `${space.subPath ? `${space.subPath}/` : ''}space.cept.yaml`;
      addToast(
        `"${handle.name}" is not the folder of "${space.name}": ${found?.error ?? `it has no ${marker}`}`,
        'error',
      );
      return;
    }
    if (found.name !== space.name) {
      setReconnectMismatch({ id: target.id, handle, foundName: found.name });
      return;
    }
    await bindReconnectedFolder(target, handle, true);
  }, [
    folderToReconnect,
    folderHost,
    spacesManifest,
    pickToReconnect,
    bindReconnectedFolder,
    addToast,
  ]);

  const handleImportComplete = useCallback(
    (importedPages: ImportedPage[]) => {
      if (spaces.isFolder(userSpaceId)) {
        void (async () => {
          for (const page of importedPages)
            await runFolderChange(() =>
              spaces.addPage(userSpaceId, undefined, page.title, page.content),
            );
        })();
        if (!hasStarted) setHasStarted(true);
        return;
      }
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
    },
    [currentWritePage, hasStarted, spaces, userSpaceId, runFolderChange],
  );

  const handleOpenImport = useCallback((source: ImportSource) => {
    setImportSource(source);
    setImportDialogOpen(true);
  }, []);

  const handleOpenExport = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleOpenSettings = useCallback((tab: 'settings' | 'about' | 'spaces' = 'settings') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const handleOpenDocs = useCallback(() => {
    setNotFound(undefined);
    setActiveSpace('docs');
    setDocsSelectedPageId('docs-index');
    setDocsPages(DOCS_PAGES);
    pushRoute({ space: 'docs', pageId: 'docs-index' });
  }, []);

  /** Handle "Add Space" from the remote repo form in the wizard. */
  const handleAddRemoteRepo = useCallback(
    async (config: RemoteSpaceConfig) => {
      // Build a human-readable name from the repo URL
      const normalizedUrl = config.url
        .replace(/^https?:\/\/(www\.)?/, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');
      const repoName = normalizedUrl.split('/').pop() ?? 'Remote';
      const name = config.subPath.trim()
        ? `${repoName}/${config.subPath.trim().replace(/\/$/, '')}`
        : repoName;
      const displayName = `${name} (${config.branch || 'main'})`;

      // Cloning needs a backend that can hand isomorphic-git a raw filesystem
      if (!canHostGitClone(backend)) {
        // Fall back to creating an empty space for non-browser backends
        handleCreateSpace(displayName);
        return;
      }

      setCloneStatus({ active: true, message: `Cloning ${normalizedUrl}...` });

      try {
        // Save current space state before switching
        saveActiveSpace();
        setActiveSpace('user');

        // Clone the remote repo and extract pages
        const branch = config.branch || 'main';
        const remoteUrl = normalizeRepoUrl(config.url);
        const subPath = config.subPath.trim() || undefined;
        const {
          pages: clonedPages,
          pageContents: clonedContents,
          access,
        } = await cloneRemoteRepo(backend, {
          spaceId: generateRemoteSpaceId(remoteUrl, branch, subPath),
          url: config.url,
          branch,
          subPath,
          corsProxy: gitCorsProxy(),
          auth: await gitAuth?.(),
        });

        // Create the space with remote metadata
        const { space: newSpace, manifest } = await spaces.createRemote(
          displayName,
          remoteUrl,
          branch,
          subPath,
          access,
        );
        setSpacesManifest(manifest);
        setUserSpaceId(newSpace.id);

        // Show the cloned pages and persist them to the space's storage
        await applyClonedSpace(newSpace.id, displayName, clonedPages, clonedContents);

        setCloneStatus({ active: false });
      } catch (err) {
        setCloneStatus({ active: false, error: cloneErrorMessage(err, 'Clone failed') });
        console.error('Failed to clone remote repo:', err);
      }
    },
    [
      backend,
      spaces,
      gitAuth,
      handleCreateSpace,
      saveActiveSpace,
      setSpacesManifest,
      setUserSpaceId,
      applyClonedSpace,
    ],
  );

  /** Refresh a git space by fetching from the remote into its kept clone. */
  const handleRefreshSpace = useCallback(
    async (spaceId: string) => {
      if (!canHostGitClone(backend)) return;

      // Find the space metadata
      const manifest = await spaces.load();
      const spaceMeta = manifest.spaces.find((s) => s.id === spaceId);
      if (!spaceMeta?.remoteUrl || !spaceMeta.branch) return;

      // Fetch into the space's clone (cloning it first if it is not kept yet)
      let cloned;
      try {
        cloned = await cloneRemoteRepo(backend, {
          spaceId,
          url: spaceMeta.remoteUrl,
          branch: spaceMeta.branch,
          subPath: spaceMeta.subPath,
          corsProxy: gitCorsProxy(),
          auth: await gitAuth?.(),
        });
      } catch (err) {
        addToast(
          `Refresh failed for "${spaceMeta.name}": ${cloneErrorMessage(err, 'Refresh failed')}`,
          'error',
        );
        return;
      }
      const { pages: clonedPages, pageContents: clonedContents, access } = cloned;

      // Update the sync timestamp
      const updatedManifest = await spaces.markSynced(spaceId, access);

      // Persist the refreshed pages
      await spaces.saveState(spaceId, clonedSnapshot(clonedPages, spaceMeta.name), clonedContents);

      // If we're refreshing the currently active space, update the UI state
      if (spaceId === userSpaceId) {
        setPages(clonedPages);
        setPageContents(clonedContents);
        setSelectedPageId(clonedPages[0]?.id);
        setFavorites([]);
        setRecentPages([]);
      }

      // Show the updated lastSyncedAt
      setSpacesManifest(updatedManifest);
    },
    [backend, spaces, userSpaceId, setSpacesManifest, gitAuth, addToast],
  );

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

  // The kinds of space this device can add (REQ-WS-017).
  const addableSources = useMemo(() => spaceSources(probePlatform(), backend), [backend]);

  // Read the listed spaces' stats when settings open, and again when the spaces change.
  useEffect(() => {
    if (!settingsOpen || !spacesManifest) return;
    let cancelled = false;
    void Promise.all(
      spacesManifest.spaces.map(
        async (s) => [s.id, await spaces.inspect(s.id).catch(() => null)] as const,
      ),
    ).then((entries) => {
      if (!cancelled) setSpaceStats(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, spacesManifest, spaces]);

  const spaceInfoList = useMemo((): SpaceInfo[] => {
    const list: SpaceInfo[] = [];
    const defaultSource = `Browser (${backend.type === 'browser' ? 'IndexedDB' : backend.type})`;
    if (spacesManifest) {
      for (const space of spacesManifest.spaces) {
        const kind = space.remoteUrl ? 'remote' : spaces.kindOf(space);
        const spaceSource =
          kind === 'remote'
            ? `Git (${space.readOnly ? 'read-only' : 'sync'})`
            : kind === 'folder'
              ? 'Folder on this device'
              : defaultSource;
        const stats = spaceStats[space.id];
        if (space.id === userSpaceId) {
          // Active space — use live React state for accurate counts
          const contentSize = Object.values(pageContents).reduce(
            (sum, c) => sum + (c?.length ?? 0),
            0,
          );
          list.push({
            id: space.id,
            name: spaceName,
            source: spaceSource,
            pageCount: flattenPages(pages).length,
            contentSize,
            kind,
            ...(stats?.slug !== undefined ? { slug: stats.slug } : {}),
            createdAt: space.createdAt,
            remoteUrl: space.remoteUrl,
            branch: space.branch,
            subPath: space.subPath,
            lastSyncedAt: space.lastSyncedAt,
            conversionBackup: conversionBackups[space.id] ?? false,
          });
        } else {
          list.push({
            id: space.id,
            name: space.name,
            source: spaceSource,
            pageCount: stats?.pageCount ?? null,
            contentSize: stats?.contentSize ?? null,
            kind,
            ...(stats?.slug !== undefined ? { slug: stats.slug } : {}),
            createdAt: space.createdAt,
            remoteUrl: space.remoteUrl,
            branch: space.branch,
            subPath: space.subPath,
            lastSyncedAt: space.lastSyncedAt,
            conversionBackup: conversionBackups[space.id] ?? false,
          });
        }
      }
    } else if (hasStarted || pages.length > 0) {
      // Fallback before manifest loads
      const contentSize = Object.values(pageContents).reduce((sum, c) => sum + (c?.length ?? 0), 0);
      list.push({
        id: 'default',
        name: spaceName,
        source: defaultSource,
        pageCount: flattenPages(pages).length,
        contentSize,
      });
    }
    list.push(DOCS_SPACE_INFO);
    return list;
  }, [
    hasStarted,
    pages,
    pageContents,
    spaceName,
    spacesManifest,
    userSpaceId,
    backend.type,
    conversionBackups,
    spaceStats,
    spaces,
  ]);

  const commandItems: CommandItem[] = useMemo(
    () => [
      {
        id: 'new-page',
        title: 'New Page',
        icon: '\u{1F4C4}',
        category: 'Pages',
        action: () => handlePageAdd(),
      },
      {
        id: 'search',
        title: 'Search',
        icon: '\u{1F50D}',
        category: 'Navigation',
        action: () => {
          setCommandPaletteOpen(false);
          setSearchOpen(true);
        },
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        icon: '\u{1F4CB}',
        category: 'View',
        action: () => {
          setSidebarOpen((p) => !p);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'import-notion',
        title: 'Import from Notion',
        icon: '\u{1F4E5}',
        category: 'Import / Export',
        action: () => {
          setCommandPaletteOpen(false);
          handleOpenImport('notion');
        },
      },
      {
        id: 'import-obsidian',
        title: 'Import from Obsidian',
        icon: '\u{1F4E5}',
        category: 'Import / Export',
        action: () => {
          setCommandPaletteOpen(false);
          handleOpenImport('obsidian');
        },
      },
      {
        id: 'export-page',
        title: 'Export Current Page',
        icon: '\u{1F4E4}',
        category: 'Import / Export',
        action: () => {
          setCommandPaletteOpen(false);
          handleOpenExport();
        },
      },
      {
        id: 'manage-spaces',
        title: 'Manage Spaces',
        icon: '\u{1F4C2}',
        category: 'Spaces',
        action: () => {
          setCommandPaletteOpen(false);
          handleOpenSettings('spaces');
        },
      },
    ],
    [handlePageAdd, handleOpenExport, handleOpenSettings, handleOpenImport],
  );

  const currentContent = selectedPageId ? (pageContents[selectedPageId] ?? '') : '';
  const contentLoaded = selectedPageId ? selectedPageId in pageContents : false;
  const docsSelectedNode = docsSelectedPageId ? findNode(docsPages, docsSelectedPageId) : undefined;
  const selectedNode = selectedPageId ? findNode(pages, selectedPageId) : undefined;
  const showOnboarding = !hasStarted;

  const isDocsActive = activeSpace === 'docs';

  // Show loading state while backend loads persisted data
  if (!ready) {
    return (
      <div
        className="h-dvh flex items-center justify-center bg-white dark:bg-gray-900 text-gray-500"
        data-testid="app-loading"
      >
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
          <div
            className="cept-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            data-testid="sidebar-backdrop"
          />
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
            onOpenTrash={() => {
              setShowTrash(true);
              setSelectedPageId(undefined);
            }}
            spaceName={spaceName}
            onSpaceRename={(name) => handleSpaceRename(userSpaceId, name)}
            spaces={spaceInfoList.map((s) => ({ id: s.id, name: s.name }))}
            activeSpaceId={userSpaceId}
            onSwitchSpace={(id) => {
              if (id === DOCS_SPACE_INFO.id) {
                handleOpenDocs();
              } else {
                handleSwitchSpace(id);
              }
            }}
            themeMode={settings.themeMode}
            onThemeModeChange={(mode) => handleSettingsChange({ ...settings, themeMode: mode })}
          />
        )}
        {sidebarOpen && isDocsActive && (
          <Sidebar
            pages={docsPages}
            favorites={[]}
            recentPages={[]}
            trash={[]}
            selectedPageId={docsSelectedPageId}
            onPageSelect={handleDocsPageSelect}
            onPageToggle={handleDocsPageToggle}
            onPageAdd={() => {
              /* read-only */
            }}
            onPageRename={() => {
              /* read-only */
            }}
            onPageDuplicate={() => {
              /* read-only */
            }}
            onPageDelete={() => {
              /* read-only */
            }}
            onPageMoveToRoot={() => {
              /* read-only */
            }}
            onToggleFavorite={() => {
              /* read-only */
            }}
            onRestoreFromTrash={() => {
              /* read-only */
            }}
            onPermanentDelete={() => {
              /* read-only */
            }}
            onEmptyTrash={() => {
              /* read-only */
            }}
            onSearch={() => setSearchOpen(true)}
            onOpenSettings={handleOpenSettings}
            onOpenDocs={handleOpenDocs}
            readOnly
            spaceName={DOCS_SPACE_INFO.name}
            spaces={spaceInfoList.map((s) => ({ id: s.id, name: s.name }))}
            activeSpaceId={DOCS_SPACE_INFO.id}
            onSwitchSpace={(id) => {
              if (id === DOCS_SPACE_INFO.id) {
                handleOpenDocs();
              } else {
                setActiveSpace('user');
                handleSwitchSpace(id);
              }
            }}
            themeMode={settings.themeMode}
            onThemeModeChange={(mode) => handleSettingsChange({ ...settings, themeMode: mode })}
          />
        )}
        <section className="flex-1 min-w-0 p-4 md:p-8 overflow-y-auto">
          {isDocsActive ? (
            docsSelectedPageId && DOCS_CONTENT[docsSelectedPageId] ? (
              <>
                <div className="cept-docs-banner" data-testid="docs-banner">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="2" y="1" width="12" height="14" rx="1" />
                    <path d="M5 5h6M5 8h6M5 11h3" />
                  </svg>
                  <span>Read-only &mdash; sourced from docs/ in the Git repository</span>
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
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                    </a>
                  )}
                </div>
                <CeptEditor
                  key={`docs-${docsSelectedPageId}`}
                  content={resolveDocsContent(DOCS_CONTENT[docsSelectedPageId])}
                  placeholder=""
                  onUpdate={() => {
                    /* read-only */
                  }}
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
          ) : notFound ? (
            <NotFoundPage
              path={notFound.path}
              onGoHome={() => {
                setNotFound(undefined);
                setShowTrash(false);
              }}
            />
          ) : folderToReconnect && folderToReconnect.id === userSpaceId ? (
            <div className="cept-space-error" data-testid="folder-reconnect">
              <svg
                width="32"
                height="32"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M1.5 3.5h5l1.5 2h6.5v8h-13z" />
              </svg>
              <h2>Reconnect “{folderToReconnect.name}”</h2>
              <p>
                {folderHost
                  ? 'This space is a folder on this device. Your browser asks again before Cept can open it.'
                  : 'This space is a folder on this device, and this browser cannot open folders.'}
              </p>
              {reconnectMismatch?.id === folderToReconnect.id && (
                <p data-testid="folder-reconnect-mismatch">
                  “{reconnectMismatch.handle.name}” holds the space “{reconnectMismatch.foundName}”,
                  not “{folderToReconnect.name}”. Use it for this space only if it is the same
                  folder.
                </p>
              )}
              <div className="cept-space-error-actions">
                {folderHost && reconnectMismatch?.id === folderToReconnect.id && (
                  <button
                    className="cept-space-error-btn"
                    onClick={() =>
                      void bindReconnectedFolder(folderToReconnect, reconnectMismatch.handle, true)
                    }
                    data-testid="folder-reconnect-confirm"
                  >
                    Use “{reconnectMismatch.handle.name}” anyway
                  </button>
                )}
                {folderHost && (
                  <button
                    className="cept-space-error-btn"
                    onClick={() => void handleReconnectFolder()}
                    data-testid="folder-reconnect-btn"
                  >
                    {reconnectMismatch?.id === folderToReconnect.id
                      ? 'Pick another folder'
                      : pickToReconnect === folderToReconnect.id
                        ? 'Pick the folder'
                        : 'Reconnect folder'}
                  </button>
                )}
                <button
                  className="cept-space-error-btn cept-space-error-btn--secondary"
                  onClick={() => handleSwitchSpace('default')}
                  data-testid="folder-reconnect-switch-default"
                >
                  Switch to default space
                </button>
              </div>
            </div>
          ) : spaceLoadError ? (
            <div className="cept-space-error" data-testid="space-load-error">
              <svg
                width="32"
                height="32"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="7" />
                <path d="M8 4v5M8 11v1" />
              </svg>
              <h2>Space content unavailable</h2>
              <p>{spaceLoadError}</p>
              <div className="cept-space-error-actions">
                <button
                  className="cept-space-error-btn"
                  onClick={() => handleOpenSettings('spaces')}
                  data-testid="space-error-settings"
                >
                  Open Settings
                </button>
                <button
                  className="cept-space-error-btn cept-space-error-btn--secondary"
                  onClick={() => {
                    setSpaceLoadError(undefined);
                    handleSwitchSpace('default');
                  }}
                  data-testid="space-error-switch-default"
                >
                  Switch to default space
                </button>
              </div>
            </div>
          ) : showOnboarding ? (
            <LandingPage
              onStartWriting={handleStartWriting}
              onTryDemo={handleResetDemo}
              onOpenDocs={handleOpenDocs}
              onOpenFolder={folderHost ? () => void handleOpenFolder() : undefined}
            />
          ) : showTrash ? (
            <div className="cept-trash-view" data-testid="trash-view">
              <h2 className="cept-trash-view-title">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
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
                      <div
                        key={item.id}
                        className="cept-trash-view-item"
                        data-testid={`trash-item-${item.id}`}
                      >
                        <span className="cept-trash-view-item-icon">
                          {item.icon ?? '\u{1F4C4}'}
                        </span>
                        <span className="cept-trash-view-item-title">
                          {item.title || 'Untitled'}
                        </span>
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
                <div className="text-center text-gray-400 mt-8" data-testid="page-loading">
                  Loading...
                </div>
              )}
              {selectedNode.children.length > 0 && (
                <FolderView children={selectedNode.children} onPageSelect={handlePageSelect} />
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
        onResultSelect={(pageId) => {
          handlePageSelect(pageId);
          setSearchOpen(false);
        }}
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
        onKeepConversion={(id) => void handleKeepConversion(id)}
        onUndoConversion={(id) => void handleUndoConversion(id)}
        onSpaceRename={handleSpaceRename}
        onSwitchSpace={handleSwitchSpace}
        onClearAllData={handleClearAllData}
        onRecreateDemoSpace={handleResetDemo}
        onOpenAddSpaceWizard={() => setAddSpaceWizardOpen(true)}
        onImportNotion={() => handleOpenImport('notion')}
        onImportObsidian={() => handleOpenImport('obsidian')}
        onExport={handleOpenExport}
        backend={backend}
        onNavigateToPage={(pageId) => {
          setSettingsOpen(false);
          handlePageSelect(pageId);
        }}
        onRefreshSpace={handleRefreshSpace}
      />
      <AddSpaceWizardModal
        isOpen={addSpaceWizardOpen}
        sources={addableSources}
        onClose={() => setAddSpaceWizardOpen(false)}
        onCreateSpace={(name) => {
          handleCreateSpace(name);
          setAddSpaceWizardOpen(false);
          setSettingsOpen(false);
        }}
        onAddRemoteRepo={(config) => {
          handleAddRemoteRepo(config);
          setAddSpaceWizardOpen(false);
          setSettingsOpen(false);
        }}
        onOpenFolder={
          folderHost
            ? () => {
                // The picker opens first, while this is still the user's click.
                void handleOpenFolder();
                setAddSpaceWizardOpen(false);
                setSettingsOpen(false);
              }
            : undefined
        }
      />
      {pickedFolder && (
        <OpenFolderDialog
          folderName={pickedFolder.handle.name}
          spaces={pickedFolder.contents.nested}
          onOpenSpace={handleOpenNestedSpace}
          onMakeSpace={() => void handleMakeFolderSpace()}
          onCancel={() => setPickedFolder(undefined)}
        />
      )}
      <ImportDialog
        isOpen={importDialogOpen}
        source={importSource}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        page={
          selectedPageId && selectedNode
            ? ({
                title: selectedNode.title,
                markdown: pageContents[selectedPageId] ?? '',
                path: `pages/${selectedPageId}.md`,
              } as PageContent)
            : null
        }
      />
      {cloneStatus.active && (
        <div className="cept-clone-overlay" data-testid="clone-status">
          <div className="cept-clone-dialog">
            <div className="cept-clone-spinner" />
            <p>{cloneStatus.message ?? 'Cloning repository...'}</p>
          </div>
        </div>
      )}
      {cloneStatus.error && (
        <div className="cept-clone-overlay" data-testid="clone-error">
          <div className="cept-clone-dialog cept-clone-dialog--error">
            <p>Clone failed: {cloneStatus.error}</p>
            <button
              className="cept-wizard-primary-btn"
              onClick={() => setCloneStatus({ active: false })}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <Toast messages={toastMessages} onDismiss={dismissToast} />
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
