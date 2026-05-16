# Quality Assurance Report — PR #67

**Score: 72 / 100**

## Summary

PR #67 is a substantial refactoring of the git space URL scheme and page ID system, changing from a flattened `git-{dash-encoded}` page ID format to using real file paths as page IDs, introducing a `::` separator for subPath in space IDs to disambiguate from `/` in branch names, and adding several new features (404 page, GitHub link button, `.cept.yaml` config, inactive space stats). The test coverage for the core routing and space resolution logic is strong, but there are notable gaps in other areas and some backward compatibility risks.

---

## Commit Atomicity

The PR touches 11 files across multiple concerns. While the description suggests 7 commits for 7 issues, the diff represents a single cohesive but large changeset. The interleaving of concerns (routing changes, UI features, file-walking improvements, 404 page, settings layout changes) would ideally be separated into more focused commits. The routing + SpaceManager + pageId format changes are tightly coupled and belong together, but the 404 page, GitHub link button, inactive space stats, `.cept.yaml` support, and settings layout refactor could each be independent commits.

**Assessment: Acceptable but not ideal.** Atomicity would be better if UI features (NotFoundPage, GitHub button, settings layout) were separated from the core routing/ID refactor.

---

## Test Quality and Coverage

### Well-Tested Areas

1. **Router (`router.test.ts`)** — 412 lines, excellent coverage:
   - Parsing and building for local spaces, docs, git spaces
   - Base path handling (root `/`, nested `/cept/app/`, preview `/cept/pr-42/`)
   - Legacy `/s/` URL backward compatibility
   - `setUseGitPrefix(false)` fallback
   - **Key roundtrip test** (line 346-363): Verifies URL stability when parse/build cycle changes internal representation
   - **Collision test** (line 278-290): Explicitly tests that `foo/bar.md` and `foo-bar.md` produce distinct page IDs — critical regression test for the old `git-{flattened}` scheme
   - `restoreRoute` with `?route=` param and legacy hash URLs

2. **SpaceManager (`SpaceManager.test.ts`)** — 293 lines, good coverage:
   - `generateRemoteSpaceId` with `::` separator, branches with `/`, `.git` stripping
   - `parseRemoteSpaceId` with both `::` and legacy `/` formats
   - `resolveRouteToSpace` — 8 test cases covering exact match, subPath resolution, nested file paths, fallback, unknown spaces, undefined pageId, and multi-segment branch names

3. **git-space (`git-space.test.ts`)** — 51 lines:
   - `normalizeRepoUrl` — 5 cases
   - `parseCeptYaml` — 5 cases covering inline arrays, block lists, empty content, quoted values, list termination

### Gaps and Missing Tests

1. **NotFoundPage component** — No component tests at all. The `NotFoundPage` is a new user-facing component (`/home/user/cept/packages/ui/src/components/not-found/NotFoundPage.tsx`) with interactive buttons (Go Home, View Docs, Go Back) and conditional rendering. Per the project's testing requirements, "Every new UI component gets component tests."

2. **`pageIdToFilename` function** (`StorageContext.tsx`) — No unit tests. This function has logic for detecting `.md`/`.markdown` extensions and appending `.md` when absent. Edge cases untested:
   - What about page IDs like `readme.md.backup`?
   - What about page IDs with no extension that already exist as `.html`?

3. **`readSpacePageContent` / `writeSpacePageContent` / `deleteSpacePageContent`** — The changes to these functions (using `pageIdToFilename`) have no direct test coverage in this PR.

4. **`extractFrontMatter` function** (`git-space.ts`) — No tests despite being a new function with regex parsing. Edge cases untested:
   - Front matter with colons in values
   - Front matter with multiline values
   - Front matter with special characters

5. **`walkMarkdownFiles` changes** — Significant refactoring (README/index file promotion, `.cept.yaml` hidden files, frontmatter title extraction) with no integration tests. This is the highest-risk area for regressions.

6. **Inactive space stats loading** (`App.tsx` lines ~1147-1180) — New `useEffect` that iterates over all inactive spaces and reads every page's content to estimate size. No tests, and this is a potential performance concern for users with many spaces.

7. **GitHub URL construction** (`App.tsx` lines ~1215-1224) — No tests for the URL-building logic in the `githubUrl` prop computation.

8. **AppMenu with `githubUrl` prop** — No component tests for the new GitHub button rendering and menu items.

---

## Edge Cases

### Tested Edge Cases
- Empty string and root path parsing
- Trailing slashes on base paths
- Branch names containing `/` (e.g., `claude/setup-fix`)
- Legacy `/` subPath separator backward compatibility
- URL collision prevention (path separator vs. dash in filenames)

