# Documentation and Comments Review: PR #67

**Score: 72 / 100**

## Explanation

This PR delivers solid documentation in the core logic files (router, SpaceManager, git-space) but has gaps in several areas: the new `NotFoundPage` component lacks JSDoc on its interface properties beyond the module header, the `.cept.yaml` format has no standalone documentation for end-users, several internal helper functions lack `@param`/`@returns` annotations, and inline comments in `App.tsx` are sparse for complex new logic like `resolveRouteToSpace` integration and inactive space stats loading.

### Strengths

1. **Module-level doc headers are thorough.** `router.ts` has an excellent module comment explaining the full URL scheme, the `blob` convention, the `redirectToGitUrl` behavior, and the 404.html hack. `SpaceManager.ts` and `git-space.ts` also have clear module headers.

2. **The `SUBPATH_SEPARATOR` constant and `::` format are well-documented.** The rationale for choosing `::` over `/` is clearly explained with examples in both `SpaceManager.ts` (lines 96-104) and `router.ts` (lines 131-136).

3. **`resolveRouteToSpace` has a strong JSDoc block.** It explains the problem (minimal spaceId from URL parser), the strategy (match configured spaces by subPath), and includes `@returns`. The inline comments within the function body explain the scoring strategy and multi-segment branch handling.

4. **`parseGitSpaceUrl` has clear doc with examples.** Two concrete examples show the file-detection vs. directory-detection cases (lines 152-166 in the final file).

5. **PR body is well-structured.** It references all 7 issues with checkbox links, groups the test plan by issue number, and describes concrete verification steps.

6. **Commit messages are descriptive and follow conventional commits.** Each commit is prefixed with `fix:`, includes a brief description, and closes a specific issue.

### Weaknesses

1. **`NotFoundPage` interface properties lack JSDoc.** While the interface has `/** */` comments on each prop, the component function itself has no `@param` or `@returns` documentation. More importantly, the behavioral contract (when does `notFound` state get set, when does it get cleared) is not documented anywhere.

2. **`.cept.yaml` format is not documented for end-users.** The `parseCeptYaml` function has a one-line JSDoc saying it supports `hide:` with a list. But there is no documentation file, README section, or even an extended comment explaining the full `.cept.yaml` schema for repository maintainers who would place this file in their repos. The `CeptFolderConfig` interface is the closest thing to a schema, but it only has `hide?: string[]` with a single-line comment.

3. **`pageIdToFilename` in `StorageContext.tsx` has a JSDoc but no `@param`/`@returns`.** This is a new helper that normalizes page IDs with file extensions -- the edge cases it handles (already has `.md`, `.markdown` extension) could use explicit documentation.

4. **`extractFrontMatter` is undocumented on its limitations.** It uses a simple regex and key-value parser, but does not note that it only handles flat string values (no nested YAML, no arrays, no multiline values). Users extending this would benefit from knowing its subset.

5. **Inactive space stats loading in `App.tsx` (lines 1122-1180) has no function-level doc.** The `useEffect` block that loads stats for inactive spaces is a significant new behavior. The only documentation is a one-line comment `// Load stats for inactive spaces asynchronously`. The performance implications (reads all pages for all inactive spaces) are not noted.

6. **`AppMenuProps.githubUrl` has a JSDoc comment, but `FileBrowserProps.rootPath` does not.** The `rootPath` prop was newly wired up in this PR but the existing interface lacks a doc comment explaining what it means.

7. **`FILE_EXTENSIONS` regex is documented with a one-liner but the choice of extensions is not explained.** Why `.mdx`, `.txt`, `.html` but not `.rst` or `.org`? A brief rationale would help future maintainers.

## References

