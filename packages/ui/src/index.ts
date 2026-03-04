/**
 * @cept/ui — Shared React components for Cept
 *
 * This package contains all UI components, hooks, and stores.
 * It depends on @cept/core for business logic and type definitions.
 * It must NEVER import platform-specific modules.
 */

export { App } from './components/App.js';
export { StorageProvider, useStorage, readPageContent, writePageContent, deletePageContent } from './components/storage/StorageContext.js';
export { CeptEditor } from './components/editor/index.js';
export type { CeptEditorProps } from './components/editor/index.js';
export { Sidebar } from './components/sidebar/Sidebar.js';
export type { SidebarProps } from './components/sidebar/Sidebar.js';
export { PageTreeItem } from './components/sidebar/PageTreeItem.js';
export type { PageTreeNode, PageTreeItemProps } from './components/sidebar/PageTreeItem.js';
export { findAncestorIds, expandToNode, getBreadcrumbs, renameNode, removeNode, moveNode, findNode, addChild } from './components/sidebar/page-tree-utils.js';
export { PageContextMenu } from './components/sidebar/PageContextMenu.js';
export type { PageContextMenuProps } from './components/sidebar/PageContextMenu.js';
export { Breadcrumbs } from './components/topbar/Breadcrumbs.js';
export type { BreadcrumbItem, BreadcrumbsProps } from './components/topbar/Breadcrumbs.js';
export { CommandPalette, filterCommands } from './components/command-palette/CommandPalette.js';
export type { CommandItem, CommandPaletteProps } from './components/command-palette/CommandPalette.js';
export { SearchPanel } from './components/search/SearchPanel.js';
export type { SearchResult, SearchPanelProps } from './components/search/SearchPanel.js';
export { KnowledgeGraph } from './components/knowledge-graph/KnowledgeGraph.js';
export type { KnowledgeGraphProps } from './components/knowledge-graph/KnowledgeGraph.js';
export { buildGraphData, filterByDepth, getGroups, getLinkTypes, filterGraph } from './components/knowledge-graph/graph-types.js';
export type { GraphNode, GraphLink, GraphData, GraphViewOptions, GraphFilters } from './components/knowledge-graph/graph-types.js';
export { KnowledgeGraphView } from './components/knowledge-graph/KnowledgeGraphView.js';
export type { KnowledgeGraphViewProps } from './components/knowledge-graph/KnowledgeGraphView.js';
export { GraphAnimationPlayer } from './components/knowledge-graph/GraphAnimationPlayer.js';
export type { GraphAnimationPlayerProps } from './components/knowledge-graph/GraphAnimationPlayer.js';
export { buildAnimationFrames, optimizeForPerformance } from './components/knowledge-graph/graph-animation.js';
export type { TimestampedNode, AnimationFrame, PerformanceOptions } from './components/knowledge-graph/graph-animation.js';
export { DatabaseSchemaEditor } from './components/database/DatabaseSchemaEditor.js';
export type { SchemaProperty, DatabaseSchemaEditorProps } from './components/database/DatabaseSchemaEditor.js';
export { DatabaseTableView } from './components/database/DatabaseTableView.js';
export type { DatabaseTableViewProps } from './components/database/DatabaseTableView.js';
export { DatabaseBoardView } from './components/database/DatabaseBoardView.js';
export type { BoardColumn, DatabaseBoardViewProps } from './components/database/DatabaseBoardView.js';
export { DatabaseCalendarView } from './components/database/DatabaseCalendarView.js';
export type { DatabaseCalendarViewProps } from './components/database/DatabaseCalendarView.js';
export { DatabaseMapView } from './components/database/DatabaseMapView.js';
export type { MapMarker, DatabaseMapViewProps } from './components/database/DatabaseMapView.js';
export { DatabaseGalleryView } from './components/database/DatabaseGalleryView.js';
export type { DatabaseGalleryViewProps } from './components/database/DatabaseGalleryView.js';
export { DatabaseListView } from './components/database/DatabaseListView.js';
export type { DatabaseListViewProps } from './components/database/DatabaseListView.js';
export { LinkedDatabaseView } from './components/database/LinkedDatabaseView.js';
export type { LinkedViewConfig, LinkedViewRenderProps, LinkedDatabaseViewProps } from './components/database/LinkedDatabaseView.js';
export { InlineDatabase, SUPPORTED_VIEW_TYPES } from './components/editor/extensions/inline-database.js';
export type { InlineDatabaseOptions, InlineDatabaseAttrs } from './components/editor/extensions/inline-database.js';
export { SelectEditor, MultiSelectEditor, DEFAULT_COLORS } from './components/database/SelectEditor.js';
export type { SelectEditorProps, MultiSelectEditorProps } from './components/database/SelectEditor.js';
export { PropertyEditor } from './components/database/PropertyEditor.js';
export type { PropertyEditorProps } from './components/database/PropertyEditor.js';
export { RepoPicker } from './components/git/RepoPicker.js';
export type { RepoPickerProps } from './components/git/RepoPicker.js';
export { ConflictResolver } from './components/git/ConflictResolver.js';
export type { ConflictResolverProps } from './components/git/ConflictResolver.js';
export { HistoryViewer } from './components/git/HistoryViewer.js';
export type { HistoryViewerProps } from './components/git/HistoryViewer.js';
export { AvatarStack } from './components/collaboration/AvatarStack.js';
export type { AvatarStackProps } from './components/collaboration/AvatarStack.js';
export { CursorOverlay } from './components/collaboration/CursorOverlay.js';
export type { CursorData, CursorOverlayProps } from './components/collaboration/CursorOverlay.js';
export { useResponsive } from './components/collaboration/useResponsive.js';
export type { Breakpoint, ResponsiveState, BreakpointConfig } from './components/collaboration/useResponsive.js';
export { MobileToolbar } from './components/collaboration/MobileToolbar.js';
export type { MobileToolbarAction, MobileToolbarProps } from './components/collaboration/MobileToolbar.js';
export { DatabaseProvider, useDatabaseEngine } from './components/storage/DatabaseContext.js';
export { SearchProvider, useSearchIndex } from './components/storage/SearchContext.js';
export { ErrorBoundary } from './components/shared/ErrorBoundary.js';
export type { ErrorBoundaryProps } from './components/shared/ErrorBoundary.js';
export { LoadingSpinner, EmptyState } from './components/shared/LoadingSpinner.js';
export type { LoadingSpinnerProps, EmptyStateProps } from './components/shared/LoadingSpinner.js';
