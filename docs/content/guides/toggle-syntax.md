# Toggle Syntax

Toggles are collapsible content blocks. They use a blockquote-like syntax with indented content.

## Syntax

A toggle starts with `> ` followed by the summary text. The content inside the toggle is indented by 2 spaces (or aligned to the list item continuation indent when inside a list).

```
> Summary text
  Content inside the toggle
```

### Rules

1. **Start**: A line beginning with `> ` followed by text
2. **Content**: Subsequent lines indented by 2 spaces (top-level) or at the list item continuation indent (in lists)
3. **Single blank line**: Continues the toggle (does not end it)
4. **Two blank lines**: Ends the toggle
5. **Distinction from blockquotes**: If the next non-blank line after `> text` starts with `>`, it is a blockquote. If it is indented (no `>`), it is a toggle.

---

## Test Cases

Each example below demonstrates a specific toggle behavior. These are all covered by automated tests.

### 1. Basic toggle with content

```markdown
> Toggle text
  Stuff in toggle

  Still in toggle

  - list in toggle
    - with item inside
```

A toggle with the summary "Toggle text". The indented content includes paragraphs and a nested list. A single blank line between paragraphs does not end the toggle.

---

### 2. Toggle in a list (single blank line continues toggle)

```markdown
- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle
    - next item in list
```

A toggle nested inside a bullet list. The content lines align with the list item continuation indent (column 6 in this case). The toggle ends when a line at the list level appears (`- next item in list`).

---

### 3. Toggle in a list (blank line before next item)

```markdown
- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle

    - next item in list
```

Same as above, but with a blank line before the next list item. The single blank line does not end the toggle; the next `- ` at list indent does.

---

### 4. Two blank lines end the toggle

```markdown
- list
  - item
    - nested
    - > toggle in list
      In toggle

      Still in toggle


    - new indented list
    - because 2 empty lines ends the toggle
```

Two consecutive blank lines terminate the toggle. Content after the double blank is a new element, not part of the toggle.

---

### 5. Toggle with nested list content

```markdown
- list
  - item
    - nested
    - > toggle in list
      - nested
      - items
        - lol
```

The toggle's content is itself a list with nested items.

---

### 6. H1 heading toggle

```markdown
> # h1 toggle
  Content inside
```

The summary text includes a heading marker (`# `). The toggle renders with a heading-styled summary.

---

### 7. H3 heading toggle (ATX style)

```markdown
> ### h3 toggle atx style
  Content inside
```

ATX-style headings (using `#` markers) work in toggle summaries. Setext-style headings (underlines) do not work as toggle summaries. The WYSIWYG editor defaults to ATX style but renders both properly, auto-converting on edit.

---

### 8. Toggle with heading in list context

```markdown
- list
- with
  - nested items
  - > ## with a random heading!
    Content inside
```

Heading toggles work inside lists too.

---

### 9. Regular blockquote (not a toggle)

```markdown
> This is a quote
> More quote text
```

When the line following `> text` also starts with `>`, it is a standard blockquote, not a toggle.

---

### 10. Standalone blockquote line (not a toggle)

```markdown
> Just a quote

Next paragraph.
```

A `> text` line with no indented continuation is a regular blockquote.

---

## Serialization

When a toggle block is serialized to Markdown, it uses the same syntax:

```markdown
> Summary text
  Child content indented by 2 spaces
```

The `<!-- cept:block -->` HTML comment syntax is **not** used for toggles.
