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
export { findAncestorIds, expandToNode, getBreadcrumbs } from './components/sidebar/page-tree-utils.js';
