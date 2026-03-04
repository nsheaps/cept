/**
 * @cept/docs — Documentation site configuration and content.
 *
 * This module exports documentation metadata for programmatic access
 * to the documentation structure (e.g., for in-app help panels).
 */

export interface DocPage {
  /** URL slug */
  slug: string;
  /** Display title */
  title: string;
  /** Brief description */
  description: string;
  /** Category for grouping */
  category: DocCategory;
  /** Order within category */
  order: number;
}

export type DocCategory =
  | 'getting-started'
  | 'guides'
  | 'reference'
  | 'migration'
  | 'api';

const DOC_PAGES: DocPage[] = [
  // Getting Started
  { slug: 'introduction', title: 'Introduction', description: 'What is Cept and why use it', category: 'getting-started', order: 1 },
  { slug: 'quick-start', title: 'Quick Start', description: 'Get up and running in 5 minutes', category: 'getting-started', order: 2 },
  { slug: 'installation', title: 'Installation', description: 'Install Cept on any platform', category: 'getting-started', order: 3 },
  { slug: 'concepts', title: 'Core Concepts', description: 'Pages, databases, blocks, and backends', category: 'getting-started', order: 4 },

  // Guides
  { slug: 'editor-basics', title: 'Editor Basics', description: 'Writing and formatting content', category: 'guides', order: 1 },
  { slug: 'databases', title: 'Working with Databases', description: 'Create and manage databases', category: 'guides', order: 2 },
  { slug: 'git-sync', title: 'Git Sync', description: 'Sync your workspace with Git', category: 'guides', order: 3 },
  { slug: 'collaboration', title: 'Real-time Collaboration', description: 'Work together in real-time', category: 'guides', order: 4 },
  { slug: 'templates', title: 'Using Templates', description: 'Create pages from templates', category: 'guides', order: 5 },
  { slug: 'knowledge-graph', title: 'Knowledge Graph', description: 'Visualize connections between pages', category: 'guides', order: 6 },
  { slug: 'import-export', title: 'Import & Export', description: 'Move data in and out of Cept', category: 'guides', order: 7 },

  // Reference
  { slug: 'keyboard-shortcuts', title: 'Keyboard Shortcuts', description: 'All keyboard shortcuts', category: 'reference', order: 1 },
  { slug: 'markdown-syntax', title: 'Markdown Syntax', description: 'Supported markdown features', category: 'reference', order: 2 },
  { slug: 'storage-backends', title: 'Storage Backends', description: 'Backend types and capabilities', category: 'reference', order: 3 },
  { slug: 'database-formulas', title: 'Database Formulas', description: 'Formula syntax and functions', category: 'reference', order: 4 },
  { slug: 'api-reference', title: 'API Reference', description: 'Core API documentation', category: 'reference', order: 5 },

  // Migration
  { slug: 'from-notion', title: 'Migrate from Notion', description: 'Import your Notion workspace', category: 'migration', order: 1 },
  { slug: 'from-obsidian', title: 'Migrate from Obsidian', description: 'Import your Obsidian vault', category: 'migration', order: 2 },
];

/**
 * Get all documentation pages.
 */
export function getDocPages(): DocPage[] {
  return [...DOC_PAGES];
}

/**
 * Get documentation pages by category.
 */
export function getDocPagesByCategory(category: DocCategory): DocPage[] {
  return DOC_PAGES
    .filter((p) => p.category === category)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get a specific documentation page by slug.
 */
export function getDocPage(slug: string): DocPage | null {
  return DOC_PAGES.find((p) => p.slug === slug) ?? null;
}

/**
 * Get the documentation site navigation structure.
 */
export function getDocNavigation(): Array<{ category: DocCategory; label: string; pages: DocPage[] }> {
  return [
    { category: 'getting-started', label: 'Getting Started', pages: getDocPagesByCategory('getting-started') },
    { category: 'guides', label: 'Guides', pages: getDocPagesByCategory('guides') },
    { category: 'reference', label: 'Reference', pages: getDocPagesByCategory('reference') },
    { category: 'migration', label: 'Migration', pages: getDocPagesByCategory('migration') },
  ];
}
