# Simplicity Review: PR #67

**Score: 58/100**

## Summary

This PR tackles real problems (page ID collisions, branch names with slashes, 404 handling, content browsing) but introduces more complexity than necessary in several areas. The `resolveRouteToSpace` function is the most concerning -- it implements a scoring-based matching system with multiple fallback strategies that is hard to reason about. The router/SpaceManager split for URL parsing now requires two-phase resolution (parse then resolve), adding a layer of indirection that could be avoided if the router were given access to the space manifest. The inline space stats loading in App.tsx is a heavyweight addition with potential performance issues. Several simpler alternatives exist for the problems being solved.

## Detailed Findings

### 1. `resolveRouteToSpace` is over-engineered (SpaceManager.ts:276-367)

This 90-line function implements a scoring-based matching algorithm with candidate filtering, score computation (`spaceBranch.length * 10 + subPath.length`), sorting, and best-match selection. The scoring formula is arbitrary and the multi-step resolution (build `fullPath`, iterate candidates, compute scores, sort, pick best) is complex for what it does.

A simpler approach: since spaces are explicitly configured with `branch` and `subPath` fields, a direct lookup by iterating spaces and checking if the URL path starts with `branch + "/" + subPath` would suffice. The scoring is only needed because the function tries to handle ambiguous legacy formats simultaneously with the new `::` format -- but the new format was specifically introduced to eliminate ambiguity.

- `SpaceManager.ts:326`: The `Match` type alias defined inline with 5 fields including a `score` is a code smell for a function that should be doing simple prefix matching.
- `SpaceManager.ts:336`: Score formula `spaceBranch.length * 10` is a magic number with no clear rationale for the multiplier.
- `SpaceManager.ts:295-297`: The two identical return statements (`if (exact)` and the fallback) could be collapsed into one.

### 2. Two-phase URL resolution adds unnecessary indirection

The router (`parseGitSpaceUrl`) now returns a "minimal" spaceId (just `repo@branch`), and then `resolveRouteToSpace` is called separately in App.tsx to find the actual configured space. This split means the same URL parsing logic is partially in the router and partially in SpaceManager, with the router deliberately producing incomplete results that need post-processing.

A simpler design: either give the router access to the manifest so it can resolve fully in one pass, or have the router return the raw URL segments and let a single function do all the interpretation. The current approach requires callers to remember to call `resolveRouteToSpace` after `parseRoute`.

- `App.tsx:317-319` (diff line 43-47): The `resolveRouteToSpace` call is needed in initial route handling.
- `App.tsx:552-556` (diff line 120-123): The same resolution is duplicated in the popstate handler.

### 3. Inactive space stats loading is heavyweight (App.tsx:1122-1180)

The `useEffect` that loads stats for inactive spaces reads every page's content for every inactive space on every render where `spacesManifest` or `userSpaceId` changes. This is O(spaces * pages) file reads with no caching, debouncing, or pagination. For a user with several cloned repositories, this could trigger hundreds of file reads.

- `App.tsx:1148-1155` (diff lines around 153-169): The nested loop reads content for every page in every inactive space just to compute `size += content.length`. A simpler approach would be to store `pageCount` and `contentSize` in the space manifest at clone/sync time, avoiding runtime computation entirely.

### 4. Custom YAML parser when a simpler approach exists (git-space.ts:124-161)

The `parseCeptYaml` function is a hand-rolled YAML parser that handles inline arrays, block lists, quoted values, and state transitions. While the comment says "minimal", it is still 40 lines of parser code. Since the only field used is `hide`, a simpler approach would be to use a line-based format (one entry per line) or just a JSON file (`.cept.json`), avoiding YAML parsing entirely. If YAML is required, a tiny dependency or simpler regex would suffice for a single-key config.

### 5. GitHub icon SVG is duplicated three times

The GitHub octocat SVG path appears in:
- `AppMenu.tsx:305` (toolbar button)
- `AppMenu.tsx:327` (dropdown menu item)
- Previously in `App.tsx` docs banner (removed but was also duplicated)

This should be extracted to a shared constant or small component.

### 6. The `githubUrl` computation uses an IIFE in JSX (App.tsx:1215-1224)

The immediately-invoked function expression computing `githubUrl` in the JSX props is 9 lines of logic inline in the render. This should be a `useMemo` or a simple helper function for readability.

```
githubUrl={(() => {
  if (activeSpace === 'docs' && docsSelectedPageId) {
    return getDocsSourceUrl(docsSelectedPageId) ?? undefined;
  }
  // ... 5 more lines
})()}
```

### 7. `pageIdToFilename` is simple and good (StorageContext.tsx:267-270)

This small utility is a good example of appropriate simplicity -- it handles the extension normalization in 3 lines without over-engineering.

### 8. NotFoundPage component is appropriately simple

The `NotFoundPage.tsx` is a clean, focused component with clear props and no unnecessary abstraction. Good.

### 9. The `FILE_EXTENSIONS` regex heuristic in the router (router.ts:149)

Using file extension detection to distinguish files from directories is a pragmatic choice, but it creates a hidden coupling: any new file type supported by Cept must be added to this regex. A comment noting this would help.

## Inline Comment Suggestions

- `packages/ui/src/components/storage/SpaceManager.ts:295-297`: Collapse the two identical branches: `if (!routePageId) return { spaceId: routeSpaceId, pageId: undefined };`
- `packages/ui/src/components/storage/SpaceManager.ts:326`: Consider replacing the scoring system with simple "longest prefix match" -- iterate candidates, keep the one with the longest `branch + subPath` match. No scoring needed.
- `packages/ui/src/components/storage/SpaceManager.ts:336`: The `* 10` multiplier is a magic number. If scoring is kept, document why branch length is weighted 10x over subPath length.
- `packages/ui/src/components/App.tsx:1148-1170`: Consider storing pageCount/contentSize in SpaceMeta at clone time instead of computing at render time. This would eliminate the O(n*m) file reads.
- `packages/ui/src/components/App.tsx:1215`: Extract the IIFE into a `useMemo` for `githubUrl`.
- `packages/ui/src/components/app-menu/AppMenu.tsx:305`: Extract the GitHub SVG icon to a shared constant to avoid triple duplication.
- `packages/ui/src/router.ts:149`: Add a comment noting that new file types must be added to `FILE_EXTENSIONS` for URL routing to work correctly.
- `packages/ui/src/components/storage/git-space.ts:124`: Consider whether `.cept.json` would be simpler than a hand-rolled YAML parser, given only one key (`hide`) is used.