### Untested Edge Cases

1. **Branch names with `::` in them** — If a branch is named `feature::v2`, the `parseRemoteSpaceId` would incorrectly split on the `::`. No test covers this.

2. **Page IDs with `::` in filenames** — Unlikely but possible in file systems.

3. **FILE_EXTENSIONS regex** — Only tests `.md` files in practice. The regex matches `.mdx`, `.txt`, `.html` too, but no tests exercise those extensions through the router.

4. **parseGitSpaceUrl with no `blob` segment** — The fallback (line 171 in router.ts: `return { spaceId: segments[0], pageId: segments[1] }`) could produce unexpected results for malformed URLs. No test covers this path.

5. **`resolveRouteToSpace` with multiple subPath matches** — The scoring algorithm picks the highest score, but there is no test for two spaces with overlapping subPaths (e.g., `docs` vs. `docs/api`).

6. **`spacePagesDir` with `::` in space IDs** — The path helper uses the space ID directly in file paths: `.cept/spaces/${spaceId}/pages`. If the space ID contains `::`, this creates unusual directory names. The function does not sanitize the ID for filesystem use.

---

## PR Body vs. Actual Changes

Without access to the PR body (gh CLI unavailable), I assess based on the diff content. The changes encompass:

1. **Space ID format change**: `repo@branch/subPath` to `repo@branch::subPath` (with backward compat)
2. **Page ID format change**: `git-{flattened}` to real file paths
3. **Router refactor**: File extension heuristics replace `git-` prefix detection
4. **New `resolveRouteToSpace` function**: Bridges minimal router output to configured spaces
5. **404 page**: New NotFoundPage component
6. **GitHub link**: Moved from docs-only inline to AppMenu for all remote spaces
7. **Settings layout**: Actions grouped in a row
8. **`.cept.yaml` support**: Hide files/folders from sidebar
9. **Frontmatter title extraction**: Titles from `title:` in front matter
10. **README/index promotion**: Index files become folder content
11. **Inactive space stats**: Background loading of page counts
12. **FileBrowser rootPath**: Space-specific file browsing

This is a large surface area. If the PR body claims only routing changes, it under-represents the scope.

---

## Backward Compatibility Risks

### High Risk
- **Existing space IDs with `/` separator**: Users with existing `spaces.json` manifests containing IDs like `github.com/user/repo@main/docs` will still work for parsing (legacy support in `parseRemoteSpaceId`), but newly created spaces will use `::`. The `resolveRouteToSpace` function handles this, but there is **no migration** for existing manifests. Old and new formats will coexist indefinitely.

- **Page ID format change**: Pages previously stored as `git-docs-getting-started.md` are now stored as `docs/getting-started.md`. There is **no migration path** for existing page content files. Users who have cloned repos before this change will have stale page IDs that won't match the new scheme. Re-cloning would be required.

### Medium Risk
- **URL bookmarks will break**: Any bookmarked URL containing `git-` page IDs (e.g., `/g/.../main/docs/git-getting-started`) will no longer parse correctly since the router now looks for file extensions instead of `git-` prefixes. The old URL would be treated as a directory path, not a page.

- **`FILE_EXTENSIONS` heuristic**: Files without standard extensions (e.g., `Makefile`, `Dockerfile`, `LICENSE`) in a git repo would be misidentified as directories by the router. This could cause navigation issues for repos with non-standard file naming.

### Low Risk
- **`spaceIdToUrlPath` uses `rest.replace('::', '/')` without `g` flag**: Only replaces the first occurrence of `::`. This is correct since there should only be one, but if a malformed ID somehow has multiple `::`, only the first would be converted.

---

## Inline Comments

### `/home/user/cept/packages/ui/src/router.ts` line 149
```typescript
const FILE_EXTENSIONS = /\.(md|markdown|mdx|txt|html)$/i;
```
This set is incomplete for a general-purpose git repo viewer. Files like `.rst`, `.adoc`, `.org`, `.tex`, `.json`, `.yaml`, `.toml` would all be treated as directories. Consider whether this should be more inclusive or whether the heuristic should be inverted (check for known directory indicators rather than known file extensions).

### `/home/user/cept/packages/ui/src/router.ts` lines 175-176
```typescript
const branch = segments[blobIdx + 1];
const rest = segments.slice(blobIdx + 2);
```
Only the first segment after `blob` is taken as the branch name. For multi-segment branches like `claude/setup-fix`, this produces `branch="claude"` and the remainder leaks into `rest`. The `resolveRouteToSpace` function compensates for this, but it requires the space to already exist in the manifest. A first-time visitor following a URL with a multi-segment branch to a repo they haven't cloned would get incorrect parsing.

