# Pattern Adherence Review — PR #67

**Score: 72 / 100**

## Summary

The PR largely follows the existing codebase patterns: all persistence goes through `StorageBackend`, no platform-specific imports appear in `@cept/ui`, and the new `::` separator is well-documented with backward compatibility. However, there are several pattern deviations worth addressing: the `resolveRouteToSpace` function is placed in the wrong layer, `instanceof BrowserFsBackend` checks violate the backend-abstraction rule, and the `NotFoundPage` component uses `window.history.back()` directly rather than going through the router abstraction.

## Detailed Findings

### 1. `resolveRouteToSpace` placement in SpaceManager (Moderate)

**File:** `packages/ui/src/components/storage/SpaceManager.ts`

The `resolveRouteToSpace` function is a routing-layer concern (it resolves URL-parsed route parameters to configured spaces) but lives in `SpaceManager.ts`, which is a storage/persistence module. The function imports nothing from the router, but it bridges two concerns: route parsing and space manifest lookup.

The existing pattern is clear: `router.ts` handles URL parsing and building; `SpaceManager.ts` handles space CRUD and file paths. `resolveRouteToSpace` should arguably live in `router.ts` or a new `route-resolver.ts` module, accepting the manifest as a parameter (which it already does).

That said, the function does depend on `parseRemoteSpaceId` and `SpaceMeta` from SpaceManager, so the coupling is understandable. This is a judgment call, not a hard violation.

### 2. `instanceof BrowserFsBackend` checks (Pre-existing, but extended)

**File:** `packages/ui/src/components/App.tsx`, line ~347

```
if (isRemoteSpaceId(resolvedSpaceId) && backend instanceof BrowserFsBackend) {
```

Architecture Rule #3 states: "`@cept/core` and `@cept/ui` depend ONLY on `StorageBackend`, NEVER on a specific backend implementation." The `instanceof BrowserFsBackend` pattern is pre-existing in `App.tsx` (4 occurrences), so PR #67 is not introducing a new violation, but it continues to rely on it. The PR should not be blocked for this, but it is worth noting that the correct pattern per CLAUDE.md Rule #4 would be a `backend.capabilities` check.

### 3. `window.history.back()` in NotFoundPage (Minor)

**File:** `packages/ui/src/components/not-found/NotFoundPage.tsx`, line 52

The `NotFoundPage` component calls `window.history.back()` directly in the "Go Back" button handler. The rest of the codebase routes through `pushRoute`/`replaceRoute`/`restoreRoute` from `router.ts`. While `history.back()` is not a route-building operation, the other two actions (`onGoHome`, `onGoToDocs`) are properly delegated to the parent via callbacks. For consistency, the "Go Back" action could also be a callback prop.

### 4. `window.location.pathname` in App.tsx (Minor)

**File:** `packages/ui/src/components/App.tsx`, lines ~415, ~423

```
const currentPath = window.location.pathname;
setNotFound({ path: window.location.pathname, message: '...' });
```

Direct `window.location` reads appear in the App component for the 404 state. The router already encapsulates pathname access via `parseRoute()`. Using the already-parsed route information would be more consistent.

### 5. `::` Separator Convention (Good, well-executed)

**Files:** `packages/ui/src/components/storage/SpaceManager.ts`, `packages/ui/src/router.ts`

The `::` separator for `branch::subPath` is a thoughtful addition that resolves a real ambiguity (branch names with `/`). It is:
- Clearly documented with a `SUBPATH_SEPARATOR` constant
- Backward-compatible (legacy `/` format still parsed)
- Consistently used in both `generateRemoteSpaceId` and `parseRemoteSpaceId`
- Properly handled in `spaceIdToUrlPath` for URL building
- Covered by tests for both new and legacy formats

This is a well-executed convention change.

### 6. File extension heuristic for page detection (Good)

**File:** `packages/ui/src/router.ts`

