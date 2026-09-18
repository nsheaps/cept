# Flexibility Review: PR #67

**Score: 62 / 100**

## Summary

The PR introduces a significant architectural change -- the `::` separator for space IDs -- that solves a real ambiguity problem with branch names containing `/`. The `resolveRouteToSpace` function is a well-designed addition that cleanly separates URL parsing from space resolution. However, the overall flexibility suffers from several design decisions that will create friction for future changes: the file-extension heuristic for page detection is brittle, the roundtrip between URL and internal representation is lossy, the custom YAML parser will inevitably diverge from real YAML, and the inactive space stats loading has performance concerns that will worsen as usage grows.

## Detailed Findings

### The `::` Separator Format Change (Mixed)

The move from `/` to `::` as a branch/subPath separator is well-motivated -- branch names like `claude/setup-fix` genuinely break the old format. The backward compatibility for parsing legacy `/` format is correctly implemented. However, the design creates an asymmetry: `generateRemoteSpaceId` always produces `::` format, but `parseGitSpaceUrl` in the router never produces `::` format (it uses `/` for directory paths). This means the URL roundtrip is intentionally lossy -- `buildPath` with a `::` space ID produces a URL that `parseRoute` parses back into a `/`-style space ID. The `resolveRouteToSpace` layer patches over this mismatch, but it means the system now has two representations of the same concept that must be kept in sync.

**File:** `packages/ui/src/router.ts`, lines 138-146 (`spaceIdToUrlPath`) and lines 167-197 (`parseGitSpaceUrl`)

### File Extension Heuristic for Page Detection (Brittle)

The `FILE_EXTENSIONS` regex (`/\.(md|markdown|mdx|txt|html)$/i`) determines whether a URL path segment is a file (page) or a directory. This is a hardcoded allowlist that will silently break when new content types are added. A URL like `/g/.../blob/main/docs/guide` is treated as a directory, but `/g/.../blob/main/docs/guide.md` is treated as a file. If someone adds `.rst` or `.adoc` support, existing URLs for those files will be misrouted as directories. There is no central registry of supported extensions, and the regex is defined as a module-level constant with no extension point.

**File:** `packages/ui/src/router.ts`, line 149

### `resolveRouteToSpace` Scoring Algorithm (Well-Designed but Complex)

The scoring-based resolution in `resolveRouteToSpace` is the right approach for handling the ambiguity between the router's single-segment branch assumption and multi-segment reality. The score formula (`branchLength * 10 + subPathLength`) correctly prefers longer (more specific) matches. However, the function is ~100 lines of dense matching logic that operates on string prefixes. Two concerns:

1. The function rebuilds `fullPath` by concatenating `routeParsed.branch + "/" + routePageId`, reconstructing what the URL originally contained. This is fragile -- if the router's parsing changes how it splits branch vs. pageId, this reconstruction breaks silently.

2. When no configured space matches, the function falls through and returns the original values. This is correct for the "auto-clone" flow, but it means resolution behavior depends on the order of operations (resolve first, then clone, then the space exists for next time). There is no way for the caller to distinguish "resolved to existing space" from "no match found."

**File:** `packages/ui/src/components/storage/SpaceManager.ts`, lines 276-367

### Custom YAML Parser (Not Extensible)

The `parseCeptYaml` function is a hand-rolled subset parser that supports only `hide: [...]` syntax. While the PR documents this limitation, the implementation will become a maintenance burden as `.cept.yaml` gains more fields. The parser does not handle: nested objects, multi-line strings, comments on the same line as values, or anchors/aliases. Adding any new configuration key requires modifying this parser. A small YAML library (e.g., `yaml` or `js-yaml`) would be more future-proof without significant bundle cost.

**File:** `packages/ui/src/components/storage/git-space.ts`, lines 124-161

### Inactive Space Stats Loading (Performance Concern)

