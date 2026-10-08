import { useState, useCallback, useEffect, useRef } from 'react';
import type { RemoteSpace, StorageBackend } from '@cept/core';
import { FileBrowser } from './FileBrowser.js';
import { ThemeToggle } from './ThemeToggle.js';
import { GitHubAccountSection } from './GitHubAccountSection.js';
import { DiscoveredSpacesSection } from './DiscoveredSpacesSection.js';
import type { DiscoveredSpacesState } from './discovered-spaces.js';
import { DOCS_SPACE_ID } from '../docs/docs-space-id.js';
import { remoteWebUrl } from '../storage/git-space.js';

export type ThemeMode = 'dark' | 'system' | 'light';

export interface CeptSettings {
  autoSave: boolean;
  showDemoContent: boolean;
  /** When true, URLs for git-backed spaces use the shareable /g/ prefix instead of /s/. Default: true */
  redirectToGitUrl: boolean;
  themeMode: ThemeMode;
}

/** Whether this build opens the demo by default (the VITE_DEMO_DEFAULT build flag). */
function demoByDefault(): boolean {
  return typeof __DEMO_DEFAULT__ !== 'undefined' && __DEMO_DEFAULT__;
}

export const DEFAULT_SETTINGS: CeptSettings = {
  autoSave: true,
  showDemoContent: demoByDefault(),
  redirectToGitUrl: true,
  themeMode: 'system',
};

const SETTINGS_KEY = 'cept-settings';

export function loadSettings(): CeptSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: CeptSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // silently ignore
  }
}

export function resetSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // silently ignore
  }
}

/** Where a space's data lives, which decides what removing it does. */
export type SpaceKind = 'app' | 'memory' | 'folder' | 'remote';

export interface SpaceInfo {
  id: string;
  name: string;
  source: string;
  /** Null when not known, as for a folder space whose folder is not connected. */
  pageCount: number | null;
  /** Bytes in the space's pages; null when not known. */
  contentSize: number | null;
  /** Absent means `app`. */
  kind?: SpaceKind;
  /** The slug in the space's `space.cept.yaml`; absent when it has none. */
  slug?: string;
  createdAt?: string;
  remoteUrl?: string;
  branch?: string;
  subPath?: string;
  lastSyncedAt?: string;
  /** The space was converted from the flat layout and its backup is still kept. */
  conversionBackup?: boolean;
}

export interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: 'about' | 'settings' | 'spaces';
  /** Open the spaces tab on this space's details. */
  initialSpaceId?: string;
  settings: CeptSettings;
  spaces: SpaceInfo[];
  activeSpaceId?: string;
  onClose: () => void;
  onSettingsChange: (settings: CeptSettings) => void;
  onResetSettings: () => void;
  onDeleteSpace: (id: string) => void;
  /** Keep a converted space's new layout and delete its backup. */
  onKeepConversion?: (id: string) => void;
  /** Put a converted space's old layout back from its backup. */
  onUndoConversion?: (id: string) => void;
  /** Rename a space; `slug` also changes the slug in its `space.cept.yaml`. */
  onSpaceRename: (id: string, name: string, slug?: string) => void;
  onSwitchSpace: (id: string) => void;
  onClearAllData: () => void;
  onRecreateDemoSpace: () => void;
  onOpenAddSpaceWizard?: () => void;
  onImportNotion?: () => void;
  onImportObsidian?: () => void;
  onExport?: () => void;
  backend?: StorageBackend;
  onNavigateToPage?: (pageId: string) => void;
  onRefreshSpace?: (id: string) => Promise<void>;
  /** Spaces found in the signed-in account's repositories; null or absent when not signed in. */
  discovered?: DiscoveredSpacesState | null;
  /** Clone a discovered space, add it and switch to it. */
  onOpenDiscovered?: (space: RemoteSpace) => void;
  /** Clone a discovered space and add it without switching. */
  onPinDiscovered?: (space: RemoteSpace) => void;
}

