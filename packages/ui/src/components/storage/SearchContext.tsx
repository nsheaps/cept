/**
 * SearchContext — React context that provides a CeptSearchIndex
 * backed by page content from the storage layer.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CeptSearchIndex } from '@cept/core';
import type { SearchResult, SearchOptions } from '@cept/core';

const SearchIndexContext = createContext<CeptSearchIndex | null>(null);

export interface SearchProviderProps {
  children: ReactNode;
}

/**
 * Provides a singleton CeptSearchIndex to the component tree.
 * Pages should be indexed via the useSearchIndex hook.
 */
export function SearchProvider({ children }: SearchProviderProps) {
  const index = useMemo(() => new CeptSearchIndex(), []);
  return (
    <SearchIndexContext.Provider value={index}>
      {children}
    </SearchIndexContext.Provider>
  );
}

/**
 * Access the search index for indexing pages and performing searches.
 */
export function useSearchIndex() {
  const index = useContext(SearchIndexContext);
  if (!index) {
    throw new Error('useSearchIndex must be used within a SearchProvider');
  }

  const indexPage = useCallback(
    (pageId: string, title: string, content: string, path: string) =>
      index.indexPage(pageId, title, content, path),
    [index],
  );

  const removePage = useCallback(
    (pageId: string) => index.removePage(pageId),
    [index],
  );

  const search = useCallback(
    (query: string, options?: SearchOptions): Promise<SearchResult[]> =>
      index.search(query, options),
    [index],
  );

  return { indexPage, removePage, search, index };
}
