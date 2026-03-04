import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SearchProvider, useSearchIndex } from './SearchContext.js';

function TestConsumer() {
  const { index } = useSearchIndex();
  return <div data-testid="index-available">{index ? 'yes' : 'no'}</div>;
}

describe('SearchContext', () => {
  it('provides a CeptSearchIndex instance', () => {
    render(
      <SearchProvider>
        <TestConsumer />
      </SearchProvider>,
    );
    expect(screen.getByTestId('index-available').textContent).toBe('yes');
  });

  it('throws when used outside provider', () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useSearchIndex must be used within a SearchProvider');
  });

  it('can index pages and search them', async () => {
    function IndexAndSearch() {
      const { indexPage, search } = useSearchIndex();
      const handleIndex = async () => {
        await indexPage('p1', 'Hello World', 'Some content about testing', '/hello');
        await indexPage('p2', 'Goodbye', 'Another page entirely', '/goodbye');
      };
      const handleSearch = async () => {
        const results = await search('hello');
        document.getElementById('search-results')!.textContent = String(results.length);
      };
      return (
        <>
          <button data-testid="do-index" onClick={handleIndex}>Index</button>
          <button data-testid="do-search" onClick={handleSearch}>Search</button>
          <div id="search-results" data-testid="search-results" />
        </>
      );
    }

    render(
      <SearchProvider>
        <IndexAndSearch />
      </SearchProvider>,
    );

    await act(async () => {
      screen.getByTestId('do-index').click();
    });
    await act(async () => {
      screen.getByTestId('do-search').click();
    });
    expect(screen.getByTestId('search-results').textContent).toBe('1');
  });
});
