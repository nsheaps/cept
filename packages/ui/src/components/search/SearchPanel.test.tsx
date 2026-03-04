import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchPanel } from './SearchPanel.js';
import type { SearchResult } from './SearchPanel.js';

const mockResults: SearchResult[] = [
  { pageId: 'p1', title: 'Getting Started', snippet: 'Welcome to the app...', path: '/getting-started', score: 2.5, matchType: 'title' },
  { pageId: 'p2', title: 'API Reference', snippet: 'The API provides endpoints for...', path: '/api', score: 1.8, matchType: 'content' },
];

function createMockSearch(results: SearchResult[] = mockResults) {
  return vi.fn().mockResolvedValue(results);
}

describe('SearchPanel', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <SearchPanel isOpen={false} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('search-panel')).toBeDefined();
  });

  it('renders search input', () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );
    expect(screen.getByTestId('search-input')).toBeDefined();
  });

  it('calls onSearch after typing', async () => {
    const onSearch = createMockSearch();
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={onSearch} onResultSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'getting' } });

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('getting');
    });
  });

  it('renders search results', async () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-p1')).toBeDefined();
      expect(screen.getByTestId('search-result-p2')).toBeDefined();
    });
  });

  it('shows empty state when no results', async () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch([])} onResultSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-empty')).toBeDefined();
    });
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <SearchPanel isOpen={true} onClose={onClose} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on overlay click', () => {
    const onClose = vi.fn();
    render(
      <SearchPanel isOpen={true} onClose={onClose} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );

    fireEvent.click(screen.getByTestId('search-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onResultSelect on Enter', async () => {
    const onResultSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchPanel isOpen={true} onClose={onClose} onSearch={createMockSearch()} onResultSelect={onResultSelect} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-p1')).toBeDefined();
    });

    fireEvent.keyDown(screen.getByTestId('search-input'), { key: 'Enter' });
    expect(onResultSelect).toHaveBeenCalledWith('p1');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onResultSelect on click', async () => {
    const onResultSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <SearchPanel isOpen={true} onClose={onClose} onSearch={createMockSearch()} onResultSelect={onResultSelect} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-p2')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('search-result-p2'));
    expect(onResultSelect).toHaveBeenCalledWith('p2');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates with arrow keys', async () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-p1')).toBeDefined();
    });

    const input = screen.getByTestId('search-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('search-result-p2').className).toContain('is-selected');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByTestId('search-result-p1').className).toContain('is-selected');
  });

  it('displays result snippets', async () => {
    render(
      <SearchPanel isOpen={true} onClose={vi.fn()} onSearch={createMockSearch()} onResultSelect={vi.fn()} />,
    );

    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Welcome to the app...')).toBeDefined();
    });
  });
});
