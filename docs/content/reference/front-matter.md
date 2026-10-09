# Page Front Matter

A page can start with a block of YAML, called front matter, that holds its metadata. Cept reads the same front matter as Obsidian, Jekyll and Hugo, so you can open those folders without converting anything.

```markdown
---
title: Weekly review
tags: [planning, team]
created: 2026-01-05
# Hugo keeps its own settings here too; Cept leaves them alone.
draft: false
---

# Weekly review

Notes go here.
```

The block starts with `---` on the first line of the file and ends with `---` or `...` on a line of its own. A file may start with a UTF-8 byte order mark before the `---`.

## Keys Cept reads

All keys are camelCase.

| Key           | Type                                     | Meaning                                                                 |
| ------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `title`       | text                                     | The page title.                                                         |
| `icon`        | text                                     | An emoji, or a relative path or URL to an image.                        |
| `cover`       | text                                     | A relative path or URL to a cover image.                                |
| `tags`        | list of text (one text value is a list of one) | Tags.                                                             |
| `aliases`     | list of text (one text value is a list of one) | Other names for the page.                                         |
| `description` | text                                     | A short summary.                                                        |
| `created`     | date (`2026-01-05`) or date and time     | When the page was created.                                              |
| `updated`     | date or date and time                    | When the page last changed in a meaningful way.                         |
| `order`       | number                                   | Sort position among sibling pages.                                      |
| `id`          | text                                     | An optional stable id. Without it, a page is known by its path.         |

Cept also reads `date` as `created`, and `lastmod` or `modified` as `updated`, when the main key is missing. It never writes these older names.

A value of the wrong type (for example `title: [a, b]`) is ignored, and the file keeps it as written.

## The page title

The title is the `title` key. Without it, the title is the first level-1 heading (`# Heading`) in the page. Without that, it is the file name without `.md`; for a `README.md` or `index.md`, it is the folder name.

## What Cept keeps

- The editor shows the page body only. The front matter is never shown as page text.
- Saving a page writes the front matter back byte for byte: unknown keys, key order, comments, quoting, blank lines and the byte order mark all stay.
- Cept never adds front matter to a file you have not given metadata in Cept.
- Front matter that is not valid YAML is kept exactly as it is and never rewritten.
