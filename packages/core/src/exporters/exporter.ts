/**
 * Exporter — Converts Cept pages to Markdown, HTML, and PDF formats.
 *
 * Provides a unified export pipeline:
 * 1. Read page content from StorageBackend
 * 2. Process wiki-links and embedded assets
 * 3. Convert to target format (Markdown, HTML, PDF)
 * 4. Package output (single file or ZIP for multi-page)
 */

export type ExportFormat = 'markdown' | 'html' | 'pdf';

export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Whether to include front matter in markdown export. Default: true */
  includeFrontMatter?: boolean;
  /** Whether to include linked sub-pages. Default: false */
  includeSubPages?: boolean;
  /** Whether to inline images as data URIs in HTML. Default: false */
  inlineImages?: boolean;
  /** CSS stylesheet for HTML/PDF output */
  customCss?: string;
  /** Document title override */
  title?: string;
}

export interface ExportedFile {
  /** Filename (e.g., "My Page.md") */
  filename: string;
  /** MIME type of the content */
  mimeType: string;
  /** File content */
  content: string | Uint8Array;
}

export interface ExportResult {
  /** Exported files */
  files: ExportedFile[];
  /** Errors encountered */
  errors: ExportError[];
}

export interface ExportError {
  path: string;
  message: string;
}

export interface PageContent {
  /** Page title */
  title: string;
  /** Markdown content */
  markdown: string;
  /** Front matter metadata */
  frontMatter?: Record<string, unknown>;
  /** Page path */
  path: string;
}

const DEFAULT_CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
h1 { border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
h2 { margin-top: 2rem; }
code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
pre { background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
th { background: #f5f5f5; }
img { max-width: 100%; }
`.trim();

/**
 * Convert wiki-links [[path|text]] back to standard markdown links.
 */
export function convertWikiLinksToMarkdown(content: string): string {
  return content.replace(
    /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
    (_match, path: string, text: string | undefined) => {
      const displayText = text ?? path.split('/').pop()?.replace(/\.md$/, '') ?? path;
      return `[${displayText}](${encodeURI(path)})`;
    },
  );
}

/**
 * Serialize front matter to YAML format.
 */
export function serializeFrontMatter(data: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${String(item)}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/**
 * Convert markdown content to basic HTML.
 * This is a lightweight converter for export purposes.
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const langAttr = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Images (before links, since ![...] would match [...])
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>');

  // Paragraphs (lines not wrapped in tags)
  html = html.replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap HTML content in a complete document.
 */
export function wrapHtmlDocument(title: string, bodyHtml: string, css?: string): string {
  const stylesheet = css ?? DEFAULT_CSS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${stylesheet}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Export a single page to the specified format.
 */
export function exportPage(page: PageContent, options: ExportOptions): ExportedFile {
  const title = options.title ?? page.title;

  switch (options.format) {
    case 'markdown': {
      let content = convertWikiLinksToMarkdown(page.markdown);
      if (options.includeFrontMatter !== false && page.frontMatter) {
        content = serializeFrontMatter(page.frontMatter) + '\n\n' + content;
      }
      return {
        filename: `${sanitizeFilename(title)}.md`,
        mimeType: 'text/markdown',
        content,
      };
    }
    case 'html': {
      const mdContent = convertWikiLinksToMarkdown(page.markdown);
      const bodyHtml = markdownToHtml(mdContent);
      const html = wrapHtmlDocument(title, bodyHtml, options.customCss);
      return {
        filename: `${sanitizeFilename(title)}.html`,
        mimeType: 'text/html',
        content: html,
      };
    }
    case 'pdf': {
      // PDF export generates HTML that can be printed to PDF by the caller
      // (browser print, puppeteer, etc.)
      const mdContent = convertWikiLinksToMarkdown(page.markdown);
      const bodyHtml = markdownToHtml(mdContent);
      const pdfCss = (options.customCss ?? DEFAULT_CSS) + '\n@media print { body { margin: 0; } }';
      const html = wrapHtmlDocument(title, bodyHtml, pdfCss);
      return {
        filename: `${sanitizeFilename(title)}.html`,
        mimeType: 'text/html',
        content: html,
      };
    }
  }
}

/**
 * Export multiple pages.
 */
export function exportPages(pages: PageContent[], options: ExportOptions): ExportResult {
  const result: ExportResult = {
    files: [],
    errors: [],
  };

  for (const page of pages) {
    try {
      const file = exportPage(page, { ...options, title: undefined });
      result.files.push(file);
    } catch (e) {
      result.errors.push({
        path: page.path,
        message: `Export failed: ${(e as Error).message}`,
      });
    }
  }

  return result;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export { DEFAULT_CSS };
