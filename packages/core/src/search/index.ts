/**
 * Search index interface for client-side full-text search.
 */

/** Search result item */
export interface SearchResult {
  pageId: string;
  path: string;
  title: string;
  snippet: string;
  score: number;
  matchType: 'title' | 'content' | 'database';
}

/** Search query options */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeContent?: boolean;
  includeDatabases?: boolean;
}

/** Search index interface */
export interface SearchIndex {
  /** Index a page */
  indexPage(pageId: string, title: string, content: string, path: string): Promise<void>;

  /** Index database values */
  indexDatabase(databaseId: string, values: Record<string, string>): Promise<void>;

  /** Remove a page from the index */
  removePage(pageId: string): Promise<void>;

  /** Search for pages */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /** Rebuild the entire index */
  rebuild(): Promise<void>;
}
