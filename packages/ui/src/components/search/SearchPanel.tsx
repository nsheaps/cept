import { useState, useCallback, useRef, useEffect } from 'react';

export interface SearchResult {
  pageId: string;
  title: string;
  snippet: string;
  path: string;
  score: number;
  matchType: 'title' | 'content' | 'database';
}

export interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  onResultSelect: (pageId: string) => void;
}

export function SearchPanel({ isOpen, onClose, onSearch, onResultSelect }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSelectedIndex(0);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        const searchResults = await onSearch(value);
        setResults(searchResults);
        setLoading(false);
      }, 150);
    },
    [onSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          onResultSelect(results[selectedIndex].pageId);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [results, selectedIndex, onResultSelect, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="cept-search-overlay" onClick={onClose} data-testid="search-overlay">
      <div
        className="cept-search-panel"
        onClick={(e) => e.stopPropagation()}
        data-testid="search-panel"
      >
        <div className="cept-search-input-wrapper">
          <span className="cept-search-input-icon">{'\u{1F50D}'}</span>
          <input
            ref={inputRef}
            className="cept-search-input"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            data-testid="search-input"
          />
        </div>
        <div className="cept-search-results" data-testid="search-results">
          {loading && (
            <div className="cept-search-loading" data-testid="search-loading">
              Searching...
            </div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="cept-search-empty" data-testid="search-empty">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {!loading && results.map((result, index) => (
            <button
              key={result.pageId}
              className={`cept-search-result ${index === selectedIndex ? 'is-selected' : ''}`}
              onClick={() => {
                onResultSelect(result.pageId);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              data-testid={`search-result-${result.pageId}`}
            >
              <div className="cept-search-result-title">{result.title}</div>
              {result.snippet && (
                <div className="cept-search-result-snippet">{result.snippet}</div>
              )}
              <div className="cept-search-result-meta">
                <span className="cept-search-result-type">{result.matchType}</span>
                {result.path && <span className="cept-search-result-path">{result.path}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