| File | Lines | Topic |
|------|-------|-------|
| `packages/ui/src/router.ts` | 1-27 | Module-level URL scheme documentation (excellent) |
| `packages/ui/src/router.ts` | 131-146 | `spaceIdToUrlPath` doc with `::` examples |
| `packages/ui/src/router.ts` | 148-149 | `FILE_EXTENSIONS` -- minimal doc |
| `packages/ui/src/router.ts` | 151-166 | `parseGitSpaceUrl` doc with examples |
| `packages/ui/src/components/storage/SpaceManager.ts` | 95-105 | `SUBPATH_SEPARATOR` rationale |
| `packages/ui/src/components/storage/SpaceManager.ts` | 107-114 | `generateRemoteSpaceId` doc |
| `packages/ui/src/components/storage/SpaceManager.ts` | 129-133 | `parseRemoteSpaceId` doc |
| `packages/ui/src/components/storage/SpaceManager.ts` | 248-275 | `resolveRouteToSpace` doc (good) |
| `packages/ui/src/components/storage/git-space.ts` | 96-102 | `CeptFolderConfig` interface (thin) |
| `packages/ui/src/components/storage/git-space.ts` | 106-108 | `parseCeptYaml` doc |
| `packages/ui/src/components/storage/git-space.ts` | 163-178 | `extractFrontMatter` -- no limitations noted |
| `packages/ui/src/components/storage/git-space.ts` | 180-195 | `walkMarkdownFiles` doc (improved) |
| `packages/ui/src/components/not-found/NotFoundPage.tsx` | 1-17 | `NotFoundPage` module header and interface |
| `packages/ui/src/components/storage/StorageContext.tsx` | 257-265 | `pageIdToFilename` doc (adequate but brief) |
| `packages/ui/src/components/settings/FileBrowser.tsx` | 4-9 | `FileBrowserProps` -- `rootPath` undocumented |

## Inline Comments

### `packages/ui/src/components/storage/git-space.ts` (CeptFolderConfig)

**Line 96-102** -- The `.cept.yaml` format needs more documentation. Currently the only reference is a TypeScript interface with one field. Consider adding a doc block that describes the intended usage for repository maintainers:
```
/**
 * Configuration from a .cept.yaml file placed in any directory of a Git repository.
 * Cept reads this file when cloning/syncing to customize how the directory is presented.
 *
 * Supported keys:
 *   hide: string[]  -- List of file or directory names to exclude from the sidebar.
 *                       Patterns are matched against the basename (not full path).
 *                       Example: hide: [node_modules, .github, specs]
 *
 * Only configuration settings belong here; metadata like titles comes from
 * frontmatter in individual markdown files.
 */
```

### `packages/ui/src/components/storage/git-space.ts` (extractFrontMatter)

**Line 163-168** -- The function should document its parsing limitations:
```
/**
 * Extract YAML front matter from markdown content and return it as key-value pairs.
 * Returns null if no front matter is found.
 *
 * Note: This is a minimal parser that only handles flat `key: value` pairs
 * (string values). Nested objects, arrays, and multiline values are not supported.
 */
```

### `packages/ui/src/components/storage/StorageContext.tsx` (pageIdToFilename)

**Line 257-265** -- Add `@param` and `@returns` for clarity:
```
/**
 * Normalize a page ID to a storage filename.
 * If the page ID already ends with .md or .markdown, use it as-is.
 * Otherwise, append .md.
 *
 * @param pageId - The page identifier (may or may not include a file extension)
 * @returns A filename suitable for storage, always ending with .md or .markdown
 */
```

### `packages/ui/src/router.ts` (FILE_EXTENSIONS)

**Line 148-149** -- Briefly note the rationale for included extensions:
```
/**
 * Known file extensions that indicate a page (file) rather than a directory.
 * These are the content formats Cept can render or is expected to support.
 * Used by parseGitSpaceUrl to distinguish file URLs from directory URLs.
 */
```

### `packages/ui/src/components/settings/FileBrowser.tsx` (rootPath prop)

**Line 6** -- The `rootPath` prop should have a JSDoc comment now that it is actively used:
```
/** Root directory to start browsing from (defaults to '/'). Set to a space-specific path to scope the browser. */
rootPath?: string;
```

### `packages/ui/src/components/App.tsx` (inactive space stats effect)

**Lines ~1150-1180** -- The effect that loads stats for all inactive spaces should document its performance characteristics:
```
// Load page count and content size for inactive spaces.
// WARNING: This reads all page files for every inactive space on mount and
// whenever the manifest or active space changes. For large numbers of spaces
// or pages, this may cause noticeable latency.
```
