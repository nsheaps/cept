/**
 * CeptMarkdownParser — Markdown <-> Block tree parser/serializer.
 *
 * Handles:
 * - CommonMark + GFM (via remark)
 * - YAML front matter
 * - Cept extensions (<!-- cept:block --> HTML comments)
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import yaml from 'js-yaml';
import type {
  Content,
  Heading,
  Code,
  List,
  ListItem,
  Table,
  TableRow,
  TableCell,
} from 'mdast';
import type { Block, BlockType, PageMeta } from '../models/index.js';

export class CeptMarkdownParser {
  private parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']);

  parse(markdown: string): { meta: PageMeta; blocks: Block[] } {
    const meta = this.parseFrontMatter(markdown);
    const blocks = this.parseBlocks(markdown);
    return { meta, blocks };
  }

  serialize(page: { meta: PageMeta; blocks: Block[] }): string {
    const frontMatter = this.serializeFrontMatter(page.meta);
    const body = this.serializeBlocks(page.blocks);
    return `---\n${frontMatter}---\n\n${body}`;
  }

  parseFrontMatter(markdown: string): PageMeta {
    const tree = this.parser.parse(markdown);
    const yamlNode = tree.children.find(
      (node): node is Content & { type: 'yaml'; value: string } => node.type === 'yaml',
    );

    if (!yamlNode) {
      return {
        id: '',
        title: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        tags: [],
        properties: {},
      };
    }

    const data = yaml.load(yamlNode.value) as Record<string, unknown>;
    return {
      id: String(data.id ?? ''),
      title: String(data.title ?? ''),
      icon: data.icon ? String(data.icon) : undefined,
      cover: data.cover ? String(data.cover) : undefined,
      parent: data.parent ? String(data.parent) : undefined,
      created: String(data.created ?? new Date().toISOString()),
      modified: String(data.modified ?? new Date().toISOString()),
      template: data.template ? String(data.template) : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      properties: (data.properties as Record<string, unknown>) ?? {},
      locked: data.locked ? Boolean(data.locked) : undefined,
    };
  }

  serializeFrontMatter(meta: PageMeta): string {
    const obj: Record<string, unknown> = {
      id: meta.id,
      title: meta.title,
    };
    if (meta.icon !== undefined) obj.icon = meta.icon;
    if (meta.cover !== undefined) obj.cover = meta.cover;
    if (meta.parent !== undefined) obj.parent = meta.parent;
    obj.created = meta.created;
    obj.modified = meta.modified;
    if (meta.template !== undefined) obj.template = meta.template;
    obj.tags = meta.tags;
    if (Object.keys(meta.properties).length > 0) obj.properties = meta.properties;
    else obj.properties = {};
    if (meta.locked !== undefined) obj.locked = meta.locked;

    return yaml.dump(obj, { lineWidth: -1, quotingType: '"', forceQuotes: true });
  }

  parseBlocks(markdown: string): Block[] {
    const preprocessed = this.preprocessToggles(markdown);
    const tree = this.parser.parse(preprocessed);
    return this.convertNodes(tree.children.filter((n) => n.type !== 'yaml'));
  }

  /**
   * Pre-process toggle syntax before remark parsing.
   *
   * Toggle syntax:
   *   > Summary text
   *     Content indented by 2+ spaces
   *
   *     Still in toggle (single blank line continues)
   *
   *
   *     Two blank lines end the toggle
   *
   * Distinguished from blockquotes: if the line(s) after `> text` are
   * indented (not `>` prefixed), it is a toggle. If the next non-blank
   * line starts with `>`, it is a blockquote.
   */
  private preprocessToggles(markdown: string): string {
    const lines = markdown.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Match toggle start: optional whitespace + '> ' + text
      // Also match list markers: `- > text`, `  - > text`, `1. > text`
      const match = line.match(/^([ \t]*(?:[-*+]|\d+\.)\s+)> (.+)$/);
      const match2 = !match ? line.match(/^([ \t]*)> (.+)$/) : null;
      const toggleMatch = match || match2;

      if (!toggleMatch) {
        result.push(line);
        i++;
        continue;
      }

      const summary = toggleMatch[2];

      // Determine content indentation.
      // In list context (`    - > text`), content aligns with the list item
      // continuation indent (i.e., the length of the prefix).
      // At top level (`> text`), content is indented by 2 spaces.
      const contentIndentLen = match && match[1] ? match[1].length : 2;
      const contentIndent = ' '.repeat(contentIndentLen);

      // Look ahead: skip blank lines to find first content line
      let peekIdx = i + 1;
      while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;

      if (peekIdx >= lines.length) {
        // No content after — standalone blockquote
        result.push(line);
        i++;
        continue;
      }

      const peekLine = lines[peekIdx];

      // If the next non-blank line continues with '>', it's a blockquote
      const peekTrimmed = peekLine.trimStart();
      if (peekTrimmed.startsWith('> ') || peekTrimmed === '>') {
        result.push(line);
        i++;
        continue;
      }

      // Check if peek line is indented at the content indent level
      if (
        peekLine.length < contentIndentLen ||
        peekLine.substring(0, contentIndentLen) !== contentIndent
      ) {
        // Not indented enough — just a blockquote line
        result.push(line);
        i++;
        continue;
      }

      // It's a toggle! Collect content lines.
      const contentLines: string[] = [];
      let j = i + 1;
      let consecutiveBlanks = 0;

      while (j < lines.length) {
        const cl = lines[j];

        if (cl.trim() === '') {
          consecutiveBlanks++;
          if (consecutiveBlanks >= 2) break;
          contentLines.push('');
          j++;
          continue;
        }

        // Check if line is indented enough to be toggle content
        if (cl.length >= contentIndentLen && cl.substring(0, contentIndentLen) === contentIndent) {
          consecutiveBlanks = 0;
          contentLines.push(cl.substring(contentIndentLen));
          j++;
          continue;
        }

        break;
      }

      // Trim trailing blank lines
      while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
        contentLines.pop();
      }
      // Trim leading blank lines
      while (contentLines.length > 0 && contentLines[0] === '') {
        contentLines.shift();
      }

      if (contentLines.length === 0) {
        result.push(line);
        i++;
        continue;
      }

      // Emit cept:block comments
      const config = JSON.stringify({ type: 'toggle', summary });

      if (match && match[1]) {
        // List context: preserve list marker on the opening comment
        const listPrefix = match[1];
        const innerIndent = ' '.repeat(listPrefix.length);
        result.push(`${listPrefix}<!-- cept:block ${config} -->`);
        result.push('');
        for (const cl of contentLines) {
          result.push(cl === '' ? '' : `${innerIndent}${cl}`);
        }
        result.push('');
        result.push(`${innerIndent}<!-- /cept:block -->`);
      } else {
        // Top-level toggle
        result.push(`<!-- cept:block ${config} -->`);
        result.push('');
        for (const cl of contentLines) {
          result.push(cl);
        }
        result.push('');
        result.push(`<!-- /cept:block -->`);
      }

      i = j;
    }

    return result.join('\n');
  }

  serializeBlocks(blocks: Block[]): string {
    const lines: string[] = [];
    for (const block of blocks) {
      lines.push(this.serializeBlock(block));
    }
    return lines.join('\n\n') + '\n';
  }

  // -- Convert mdast nodes to Block[] --

  private convertNodes(nodes: Content[]): Block[] {
    const blocks: Block[] = [];
    let i = 0;

    while (i < nodes.length) {
      const node = nodes[i];

      // Check for cept:block HTML comments
      if (node.type === 'html') {
        const result = this.parseCeptComment(node.value, nodes, i);
        if (result) {
          blocks.push(result.block);
          i = result.nextIndex;
          continue;
        }
      }

      const block = this.convertNode(node);
      if (block) {
        blocks.push(block);
      }
      i++;
    }

    return blocks;
  }

  private convertNode(node: Content): Block | null {
    switch (node.type) {
      case 'paragraph': {
        // Check if paragraph contains only an image (standalone image block)
        if (
          'children' in node &&
          node.children.length === 1 &&
          node.children[0].type === 'image'
        ) {
          const img = node.children[0];
          return {
            ...this.createBlock('image', ''),
            attrs: { src: img.url, alt: img.alt ?? '', title: img.title ?? '' },
          };
        }
        return this.createBlock('paragraph', this.extractText(node));
      }

      case 'heading':
        return this.createBlock(
          `heading${(node as Heading).depth}` as BlockType,
          this.extractText(node),
        );

      case 'list': {
        const listNode = node as List;
        if (listNode.ordered) {
          return {
            ...this.createBlock('numberedList', ''),
            children: listNode.children.map((item: ListItem) => {
              if (item.checked !== null && item.checked !== undefined) {
                return {
                  ...this.createBlock('todoList', this.extractText(item)),
                  attrs: { checked: item.checked },
                };
              }
              return this.convertListItem(item);
            }),
          };
        }
        // Check if it's a task list
        const hasChecks = listNode.children.some(
          (item: ListItem) => item.checked !== null && item.checked !== undefined,
        );
        if (hasChecks) {
          return {
            ...this.createBlock('todoList', ''),
            children: listNode.children.map((item: ListItem) => ({
              ...this.createBlock('paragraph', this.extractText(item)),
              attrs: { checked: Boolean(item.checked) },
            })),
          };
        }
        return {
          ...this.createBlock('bulletList', ''),
          children: listNode.children.map((item: ListItem) =>
            this.convertListItem(item),
          ),
        };
      }

      case 'blockquote':
        return {
          ...this.createBlock('blockquote', ''),
          children: this.convertNodes(node.children as Content[]),
        };

      case 'code':
        // Check for mermaid code blocks
        if ((node as Code).lang === 'mermaid') {
          return {
            ...this.createBlock('mermaid', (node as Code).value),
            attrs: { language: 'mermaid' },
          };
        }
        return {
          ...this.createBlock('codeBlock', (node as Code).value),
          attrs: { language: (node as Code).lang ?? '' },
        };

      case 'thematicBreak':
        return this.createBlock('horizontalRule', '');

      case 'table': {
        const tableNode = node as Table;
        return {
          ...this.createBlock('table', ''),
          attrs: { align: tableNode.align },
          children: tableNode.children.map((row: TableRow) => ({
            ...this.createBlock('paragraph', ''),
            children: row.children.map((cell: TableCell) =>
              this.createBlock('paragraph', this.extractText(cell)),
            ),
          })),
        };
      }

      case 'image':
        return {
          ...this.createBlock('image', ''),
          attrs: { src: node.url, alt: node.alt ?? '', title: node.title ?? '' },
        };

      case 'html':
        // Standalone HTML that isn't a cept comment — try to parse as cept extension
        return this.parseSingleCeptComment(node.value);

      default:
        return null;
    }
  }

  /**
   * Convert a list item to a Block, handling complex content (nested blocks,
   * cept:block comments) when present.
   */
  private convertListItem(item: ListItem): Block {
    const children = item.children as Content[];
    // If the list item has complex content (HTML, nested lists, etc.),
    // convert recursively so that cept:block patterns are detected.
    const hasComplex = children.some(
      (c) => c.type === 'html' || c.type === 'list' || c.type === 'blockquote',
    );
    if (!hasComplex) {
      return this.createBlock('paragraph', this.extractText(item));
    }

    const childBlocks = this.convertNodes(children);
    if (childBlocks.length === 1) return childBlocks[0];

    // First block becomes the list item text; the rest are nested children
    const first = childBlocks[0];
    return {
      ...first,
      children: [...first.children, ...childBlocks.slice(1)],
    };
  }

  // -- Cept extension parsing (<!-- cept:block --> comments) --

  private parseCeptComment(
    html: string,
    nodes: Content[],
    index: number,
  ): { block: Block; nextIndex: number } | null {
    const openMatch = html.match(/^<!--\s*cept:block\s+({.*?})\s*-->$/s);
    if (!openMatch) return null;

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(openMatch[1]);
    } catch {
      return null;
    }

    const blockType = String(config.type) as BlockType;

    // Find closing comment
    let closingIndex = index + 1;
    const contentNodes: Content[] = [];

    while (closingIndex < nodes.length) {
      const n = nodes[closingIndex];
      if (n.type === 'html' && /^<!--\s*\/cept:block\s*-->$/.test(n.value)) {
        break;
      }
      contentNodes.push(n);
      closingIndex++;
    }

    // If no closing found, treat as content until end
    const hasClosing = closingIndex < nodes.length;

    const childBlocks = this.convertNodes(contentNodes);
    const contentText = childBlocks.map((b) => b.content).join('\n');

    const block: Block = {
      id: this.generateId(),
      type: blockType,
      content: contentText,
      attrs: { ...config },
      children: childBlocks,
    };

    return {
      block,
      nextIndex: hasClosing ? closingIndex + 1 : closingIndex,
    };
  }

  private parseSingleCeptComment(html: string): Block | null {
    // <!-- cept:database {...} -->
    const dbMatch = html.match(/^<!--\s*cept:database\s+({.*?})\s*-->$/s);
    if (dbMatch) {
      try {
        const config = JSON.parse(dbMatch[1]);
        return {
          id: this.generateId(),
          type: 'database',
          content: '',
          attrs: config,
          children: [],
        };
      } catch {
        // Invalid JSON
      }
    }

    // <!-- cept:toc -->
    if (/^<!--\s*cept:toc\s*-->$/.test(html)) {
      return this.createBlock('tableOfContents', '');
    }

    // <!-- cept:mention {...} --> text <!-- /cept:mention -->
    const mentionMatch = html.match(
      /^<!--\s*cept:mention\s+({.*?})\s*-->(.+?)<!--\s*\/cept:mention\s*-->$/s,
    );
    if (mentionMatch) {
      try {
        const config = JSON.parse(mentionMatch[1]);
        return {
          id: this.generateId(),
          type: 'mention',
          content: mentionMatch[2].trim(),
          attrs: config,
          children: [],
        };
      } catch {
        // Invalid JSON
      }
    }

    return null;
  }

  // -- Serialization --

  private serializeBlock(block: Block): string {
    switch (block.type) {
      case 'paragraph':
        return block.content;

      case 'heading1':
        return `# ${block.content}`;

      case 'heading2':
        return `## ${block.content}`;

      case 'heading3':
        return `### ${block.content}`;

      case 'bulletList':
        return block.children.map((child) => `- ${child.content}`).join('\n');

      case 'numberedList':
        return block.children
          .map((child, i) => `${i + 1}. ${child.content}`)
          .join('\n');

      case 'todoList':
        return block.children
          .map((child) => {
            const checked = child.attrs.checked ? 'x' : ' ';
            return `- [${checked}] ${child.content}`;
          })
          .join('\n');

      case 'blockquote':
        return block.children
          .map((child) => `> ${this.serializeBlock(child)}`)
          .join('\n');

      case 'codeBlock':
        return `\`\`\`${block.attrs.language ?? ''}\n${block.content}\n\`\`\``;

      case 'mermaid':
        return `<!-- cept:block {"type":"mermaid"} -->\n\`\`\`mermaid\n${block.content}\n\`\`\`\n<!-- /cept:block -->`;

      case 'horizontalRule':
        return '---';

      case 'image':
        return `![${block.attrs.alt ?? ''}](${block.attrs.src ?? ''})`;

      case 'toggle': {
        const summary = String(block.attrs.summary || block.content || 'Toggle');
        const childContent = block.children.map((c) => this.serializeBlock(c)).join('\n\n');
        const body = childContent || block.content;
        // Indent every line of the body by 2 spaces
        const indented = body
          .split('\n')
          .map((l) => (l.trim() === '' ? '' : `  ${l}`))
          .join('\n');
        return `> ${summary}\n${indented}`;
      }

      case 'callout':
      case 'columns':
      case 'embed':
      case 'bookmark':
      case 'syncedBlock':
      case 'equation': {
        const config = JSON.stringify(block.attrs);
        const childContent = block.children.map((c) => this.serializeBlock(c)).join('\n');
        const body = childContent || block.content;
        return `<!-- cept:block ${config} -->\n${body}\n<!-- /cept:block -->`;
      }

      case 'database': {
        const dbConfig = JSON.stringify(block.attrs);
        return `<!-- cept:database ${dbConfig} -->`;
      }

      case 'tableOfContents':
        return '<!-- cept:toc -->';

      case 'mention': {
        const mentionConfig = JSON.stringify(block.attrs);
        return `<!-- cept:mention ${mentionConfig} -->${block.content}<!-- /cept:mention -->`;
      }

      case 'table':
        return this.serializeTable(block);

      default:
        return block.content;
    }
  }

  private serializeTable(block: Block): string {
    if (block.children.length === 0) return '';
    const rows = block.children;

    const lines: string[] = [];
    // Header row
    const header = rows[0];
    if (header) {
      lines.push('| ' + header.children.map((c) => c.content).join(' | ') + ' |');
      // Separator
      const aligns = (block.attrs.align as (string | null)[] | undefined) ?? [];
      lines.push(
        '| ' +
          header.children
            .map((_, i) => {
              const align = aligns[i];
              if (align === 'center') return ':---:';
              if (align === 'right') return '---:';
              return '---';
            })
            .join(' | ') +
          ' |',
      );
    }
    // Data rows
    for (let i = 1; i < rows.length; i++) {
      lines.push('| ' + rows[i].children.map((c) => c.content).join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  // -- Helpers --

  /**
   * Extract text from an mdast node, preserving inline Markdown formatting.
   * This reconstructs the Markdown source for inline elements (bold, italic,
   * links, code spans, etc.) so that roundtripping through parse→serialize
   * does not lose formatting.
   */
  private extractText(node: Content): string {
    // Handle inline formatting nodes that have both value and special meaning
    switch (node.type) {
      case 'inlineCode':
        return `\`${(node as Content & { value: string }).value}\``;
      case 'strong':
        return `**${((node as Content & { children: Content[] }).children).map((c) => this.extractText(c)).join('')}**`;
      case 'emphasis':
        return `*${((node as Content & { children: Content[] }).children).map((c) => this.extractText(c)).join('')}*`;
      case 'delete':
        return `~~${((node as Content & { children: Content[] }).children).map((c) => this.extractText(c)).join('')}~~`;
      case 'link': {
        const linkNode = node as Content & { url: string; title?: string | null; children: Content[] };
        const text = linkNode.children.map((c) => this.extractText(c)).join('');
        if (linkNode.title) {
          return `[${text}](${linkNode.url} "${linkNode.title}")`;
        }
        return `[${text}](${linkNode.url})`;
      }
      case 'listItem': {
        const children = (node as Content & { children: Content[] }).children;
        const paragraphs = children.filter((c) => c.type === 'paragraph');
        if (paragraphs.length > 0) {
          return paragraphs.map((p) => this.extractText(p)).join('\n');
        }
        return children.map((c) => this.extractText(c)).join('');
      }
      default:
        break;
    }

    // Plain text/value nodes
    if ('value' in node && typeof node.value === 'string') {
      return node.value;
    }

    // Container nodes — recurse into children
    if ('children' in node && Array.isArray(node.children)) {
      return (node.children as Content[]).map((c) => this.extractText(c)).join('');
    }

    return '';
  }

  private createBlock(type: BlockType, content: string): Block {
    return {
      id: this.generateId(),
      type,
      content,
      attrs: {},
      children: [],
    };
  }

  private idCounter = 0;
  private generateId(): string {
    return `block-${Date.now()}-${++this.idCounter}`;
  }
}