The shift from `git-` prefix convention to file-extension-based detection (`FILE_EXTENSIONS` regex) for distinguishing files from directories in URLs is a significant pattern change. The old approach (`last.startsWith('git-')`) was brittle and caused page ID collisions (as the new test demonstrates). The new approach mirrors GitHub's own URL semantics, which is consistent with the `/g/` prefix design that already mirrors GitHub URLs.

### 7. Persistence through StorageBackend (Good)

All file reads and writes in the diff go through `backend.readFile`, `backend.writeFile`, `backend.deleteFile`, and `backend.listDirectory`. No direct filesystem access. The new `readCeptYaml`, `pageIdToFilename`, and `walkMarkdownFiles` changes all properly use the `StorageBackend` interface. This fully adheres to Architecture Rule #2.

### 8. No platform-specific imports (Good)

No `electron`, `@capacitor/*`, `node:fs`, or `isomorphic-git` imports appear in any `@cept/ui` file. Architecture Rule #1 is respected.

### 9. Minimal YAML parser instead of dependency (Acceptable)

**File:** `packages/ui/src/components/storage/git-space.ts`

The `parseCeptYaml` function is a hand-rolled minimal YAML parser. This avoids adding a dependency for a very narrow use case (just `hide: [list]`). It is well-tested and clearly scoped. The risk is that it will need to grow if `.cept.yaml` gains more fields, but for now this is a reasonable choice.

### 10. Inactive space stats loading pattern (Concern)

**File:** `packages/ui/src/components/App.tsx`, lines ~1130-1180

The `useEffect` that loads stats for inactive spaces iterates through all spaces and reads every page's content to estimate size. This is an O(spaces * pages) operation that could be expensive. While the pattern of loading data in a `useEffect` and storing in state is standard React, this particular implementation reads all page content just to measure `.length`. This is a performance concern more than a pattern concern, but it does not follow any existing caching or lazy-loading pattern in the codebase.

## Inline Comments

| File | Line/Area | Comment |
|---|---|---|
| `packages/ui/src/components/not-found/NotFoundPage.tsx` | L52 | `window.history.back()` called directly; consider making this a callback prop like `onGoHome`/`onGoToDocs` for consistency with the delegation pattern used for the other actions. |
| `packages/ui/src/components/App.tsx` | L415, L423 | `window.location.pathname` read directly; the route is already parsed — consider passing `route.spaceId` or the built path from `buildPath()` instead. |
| `packages/ui/src/components/storage/SpaceManager.ts` | L276-367 (`resolveRouteToSpace`) | This function bridges routing and space resolution. Consider whether it belongs closer to the router layer, or document why SpaceManager is the right home for it. |
| `packages/ui/src/components/App.tsx` | L1150-1180 | Loading all page content for inactive spaces to compute `contentSize` is expensive. Consider storing size metadata in the space manifest or computing it lazily. |
| `packages/ui/src/components/storage/SpaceManager.ts` | L296-297 | Redundant branches: both `if (exact)` and the else return the same value `{ spaceId: routeSpaceId, pageId: undefined }`. Simplify to a single return. |

## References

- `/home/user/cept/CLAUDE.md` — Architecture Rules #1-#4 (platform imports, StorageBackend, backend abstraction, capabilities checks)
- `/home/user/cept/packages/ui/src/router.ts` — Existing routing patterns (parseRoute, buildPath, pushRoute, replaceRoute)
- `/home/user/cept/packages/ui/src/components/storage/SpaceManager.ts` — Space management patterns, new `resolveRouteToSpace` and `::` separator
- `/home/user/cept/packages/ui/src/components/not-found/NotFoundPage.tsx` — New component
- `/home/user/cept/packages/ui/src/components/storage/git-space.ts` — `walkMarkdownFiles` changes, new `parseCeptYaml`
- `/home/user/cept/packages/ui/src/components/storage/StorageContext.tsx` — `pageIdToFilename` and updated read/write functions