### `/home/user/cept/packages/ui/src/components/storage/SpaceManager.ts` lines 296-297
```typescript
if (exact) return { spaceId: routeSpaceId, pageId: undefined };
return { spaceId: routeSpaceId, pageId: undefined };
```
These two branches do the same thing. The `if (exact)` check is redundant here.

### `/home/user/cept/packages/ui/src/components/storage/StorageContext.tsx` — `pageIdToFilename`
```typescript
function pageIdToFilename(pageId: string): string {
  if (pageId.endsWith('.md') || pageId.endsWith('.markdown')) return pageId;
  return `${pageId}.md`;
}
```
This does not handle `.mdx`, `.txt`, or `.html` — all of which are in the `FILE_EXTENSIONS` regex in the router. A page ID parsed from a `.txt` URL would get `.md` appended, creating a mismatch.

### `/home/user/cept/packages/ui/src/components/App.tsx` — Inactive space stats loading
```typescript
for (const page of flattenPages(spacePages)) {
  try {
    const content = await readSpacePageContent(backend, space.id, page.id);
    if (content) size += content.length;
  } catch { /* ignore */ }
}
```
This reads every page's content sequentially for every inactive space. For users with many spaces containing many pages, this could be very slow and memory-intensive. Consider: (a) limiting to a sampling approach, (b) caching the result, (c) computing this lazily when the settings panel opens.

### `/home/user/cept/packages/ui/src/components/storage/git-space.ts` — `extractFrontMatter`
```typescript
const match = content.match(/^---\n([\s\S]*?)\n---/);
```
This requires the front matter delimiter to start at position 0 with a newline. Files starting with `---\r\n` (Windows line endings) or with a BOM would fail to match. Also, the regex uses `\n---` for the closing delimiter, but YAML front matter in many tools uses `---\n` or `---\r\n`.

### `/home/user/cept/packages/ui/src/components/storage/git-space.ts` — Hidden set inheritance
```typescript
if (parentHidden) {
  for (const h of parentHidden) hiddenSet.add(h);
}
```
Parent hidden patterns are inherited by all children. This means a `hide: [tests]` in a root `.cept.yaml` would hide any `tests` directory at any depth. This may be intentional but could surprise users who only want top-level hiding.

---

## References

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `packages/ui/src/router.ts` | ~60 | URL parsing/building with file extension heuristics |
| `packages/ui/src/router.test.ts` | ~100 | Comprehensive router tests |
| `packages/ui/src/components/storage/SpaceManager.ts` | ~120 | `::` separator, `resolveRouteToSpace` |
| `packages/ui/src/components/storage/SpaceManager.test.ts` | ~70 | Space resolution tests |
| `packages/ui/src/components/storage/git-space.ts` | ~130 | File walking, `.cept.yaml`, frontmatter |
| `packages/ui/src/components/storage/git-space.test.ts` | ~30 | `parseCeptYaml` tests |
| `packages/ui/src/components/storage/StorageContext.tsx` | ~30 | `pageIdToFilename`, read/write with file paths |
| `packages/ui/src/components/App.tsx` | ~100 | Route resolution, 404 state, GitHub URL, stats |
| `packages/ui/src/components/not-found/NotFoundPage.tsx` | 61 (new) | 404 component |
| `packages/ui/src/components/app-menu/AppMenu.tsx` | ~50 | GitHub link button |
| `packages/ui/src/components/settings/SettingsModal.tsx` | ~50 | Layout, rootPath, labels |

---

## Verdict

The core routing and space ID refactoring is well-designed and well-tested. The `resolveRouteToSpace` function elegantly handles the impedance mismatch between URL-parsed minimal space IDs and configured spaces with subPaths. The collision test and roundtrip tests demonstrate careful thinking about correctness.

However, the PR loses points for:
- **Missing component tests** for NotFoundPage and AppMenu changes (-8)
- **Missing unit tests** for `pageIdToFilename`, `extractFrontMatter`, and storage read/write changes (-6)
- **No migration path** for existing page IDs (`git-*` to file paths) (-5)
- **Performance concern** with inactive space stats loading (-3)
- **`pageIdToFilename` inconsistency** with router's `FILE_EXTENSIONS` list (-3)
- **No test for extensionless files** through the router (-3)

The backward compatibility for space IDs (legacy `/` parsing) is handled well, but the page ID format change is a breaking change with no migration, which could strand existing users' data.
