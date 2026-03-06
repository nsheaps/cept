---
title: Markdown Extensions
---

# Markdown Extensions

Cept uses standard Markdown as its primary content format, with a few extensions for rich blocks that go beyond standard Markdown capabilities.

## Standard Markdown

These blocks use standard Markdown syntax:

| Block | Syntax |
| --- | --- |
| Headings | `# `, `## `, `### ` |
| Bold | `**text**` |
| Italic | `*text*` |
| Strikethrough | `~~text~~` |
| Inline code | `` `code` `` |
| Code block | ```` ```lang ``` ```` |
| Bullet list | `- item` or `* item` |
| Numbered list | `1. item` |
| Task list | `- [ ] item` or `- [x] item` |
| Blockquote | `> text` on every line |
| Horizontal rule | `---` |
| Link | `[text](url)` |
| Image | `![alt](url)` |
| Table | Pipe-delimited table syntax |

## Cept Extensions

### Toggles

Toggles use the `> ` prefix with indented content. See the [Toggle Syntax](./toggle-syntax.md) guide for full details.

### Callouts

Callouts use HTML `<div>` tags with data attributes:

```html
<div data-type="callout" data-icon="💡" data-color="default">
  <p>Callout content</p>
</div>
```

### Mermaid Diagrams

Mermaid diagrams use fenced code blocks with the `mermaid` language tag:

````markdown
```mermaid
graph TD
  A --> B
  B --> C
```
````

### Math Equations

Math uses LaTeX syntax:

- **Block**: `$$E = mc^2$$`
- **Inline**: `$a^2 + b^2 = c^2$`

## Design Principles

1. **Markdown first** — Standard markdown is preferred for all content that has a natural markdown representation
2. **HTML fallback** — Rich blocks that extend markdown use HTML with `data-type` attributes
3. **Interoperability** — Files can be opened in any markdown editor; extended blocks render as HTML
4. **No proprietary format** — Everything is plain text, never binary or opaque
