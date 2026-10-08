# Space and Folder Configuration

Cept reads two kinds of YAML config files. They look alike but do different jobs.

| File                                | Where                          | What it does                                                          |
| ----------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `space.cept.yaml` (or `.yml`)       | The root folder of a space     | Marks the folder as a space and describes it (name, slug, branch).    |
| `.cept.yaml` (or `.yml`)            | Any folder inside a space      | Cept settings for that folder and everything below it. Never a marker. |

All keys are camelCase. Both files are plain YAML, so quoting rules apply: a name such as `Plans: 2026 # roadmap` must be quoted (Cept quotes it for you when it writes the file).

## `space.cept.yaml`

```yaml
version: '1'
name: My Engineering Notes
slug: engineering-notes
branch: docs # optional
```

| Key       | Required | Rules                                                                                                                      |
| --------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `version` | yes      | Schema version, currently `'1'`. An unquoted `1` is accepted and read as `'1'`. Any other value is an error ("unsupported version"). |
| `name`    | yes      | Display name. Not empty.                                                                                                   |
| `slug`    | yes      | URL-friendly id: lowercase `a-z`, `0-9` and `-`, 1 to 63 characters, not starting or ending with `-`.                     |
| `branch`  | no       | Branch Cept uses for this space. The marker file itself must exist on the repository's default branch. Not empty if present. |

Unknown keys are kept and written back unchanged, so a newer or hand-edited file does not lose data.

### `.yaml` and `.yml`

Both `space.cept.yaml` and `space.cept.yml` are recognized. If both exist in the same folder, `space.cept.yaml` wins, `space.cept.yml` is ignored, and Cept reports a warning. The same rule applies to `.cept.yaml` and `.cept.yml`.

### How Cept finds spaces

When you open a folder or a repository, Cept looks through it for `space.cept.yaml` files without changing anything. Every folder that holds one is a space, so one repository can hold several spaces in different folders.

- Cept does not look for more spaces inside a space. A `space.cept.yaml` inside another space is not opened as a space; Cept can warn about it, because nested spaces are not supported yet.
- Folders whose name starts with `.` (such as `.git` and `.cept`) are never searched.
- Two spaces found in the same folder or repository must not share a `slug`. If they do, both are shown with an error until one is renamed.
- If the space, or any folder above it, holds a `.git` folder (or a `.git` file, as git worktrees and submodules use), the space is part of that git repository.

## `.cept.yaml`

A `.cept.yaml` in a folder configures that folder and everything below it. It never defines a space. Cept writes one only when you change a setting in that folder; opening or browsing never creates or rewrites it.

```yaml
ignore:
  - drafts/
  - '*.tmp'
  - '!keep.tmp'
```

| Key      | Meaning                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ignore` | List of gitignore-style patterns, relative to the folder holding this file. Matches are hidden from the page tree, search, backlinks and the graph. |
| `hide`   | Alias of `ignore`. If both keys are present the lists are combined (`ignore` first, then `hide`, duplicates removed). Cept writes `ignore`. |

Unknown keys are kept and written back unchanged. An empty file is a valid, empty config.

### Pattern syntax

Patterns follow `.gitignore`: `*` and `?` globs, `**` for any depth, a leading `/` anchors the pattern to the folder holding the file, a trailing `/` matches folders only, and a leading `!` re-includes something an earlier pattern hid. The last matching pattern in a file wins. A file inside a hidden folder cannot be re-included.

### Default hidden paths

Without any configuration, every dotfile and dotfolder at any depth is hidden. That includes `.git/`, `.cept/` and `.cept.yaml` itself. Patterns cannot re-include them.

### How folders combine

Cept merges the `.cept.yaml` files from the space root down to the folder in question.

- **Settings:** for each key, the nearest folder that sets it wins; keys it does not set come from ancestors.
- **`ignore`:** patterns are not replaced. Each folder's patterns apply to its own subtree, relative to that folder. Where several folders match a path, the deepest one decides, so a child can re-include (`!name`) something a parent hid.

Example: the root has `ignore: ['*.tmp']` and `team/docs/.cept.yaml` has `ignore: ['!keep.tmp']`. Then `a.tmp` and `team/x.tmp` are hidden, but `team/docs/keep.tmp` is visible.

## How folders become pages

A space is a folder, and Cept reads its page tree straight from the files in it.

- **Pages are Markdown files.** Every `.md` or `.markdown` file is a page. Other files (images, attachments) are not pages and are never changed by Cept.
- **Folders are pages too.** A folder holding pages is a page with those pages inside it. Its own content comes from `index.md`, or `README.md` if there is no `index.md` (names are matched without regard to case). If a folder has both, `index.md` is the folder page and `README.md` is shown as an ordinary page inside it. A folder with neither shows a list of its pages.
- **Left out of the tree:** paths hidden by default or by `ignore:` (see above), folders that hold no pages at any depth, and folders with their own `space.cept.yaml`, which are separate spaces.
- **Page addresses are paths.** A page is identified by its path from the space root, such as `guides/setup.md`, or `guides` for a folder page. Renaming or moving a page renames or moves its file, so its address changes with it.
- **Order:** pages are sorted by name, with numbers compared by value (`2-basics` before `10-advanced`).

When you add a page inside a page that is a single file, such as `guides/setup.md`, Cept turns it into a folder page: the file moves to `guides/setup/index.md` and the new page goes next to it. A new folder page gets an `index.md`.