The `useEffect` that loads stats for inactive spaces iterates over every inactive space, reads its state, then reads every page's content to sum sizes. This runs on every change to `spacesManifest` or `userSpaceId`. For a user with many spaces or large repos, this will cause noticeable UI delays. There is no pagination, cancellation, or caching beyond the React state. The `flattenPages` call is also invoked twice per space (once for count, once for the content loop).

**File:** `packages/ui/src/components/App.tsx`, lines 1122-1180 (the `useEffect` block)

### 404 Not Found State Not Cleared on Navigation

The `notFound` state is set when a space cannot be found or cloning fails. It is cleared by `onGoHome` and `onGoToDocs` button handlers, but it is NOT cleared by browser back/forward navigation (the `popstate` handler does not reset `notFound`). If a user navigates to a bad URL, sees 404, then uses the browser back button, the 404 page may persist over the previous valid content.

**File:** `packages/ui/src/components/App.tsx`, lines 550-138 (popstate handler) and lines 405-108 (notFound setter)

### `pageIdToFilename` Edge Case

The `pageIdToFilename` function appends `.md` when the page ID does not end with `.md` or `.markdown`. But with the new file-path-based page IDs (e.g., `docs/getting-started.md`), all git-sourced pages already have extensions. This means the function behaves differently for git-sourced pages (no-op) vs. locally created pages (appends `.md`). If a local page is somehow given a `.md` suffix in its ID, the file will be `name.md` not `name.md.md`, which is correct -- but this implicit behavior should be documented.

**File:** `packages/ui/src/components/storage/StorageContext.tsx`, lines 261-265

## Inline Comment Suggestions

### router.ts, line 149 (FILE_EXTENSIONS constant)
```
Consider extracting supported file extensions to a shared constant or configuration
so that adding new content types (e.g., .rst, .adoc, .org) only requires a single
change. The router, git-space walker, and page ID logic all need to agree on what
counts as a "file."
```

### router.ts, lines 185-191 (parseGitSpaceUrl file detection)
```
When the last segment has no file extension, this falls through to treating the entire
rest as a subPath. This means a URL like /g/.../blob/main/docs/README (no extension)
is treated as a space root at subPath "docs/README" rather than a page. This matches
GitHub's URL convention, but could surprise users who create extensionless pages. Consider
documenting this behavior in the URL scheme comment at the top of the file.
```

### SpaceManager.ts, lines 293-296 (redundant branches in resolveRouteToSpace)
```
Lines 295-296 are identical: both return { spaceId: routeSpaceId, pageId: undefined }.
The `if (exact)` check on line 296 has no effect. This could be simplified to a single
return statement, or the `if (exact)` branch could set a flag for callers to distinguish
"found but no page" from "not found."
```

### SpaceManager.ts, line 349 (score formula)
```
The scoring formula `spaceBranch.length * 10 + (space.subPath?.length ?? 0)` conflates
branch length with subPath specificity. A branch named "very-long-branch-name" (20 chars)
with no subPath would outscore a branch "main" (4 chars) with subPath "docs/reference" (14 chars):
200 > 40+14=54. This is likely correct in practice (same repo, different branches), but the
weight of 10 is arbitrary. Consider documenting why this weighting was chosen.
```

### App.tsx, lines 1151-1170 (inactive space stats loading)
```
This effect reads every page's content for every inactive space to compute `contentSize`.
For repos with hundreds of pages, this could take seconds and block the main thread.
Consider: (1) computing stats during clone/sync and caching them in SpaceMeta,
(2) using a web worker, or (3) at minimum adding an AbortController to cancel the
effect when dependencies change before it completes.
```

### git-space.ts, lines 124-161 (parseCeptYaml)
```
This hand-rolled YAML parser will need to grow as .cept.yaml gains more configuration
options. Consider using a lightweight YAML library. If keeping the custom parser,
add a comment listing the exact YAML subset supported and link to test cases that
define the contract.
```

### App.tsx, popstate handler (~line 550)
```
The popstate handler does not clear the `notFound` state. If a user hits a 404 and
then navigates back via the browser, the 404 page will persist. Add
`setNotFound(null)` at the start of the popstate handler.
```
