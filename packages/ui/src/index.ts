/**
 * @cept/ui — Shared React components for Cept
 *
 * This package contains all UI components, hooks, and stores.
 * It depends on @cept/core for business logic and type definitions.
 * It must NEVER import platform-specific modules.
 */

export { App } from './components/App.js';
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