export function SettingsModal({
  isOpen,
  initialTab = 'settings',
  initialSpaceId,
  settings,
  spaces,
  activeSpaceId,
  onClose,
  onSettingsChange,
  onResetSettings,
  onDeleteSpace,
  onKeepConversion,
  onUndoConversion,
  onSpaceRename,
  onSwitchSpace,
  onClearAllData,
  onRecreateDemoSpace,
  onOpenAddSpaceWizard,
  onImportNotion,
  onImportObsidian,
  onExport,
  backend,
  onNavigateToPage,
  onRefreshSpace,
  discovered,
  onOpenDiscovered,
  onPinDiscovered,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'about' | 'settings' | 'spaces'>(initialTab);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [browsingSpaceId, setBrowsingSpaceId] = useState<string | null>(null);
  const [refreshingSpaceId, setRefreshingSpaceId] = useState<string | null>(null);
  const [removingSpaceId, setRemovingSpaceId] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSelectedSpaceId(initialTab === 'spaces' ? (initialSpaceId ?? null) : null);
      setBrowsingSpaceId(null);
      setRemovingSpaceId(null);
    }
  }, [isOpen, initialTab, initialSpaceId]);

  const handleRefreshSpace = useCallback(
    async (spaceId: string) => {
      if (!onRefreshSpace || refreshingSpaceId) return;
      setRefreshingSpaceId(spaceId);
      try {
        await onRefreshSpace(spaceId);
      } finally {
        setRefreshingSpaceId(null);
      }
    },
    [onRefreshSpace, refreshingSpaceId],
  );

  const flashSaved = useCallback(() => {
    setSavedIndicator(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedIndicator(false), 1500);
  }, []);

  const handleSettingChange = useCallback(
    <K extends keyof CeptSettings>(key: K, value: CeptSettings[K]) => {
      const updated = { ...settings, [key]: value };
      onSettingsChange(updated);
      flashSaved();
    },
    [settings, onSettingsChange, flashSaved],
  );

  if (!isOpen) return null;

  const selectedSpace = selectedSpaceId ? spaces.find((s) => s.id === selectedSpaceId) : null;
  const removingSpace = removingSpaceId ? spaces.find((s) => s.id === removingSpaceId) : null;

  return (
    <div className="cept-settings-overlay" onClick={onClose} data-testid="settings-modal">
      <div className="cept-settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="cept-settings-header">
          <h2>Settings</h2>
          {savedIndicator && (
            <span className="cept-settings-saved" data-testid="settings-saved-indicator">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3,8 7,12 13,4" />
              </svg>
              Saved
            </span>
          )}
          <button
            className="cept-settings-close"
            onClick={onClose}
            data-testid="settings-close"
            title="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <div className="cept-settings-body">
          <nav className="cept-settings-tabs" data-testid="settings-tabs">
            <button
              className={`cept-settings-tab ${activeTab === 'settings' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setSelectedSpaceId(null);
              }}
              data-testid="settings-tab-settings"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
              </svg>
              Settings
            </button>
            <button
              className={`cept-settings-tab ${activeTab === 'spaces' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('spaces');
                setSelectedSpaceId(null);
              }}
              data-testid="settings-tab-spaces"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
              Spaces
            </button>
            <button
              className={`cept-settings-tab ${activeTab === 'about' ? 'is-active' : ''}`}
              onClick={() => {
                setActiveTab('about');
                setSelectedSpaceId(null);
              }}
              data-testid="settings-tab-about"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="6.5" />
                <path d="M8 7v4M8 4.5v.5" />
              </svg>
              About
            </button>
          </nav>

          <div className="cept-settings-content">
            {activeTab === 'settings' && (
              <div data-testid="settings-panel-settings">
                <h3 className="cept-settings-section-title">Appearance</h3>
                <div className="cept-settings-toggle-row" data-testid="setting-theme-mode">
                  <div className="cept-settings-toggle-label">
                    <span className="cept-settings-toggle-name">Theme</span>
                    <span className="cept-settings-toggle-desc">
                      Choose dark, light, or match your system
                    </span>
                  </div>
                  <ThemeToggle
                    value={settings.themeMode}
                    onChange={(mode) => handleSettingChange('themeMode', mode)}
                  />
                </div>

                <div className="cept-settings-section-divider" />
                <h3 className="cept-settings-section-title">Editor</h3>
                <label className="cept-settings-toggle-row" data-testid="setting-auto-save">
                  <div className="cept-settings-toggle-label">
                    <span className="cept-settings-toggle-name">Auto-save</span>
                    <span className="cept-settings-toggle-desc">
                      Automatically save changes when you stop editing
                    </span>
                  </div>
                  <button
                    className={`cept-settings-switch ${settings.autoSave ? 'is-on' : ''}`}
                    onClick={() => handleSettingChange('autoSave', !settings.autoSave)}
                    role="switch"
                    aria-checked={settings.autoSave}
                    data-testid="setting-auto-save-toggle"
                  >
                    <span className="cept-settings-switch-thumb" />
                  </button>
                </label>

                <label className="cept-settings-toggle-row" data-testid="setting-redirect-git-url">
                  <div className="cept-settings-toggle-label">
                    <span className="cept-settings-toggle-name">Shareable git URLs</span>
                    <span className="cept-settings-toggle-desc">
                      Use /g/ URLs for git-backed spaces so shared links auto-create the space for
                      recipients
                    </span>
                  </div>
                  <button
                    className={`cept-settings-switch ${settings.redirectToGitUrl ? 'is-on' : ''}`}
                    onClick={() =>
                      handleSettingChange('redirectToGitUrl', !settings.redirectToGitUrl)
                    }
                    role="switch"
                    aria-checked={settings.redirectToGitUrl}
                    data-testid="setting-redirect-git-url-toggle"
                  >
                    <span className="cept-settings-switch-thumb" />
                  </button>
                </label>

                <div className="cept-settings-section-divider" />
                <h3 className="cept-settings-section-title">Content</h3>
                <label className="cept-settings-toggle-row" data-testid="setting-show-demo">
                  <div className="cept-settings-toggle-label">
                    <span className="cept-settings-toggle-name">Show demo content</span>
                    <span className="cept-settings-toggle-desc">
                      Load a demo space with sample pages on first launch
                    </span>
                  </div>
                  <button
                    className={`cept-settings-switch ${settings.showDemoContent ? 'is-on' : ''}`}
                    onClick={() =>
                      handleSettingChange('showDemoContent', !settings.showDemoContent)
                    }
                    role="switch"
                    aria-checked={settings.showDemoContent}
                    data-testid="setting-show-demo-toggle"
                  >
                    <span className="cept-settings-switch-thumb" />
                  </button>
                </label>

                <GitHubAccountSection />

                <div className="cept-settings-section-divider" />
                <button
                  className="cept-settings-danger-btn"
                  onClick={() => {
                    onResetSettings();
                    flashSaved();
                  }}
                  data-testid="reset-settings-btn"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M2 8a6 6 0 0111.46-2.46M14 8a6 6 0 01-11.46 2.46" />
                    <polyline points="2,3 2,6.5 5.5,6.5" />
                    <polyline points="14,13 14,9.5 10.5,9.5" />
                  </svg>
                  Reset settings to defaults
                </button>
              </div>
            )}

            {activeTab === 'spaces' && removingSpace && (
              <RemoveSpaceConfirm
                space={removingSpace}
                isLast={spaces.filter((s) => s.id !== DOCS_SPACE_ID).length <= 1}
                onCancel={() => setRemovingSpaceId(null)}
                onConfirm={() => {
                  setRemovingSpaceId(null);
                  if (selectedSpaceId === removingSpace.id) setSelectedSpaceId(null);
                  onDeleteSpace(removingSpace.id);
                }}
              />
            )}

            {activeTab === 'spaces' && !removingSpace && !selectedSpace && (
              <div data-testid="settings-panel-spaces">
                <h3 className="cept-settings-section-title">Your Spaces</h3>
                {spaces.length === 0 ? (
                  <p className="cept-settings-empty">No spaces yet.</p>
                ) : (
                  <div className="cept-settings-space-list">
                    {spaces.map((space) => (
                      <div
                        key={space.id}
                        className="cept-settings-space-row"
                        data-testid={`space-item-${space.id}`}
                      >
                        <div
                          className={`cept-settings-space-info-block ${space.id === activeSpaceId ? 'is-active' : ''}`}
                        >
                          <div className="cept-settings-space-info">
                            <span className="cept-settings-space-name">
                              {space.name}
                              {space.id === activeSpaceId && (
                                <span
                                  className="cept-settings-space-badge"
                                  data-testid="active-space-badge"
                                >
                                  {' '}
                                  (active)
                                </span>
                              )}
                            </span>
                            <span className="cept-settings-space-meta">
                              {space.source}
                              {space.branch && (
                                <>
                                  {' '}
                                  &middot;{' '}
                                  <span
                                    className="cept-settings-space-branch"
                                    data-testid={`space-branch-${space.id}`}
                                  >
                                    {space.branch}
                                  </span>
                                </>
                              )}{' '}
                              &middot; {formatPageCount(space.pageCount)} &middot;{' '}
                              {formatSize(space.contentSize)}
                            </span>
                          </div>
                        </div>
                        <div className="cept-settings-space-actions">
                          {space.id !== activeSpaceId && (
                            <button
                              className="cept-settings-icon-btn"
                              onClick={() => {
                                onSwitchSpace(space.id);
                                onClose();
                              }}
                              title="Switch to this space"
                              data-testid={`switch-space-${space.id}`}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d="M6 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6" />
                                <path d="M2 8h8M7 5l3 3-3 3" />
                              </svg>
                            </button>
                          )}
                          {space.remoteUrl && onRefreshSpace && space.id !== DOCS_SPACE_ID && (
                            <button
                              className="cept-settings-icon-btn"
                              onClick={() => handleRefreshSpace(space.id)}
                              disabled={refreshingSpaceId === space.id}
                              title={
                                refreshingSpaceId === space.id
                                  ? 'Syncing...'
                                  : 'Refresh from remote'
                              }
                              data-testid={`refresh-space-${space.id}`}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className={refreshingSpaceId === space.id ? 'cept-spin' : ''}
                              >
                                <path d="M14 2v4h-4M2 14v-4h4" />
                                <path d="M13.46 5.54A6 6 0 002.54 10.46M2.54 10.46A6 6 0 0013.46 5.54" />
                              </svg>
                            </button>
                          )}
                          {space.id !== DOCS_SPACE_ID && (
                            <button
                              className="cept-settings-icon-btn cept-settings-icon-btn--danger"
                              onClick={() => setRemovingSpaceId(space.id)}
                              title={removalLabel(space)}
                              data-testid={`delete-space-${space.id}`}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              >
                                <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
                              </svg>
                            </button>
                          )}
                          <button
                            className="cept-settings-icon-btn"
                            onClick={() => setSelectedSpaceId(space.id)}
                            title="Space settings"
                            data-testid={`space-settings-${space.id}`}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 4l4 4-4 4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="cept-settings-section-divider" />
                <button
                  className="cept-settings-action-btn"
                  onClick={onOpenAddSpaceWizard}
                  data-testid="create-space-btn"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Create new space
                </button>

                {discovered && (
                  <DiscoveredSpacesSection
                    discovered={discovered}
                    addedSpaceIds={new Set(spaces.map((s) => s.id))}
                    onOpen={onOpenDiscovered}
                    onPin={onPinDiscovered}
                  />
                )}

                {(onImportNotion || onImportObsidian || onExport) && (
                  <>
                    <div className="cept-settings-section-divider" />
                    <h3 className="cept-settings-section-title">Import / Export</h3>
                    <div className="cept-settings-actions">
                      {onImportNotion && (
                        <button
                          className="cept-settings-action-btn"
                          disabled
                          title="Coming soon"
                          data-testid="import-notion-btn"
                        >
                          Import from Notion (coming soon)
                        </button>
                      )}
                      {onImportObsidian && (
                        <button
                          className="cept-settings-action-btn"
                          disabled
                          title="Coming soon"
                          data-testid="import-obsidian-btn"
                        >
                          Import from Obsidian (coming soon)
                        </button>
                      )}
                      {onExport && (
                        <button
                          className="cept-settings-action-btn"
                          onClick={() => {
                            onExport();
                            onClose();
                          }}
                          data-testid="export-page-btn"
                        >
                          Export current page
                        </button>
                      )}
                    </div>
                  </>
                )}

                <div className="cept-settings-section-divider" />
                <h3 className="cept-settings-section-title">Data</h3>
                <div className="cept-settings-actions">
                  {settings.showDemoContent && (
                    <button
                      className="cept-settings-action-btn"
                      onClick={onRecreateDemoSpace}
                      data-testid="recreate-demo-btn"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M2 8a6 6 0 0111.46-2.46M14 8a6 6 0 01-11.46 2.46" />
                        <polyline points="2,3 2,6.5 5.5,6.5" />
                        <polyline points="14,13 14,9.5 10.5,9.5" />
                      </svg>
                      Recreate demo space
                    </button>
                  )}
                  <button
                    className="cept-settings-danger-btn"
                    onClick={onClearAllData}
                    data-testid="clear-all-data-btn"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
                    </svg>
                    Clear all data (includes settings)
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'spaces' && !removingSpace && selectedSpace && !browsingSpaceId && (
              <SpaceDetails
                space={selectedSpace}
                onBack={() => setSelectedSpaceId(null)}
                onRename={(name, slug) => onSpaceRename(selectedSpace.id, name, slug)}
                onKeepConversion={
                  onKeepConversion ? () => onKeepConversion(selectedSpace.id) : undefined
                }
                onUndoConversion={
                  onUndoConversion ? () => onUndoConversion(selectedSpace.id) : undefined
                }
                onDelete={() => setRemovingSpaceId(selectedSpace.id)}
                onBrowseFiles={
                  backend && selectedSpace.id !== DOCS_SPACE_ID
                    ? () => setBrowsingSpaceId(selectedSpace.id)
                    : undefined
                }
                onRefresh={
                  selectedSpace.remoteUrl && onRefreshSpace && selectedSpace.id !== DOCS_SPACE_ID
                    ? () => handleRefreshSpace(selectedSpace.id)
                    : undefined
                }
                isRefreshing={refreshingSpaceId === selectedSpace.id}
              />
            )}

            {activeTab === 'spaces' && browsingSpaceId && backend && (
              <FileBrowser
                backend={backend}
                onNavigateToPage={onNavigateToPage}
                onClose={() => setBrowsingSpaceId(null)}
              />
            )}

            {activeTab === 'about' && (
              <div className="cept-settings-about" data-testid="settings-panel-about">
                <div className="cept-settings-about-logo">C</div>
                <h3>Cept</h3>
                <p>A Notion-inspired app that runs entirely in your browser.</p>
                <p className="cept-settings-about-version" data-testid="about-version">
                  Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev'}
                  {typeof __COMMIT_SHA__ !== 'undefined' && __COMMIT_SHA__ && (
                    <span className="cept-settings-about-commit">
                      {' '}
                      (
                      <a
                        href={`https://github.com/nsheaps/cept/commit/${__COMMIT_SHA__}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {__COMMIT_SHA__.slice(0, 7)}
                      </a>
                      )
                    </span>
                  )}
                </p>
                <div className="cept-settings-section-divider" />
                <p className="cept-settings-about-footer">Built with React, TipTap, and love.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpaceDetails({
  space,
  onBack,
  onDelete,
  onRename,
  onBrowseFiles,
  onRefresh,
  isRefreshing,
  onKeepConversion,
  onUndoConversion,
}: {
  space: SpaceInfo;
  onBack: () => void;
  onDelete: () => void;
  onRename: (name: string, slug?: string) => void;
  onKeepConversion?: () => void;
  onUndoConversion?: () => void;
  onBrowseFiles?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(space.name);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [editSlug, setEditSlug] = useState(space.slug ?? '');
  const saveSlug = () => {
    const slug = editSlug.trim();
    if (slug && slug !== space.slug) onRename(space.name, slug);
    setEditingSlug(false);
  };
  const remoteHref = space.remoteUrl
    ? remoteWebUrl({ remoteUrl: space.remoteUrl, branch: space.branch, subPath: space.subPath })
    : null;

  return (
    <div data-testid={`space-details-${space.id}`}>
      <button className="cept-settings-back-btn" onClick={onBack} data-testid="space-details-back">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M10 4l-4 4 4 4" />
        </svg>
        Back
      </button>
      {editing ? (
        <div className="cept-settings-rename-row">
          <input
            className="cept-settings-rename-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editName.trim()) {
                onRename(editName.trim());
                setEditing(false);
              }
              if (e.key === 'Escape') {
                setEditName(space.name);
                setEditing(false);
              }
            }}
            autoFocus
            data-testid="space-rename-input"
          />
          <button
            className="cept-settings-action-btn"
            onClick={() => {
              if (editName.trim()) {
                onRename(editName.trim());
                setEditing(false);
              }
            }}
            data-testid="space-rename-save"
          >
            Save
          </button>
        </div>
      ) : (
        <h3
          className="cept-settings-section-title cept-settings-section-title--editable"
          onClick={() => setEditing(true)}
          title="Click to rename"
          data-testid="space-details-name"
        >
          {space.name}
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </h3>
      )}
      <div className="cept-settings-detail-grid">
        <div className="cept-settings-detail-row">
          <span className="cept-settings-detail-label">Data source</span>
          <span className="cept-settings-detail-value">{space.source}</span>
        </div>
        <div className="cept-settings-detail-row">
          <span className="cept-settings-detail-label">Pages</span>
          <span className="cept-settings-detail-value" data-testid="space-detail-pages">
            {space.pageCount ?? 'Unknown'}
          </span>
        </div>
        <div className="cept-settings-detail-row">
          <span className="cept-settings-detail-label">Storage used</span>
          <span className="cept-settings-detail-value" data-testid="space-detail-size">
            {space.contentSize === null ? 'Unknown' : formatBytes(space.contentSize)}
          </span>
        </div>
        {space.slug !== undefined && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Slug</span>
            {editingSlug ? (
              <span className="cept-settings-detail-value">
                <input
                  className="cept-settings-rename-input"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSlug();
                    if (e.key === 'Escape') {
                      setEditSlug(space.slug ?? '');
                      setEditingSlug(false);
                    }
                  }}
                  autoFocus
                  data-testid="space-slug-input"
                />
                <button
                  className="cept-settings-action-btn"
                  onClick={saveSlug}
                  data-testid="space-slug-save"
                >
                  Save
                </button>
                {editSlug.trim() !== space.slug && (
                  <span className="cept-settings-wizard-desc" data-testid="space-slug-warning">
                    The slug names this space in listings and published links. Links that use the
                    old slug, {space.slug}, stop working.
                  </span>
                )}
              </span>
            ) : (
              <button
                className="cept-settings-detail-value cept-settings-link-btn"
                onClick={() => {
                  setEditSlug(space.slug ?? '');
                  setEditingSlug(true);
                }}
                title="Change the slug"
                data-testid="space-detail-slug"
              >
                {space.slug}
              </button>
            )}
          </div>
        )}
        {space.remoteUrl && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Remote</span>
            <span className="cept-settings-detail-value" data-testid="space-detail-remote">
              {space.remoteUrl}
            </span>
          </div>
        )}
        {remoteHref && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">On the web</span>
            <a
              className="cept-settings-detail-value"
              href={remoteHref}
              target="_blank"
              rel="noreferrer"
              data-testid="space-detail-remote-link"
            >
              Open on GitHub
            </a>
          </div>
        )}
        {space.branch && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Branch</span>
            <span className="cept-settings-detail-value" data-testid="space-detail-branch">
              {space.branch}
            </span>
          </div>
        )}
        {space.subPath && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Path</span>
            <span className="cept-settings-detail-value" data-testid="space-detail-subpath">
              {space.subPath}
            </span>
          </div>
        )}
        {space.createdAt && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Created</span>
            <span className="cept-settings-detail-value">{formatTimestamp(space.createdAt)}</span>
          </div>
        )}
        {space.lastSyncedAt && (
          <div className="cept-settings-detail-row">
            <span className="cept-settings-detail-label">Last synced</span>
            <span className="cept-settings-detail-value" data-testid="space-detail-last-synced">
              {formatTimestamp(space.lastSyncedAt)}
            </span>
          </div>
        )}
      </div>
      {space.conversionBackup && (onKeepConversion || onUndoConversion) && (
        <>
          <div className="cept-settings-section-divider" />
          <div data-testid="space-migration">
            <p className="cept-settings-wizard-desc">
              This space was converted to keep its pages as Markdown files and folders. A backup of
              the old layout is kept until you choose. Undoing the conversion loses changes made
              since it.
            </p>
            {onKeepConversion && (
              <button
                className="cept-settings-action-btn"
                onClick={onKeepConversion}
                data-testid="space-migration-keep"
              >
                Keep (delete backup)
              </button>
            )}
            {onUndoConversion &&
              (confirmUndo ? (
                <>
                  <p
                    className="cept-settings-wizard-desc"
                    data-testid="space-migration-undo-warning"
                  >
                    Pages added, edited, moved or renamed since the conversion will be lost.
                  </p>
                  <button
                    className="cept-settings-action-btn"
                    onClick={() => {
                      setConfirmUndo(false);
                      onUndoConversion();
                    }}
                    data-testid="space-migration-undo-confirm"
                  >
                    Undo and lose those changes
                  </button>
                  <button
                    className="cept-settings-action-btn"
                    onClick={() => setConfirmUndo(false)}
                    data-testid="space-migration-undo-cancel"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="cept-settings-action-btn"
                  onClick={() => setConfirmUndo(true)}
                  data-testid="space-migration-undo"
                >
                  Undo conversion
                </button>
              ))}
          </div>
        </>
      )}
      {onRefresh && (
        <>
          <div className="cept-settings-section-divider" />
          <button
            className="cept-settings-action-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="space-details-refresh"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={isRefreshing ? 'cept-spin' : ''}
            >
              <path d="M14 2v4h-4M2 14v-4h4" />
              <path d="M13.46 5.54A6 6 0 002.54 10.46M2.54 10.46A6 6 0 0013.46 5.54" />
            </svg>
            {isRefreshing ? 'Syncing from remote...' : 'Refresh from remote'}
          </button>
        </>
      )}
      {onBrowseFiles && (
        <>
          <div className="cept-settings-section-divider" />
          <button
            className="cept-settings-action-btn"
            onClick={onBrowseFiles}
            data-testid="space-browse-files"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 3h4l2 2h6v8H2z" />
            </svg>
            Browse files
          </button>
        </>
      )}
      <div className="cept-settings-section-divider" />
      <button
        className="cept-settings-danger-btn"
        onClick={onDelete}
        data-testid="space-details-delete"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1M6 7v5M10 7v5M4.5 4l.5 9a1 1 0 001 1h4a1 1 0 001-1l.5-9" />
        </svg>
        {removalLabel(space)}
      </button>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** What removing a space does, as a button label. */
function removalLabel(space: SpaceInfo): string {
  switch (space.kind) {
    case 'folder':
      return 'Remove from Cept';
    case 'remote':
      return 'Remove from this device';
    case 'memory':
      return 'Discard this space';
    default:
      return 'Delete this space';
  }
}

/** Asks before a space is removed, saying what is lost and what is kept. */
function RemoveSpaceConfirm({
  space,
  isLast,
  onCancel,
  onConfirm,
}: {
  space: SpaceInfo;
  isLast: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const explanation =
    space.kind === 'folder'
      ? 'The folder and its files stay on this device; Cept only forgets the space. You can open the folder again later.'
      : space.kind === 'remote'
        ? 'The copy on this device is deleted, with any changes not yet synced. The repository on GitHub is not changed.'
        : space.kind === 'memory'
          ? 'This space is kept only in memory, so its pages are lost.'
          : 'Its pages are kept only in this browser, so they are deleted for good.';
  return (
    <div data-testid="space-remove-confirm">
      <h3 className="cept-settings-section-title" data-testid="space-remove-title">
        {space.kind === 'folder'
          ? `Remove "${space.name}" from Cept?`
          : space.kind === 'remote'
            ? `Remove "${space.name}" from this device?`
            : space.kind === 'memory'
              ? `Discard "${space.name}"?`
              : `Delete "${space.name}"?`}
      </h3>
      <p className="cept-settings-wizard-desc" data-testid="space-remove-explanation">
        {explanation}
      </p>
      {isLast && (
        <p className="cept-settings-wizard-desc" data-testid="space-remove-last">
          It is your only space, so a new, empty space named My Space takes its place.
        </p>
      )}
      <button
        className="cept-settings-danger-btn"
        onClick={onConfirm}
        data-testid="space-remove-confirm-btn"
      >
        {removalLabel(space)}
      </button>
      <button
        className="cept-settings-action-btn"
        onClick={onCancel}
        data-testid="space-remove-cancel"
      >
        Cancel
      </button>
    </div>
  );
}

function formatPageCount(count: number | null): string {
  if (count === null) return 'pages unknown';
  return count === 1 ? '1 page' : `${count} pages`;
}

function formatSize(bytes: number | null): string {
  return bytes === null ? 'size unknown' : formatBytes(bytes);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
