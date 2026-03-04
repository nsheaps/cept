/**
 * Client-side full-text search engine using TF-IDF scoring.
 *
 * Builds an inverted index in memory. Supports indexing page titles,
 * content, and database property values.
 */
import type { SearchIndex, SearchResult, SearchOptions } from './index.js';

/** An indexed document (page or database entry). */
interface IndexedDocument {
  id: string;
  path: string;
  title: string;
  content: string;
  type: 'page' | 'database';
  /** Pre-computed term frequencies: term -> count */
  termFreqs: Map<string, number>;
  /** Total number of terms in the document */
  termCount: number;
}

/** Tokenize text into lowercase terms, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Compute term frequencies for a token list. */
function computeTermFreqs(tokens: string[]): Map<string, number> {
  const freqs = new Map<string, number>();
  for (const token of tokens) {
    freqs.set(token, (freqs.get(token) ?? 0) + 1);
  }
  return freqs;
}

/** Extract a snippet around the first match of a query term. */
function extractSnippet(content: string, queryTerms: string[], maxLen = 160): string {
  const lower = content.toLowerCase();
  let bestPos = -1;

  for (const term of queryTerms) {
    const pos = lower.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  if (bestPos === -1) {
    return content.slice(0, maxLen) + (content.length > maxLen ? '...' : '');
  }

  const start = Math.max(0, bestPos - 40);
  const end = Math.min(content.length, start + maxLen);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

export class CeptSearchIndex implements SearchIndex {
  /** All indexed documents keyed by id. */
  private docs = new Map<string, IndexedDocument>();

  /** Inverted index: term -> set of document ids. */
  private invertedIndex = new Map<string, Set<string>>();

  async indexPage(
    pageId: string,
    title: string,
    content: string,
    path: string,
  ): Promise<void> {
    // Remove old entry first if re-indexing
    await this.removePage(pageId);

    const allText = title + ' ' + content;
    const tokens = tokenize(allText);
    const termFreqs = computeTermFreqs(tokens);

    const doc: IndexedDocument = {
      id: pageId,
      path,
      title,
      content,
      type: 'page',
      termFreqs,
      termCount: tokens.length,
    };

    this.docs.set(pageId, doc);

    for (const term of termFreqs.keys()) {
      let set = this.invertedIndex.get(term);
      if (!set) {
        set = new Set();
        this.invertedIndex.set(term, set);
      }
      set.add(pageId);
    }
  }

  async indexDatabase(
    databaseId: string,
    values: Record<string, string>,
  ): Promise<void> {
    await this.removePage(databaseId);

    const title = values['title'] ?? databaseId;
    const content = Object.values(values).join(' ');
    const tokens = tokenize(title + ' ' + content);
    const termFreqs = computeTermFreqs(tokens);

    const doc: IndexedDocument = {
      id: databaseId,
      path: '',
      title,
      content,
      type: 'database',
      termFreqs,
      termCount: tokens.length,
    };

    this.docs.set(databaseId, doc);

    for (const term of termFreqs.keys()) {
      let set = this.invertedIndex.get(term);
      if (!set) {
        set = new Set();
        this.invertedIndex.set(term, set);
      }
      set.add(databaseId);
    }
  }

  async removePage(pageId: string): Promise<void> {
    const doc = this.docs.get(pageId);
    if (!doc) return;

    for (const term of doc.termFreqs.keys()) {
      const set = this.invertedIndex.get(term);
      if (set) {
        set.delete(pageId);
        if (set.size === 0) {
          this.invertedIndex.delete(term);
        }
      }
    }

    this.docs.delete(pageId);
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const includeContent = options?.includeContent ?? true;
    const includeDatabases = options?.includeDatabases ?? true;

    // Find candidate documents (union of all term postings)
    const candidateIds = new Set<string>();
    for (const term of queryTerms) {
      const set = this.invertedIndex.get(term);
      if (set) {
        for (const id of set) {
          candidateIds.add(id);
        }
      }
    }

    const totalDocs = this.docs.size;
    const results: SearchResult[] = [];

    for (const id of candidateIds) {
      const doc = this.docs.get(id);
      if (!doc) continue;

      // Filter by type
      if (doc.type === 'database' && !includeDatabases) continue;
      if (doc.type === 'page' && !includeContent) continue;

      // Compute TF-IDF score
      let score = 0;
      let matchedTerms = 0;

      for (const term of queryTerms) {
        const tf = doc.termFreqs.get(term);
        if (tf === undefined) continue;
        matchedTerms++;

        const docFreq = this.invertedIndex.get(term)?.size ?? 1;
        const idf = Math.log(1 + totalDocs / docFreq);
        const normalizedTf = tf / Math.max(doc.termCount, 1);
        score += normalizedTf * idf;
      }

      if (matchedTerms === 0) continue;

      // Boost for title matches
      const titleLower = doc.title.toLowerCase();
      for (const term of queryTerms) {
        if (titleLower.includes(term)) {
          score *= 2;
        }
      }

      // Boost for matching all query terms
      if (matchedTerms === queryTerms.length) {
        score *= 1.5;
      }

      // Determine match type
      let matchType: 'title' | 'content' | 'database' = 'content';
      if (doc.type === 'database') {
        matchType = 'database';
      } else {
        for (const term of queryTerms) {
          if (titleLower.includes(term)) {
            matchType = 'title';
            break;
          }
        }
      }

      results.push({
        pageId: doc.id,
        path: doc.path,
        title: doc.title,
        snippet: extractSnippet(doc.content, queryTerms),
        score,
        matchType,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(offset, offset + limit);
  }

  async rebuild(): Promise<void> {
    // Clear and re-index: the caller is responsible for feeding documents back.
    // This just resets internal state.
    this.docs.clear();
    this.invertedIndex.clear();
  }

  /** Number of indexed documents (useful for tests). */
  get size(): number {
    return this.docs.size;
  }
}
