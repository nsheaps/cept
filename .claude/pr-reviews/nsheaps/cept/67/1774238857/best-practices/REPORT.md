# Best Practices Review: PR #67

**Score: 62 / 100**

## Summary

This PR introduces a significant refactoring of git space URL routing (switching from `git-` prefixed flat page IDs to filesystem-path-based page IDs with `::` subPath separators), adds a 404 Not Found page, improves the AppMenu with GitHub links, and adds inactive space stats loading. The test coverage is solid for the pure routing and space management logic, but there are several best practices concerns around React hooks usage, potential memory leaks, missing cleanup in async effects, and the growing complexity of App.tsx.

---

## Detailed Findings

### 1. Missing Abort/Cleanup in Async useEffect (Memory Leak Risk) -- MAJOR

**File:** `packages/ui/src/components/App.tsx`, lines 1129-1159

The `useEffect` that loads inactive space stats fires an async function (`loadStats`) that iterates over every inactive space, reads every page's content, and calls `setInactiveSpaceStats` at the end. There is no `AbortController` or cancelled-flag to prevent state updates after unmount or when dependencies change mid-flight.

```tsx
useEffect(() => {
    if (!spacesManifest) return;
    const loadStats = async () => {
      // ... potentially long-running loop over all spaces and pages ...
      setInactiveSpaceStats(stats); // May fire after unmount or stale closure
    };
    void loadStats();
  }, [spacesManifest, userSpaceId, backend]);
```

This is a classic React memory leak pattern. If `spacesManifest` or `userSpaceId` changes while the previous load is still running, the old invocation will still call `setInactiveSpaceStats` with stale data, and if the component unmounts, React will warn about setting state on an unmounted component.

**Recommendation:** Add a `let cancelled = false;` flag in the effect body, check it before `setInactiveSpaceStats`, and set `cancelled = true` in the cleanup return.

### 2. N+1 Async Reads in useEffect (Performance Concern) -- MAJOR

**File:** `packages/ui/src/components/App.tsx`, lines 1129-1159

The stats loading effect calls `readSpacePageContent` for every single page in every inactive space sequentially (nested for-loop with `await` in each iteration). For a user with multiple spaces containing many pages, this is an unbounded number of async I/O operations that could degrade performance. There is also no debouncing or caching -- this re-runs every time `spacesManifest` reference changes.

Additionally, `flattenPages(spacePages)` is called twice in the same scope -- once for count and once for iteration -- which is wasteful.

**Recommendation:** Consider batching reads, adding a debounce, or computing content size from metadata rather than reading every file. Cache the `flattenPages` result.

### 3. `notFound` State Not Cleared on Successful Navigation -- MODERATE

**File:** `packages/ui/src/components/App.tsx`, lines ~122, 253-267, 414-424

The `notFound` state is set when space lookup fails or clone fails, but it is only cleared by explicit user interaction (clicking "Go Home" or "Go to Docs" in the NotFoundPage component). If the user navigates via the browser back button (popstate), the `notFound` state is never cleared, so the 404 page could persist even when navigating to a valid route.

**Recommendation:** Clear `setNotFound(null)` at the start of the `popstate` handler and at the start of the route restoration logic.

### 4. Closure Over Stale `resolvedPageId` in Nested Promise Chains -- MODERATE

**File:** `packages/ui/src/components/App.tsx`, lines 318-425

The `switchToExistingSpace` function is defined inside a `.then()` callback and closes over `resolvedPageId`. This is technically correct since `resolvedPageId` is a `const` in the same scope, but the deeply nested promise chains (`void loadSpaces(...).then(... void switchSpaceInBackend(...).then(... void loadAndApplySpaceState(...).then(...)))`) are hard to reason about and make it difficult to add proper error handling or cancellation.

**Recommendation:** Convert to async/await for readability and add try/catch at the top level.

### 5. `popstate` useEffect Dependency Array Includes Frequently Changing Values -- MODERATE

**File:** `packages/ui/src/components/App.tsx`, line 569

```tsx
}, [selectedPageId, pages, spacesManifest]);
```

The `popstate` listener is torn down and re-added every time `selectedPageId`, `pages`, or `spacesManifest` changes. These values change frequently (every page selection, every tree edit). Each re-registration removes and re-adds the event listener. While not a bug, it causes unnecessary churn. Typically, popstate handlers should use refs for mutable values so the effect only runs once.

**Recommendation:** Store `selectedPageId`, `pages`, and `spacesManifest` in refs and use a stable (empty or minimal) dependency array for the popstate listener.

### 6. IIFE in JSX for `githubUrl` Prop -- MINOR

**File:** `packages/ui/src/components/App.tsx`, lines 1264-1277

```tsx
githubUrl={(() => {
    if (activeSpace === 'docs' && docsSelectedPageId) {
      return getDocsSourceUrl(docsSelectedPageId) ?? undefined;
    }
    // ...
})()}
```

An immediately-invoked function expression in JSX is a code smell. It runs on every render and makes the JSX harder to read.

**Recommendation:** Extract this into a `useMemo` or a simple computed variable above the return statement.

### 7. GitHub SVG Icon Duplicated Three Times -- MINOR

**File:** `packages/ui/src/components/app-menu/AppMenu.tsx`, lines 37-45, 61-63, and the removed code from App.tsx

The same 16x16 GitHub SVG path is copy-pasted in three locations. This violates DRY.

**Recommendation:** Extract into a shared `GitHubIcon` component.

### 8. `parseCeptYaml` Minimal Parser May Be Fragile -- MINOR

**File:** `packages/ui/src/components/storage/git-space.ts`, lines ~110-147

The hand-rolled YAML parser only handles the `hide:` key with a specific subset of syntax. While it is intentionally minimal and documented as such, it does not handle edge cases like comments (`# comment`), multi-line strings, or nested structures. The tests cover the intended cases well, but any `.cept.yaml` with comments or unexpected formatting will silently produce incorrect results.

**Recommendation:** Add a comment noting known limitations, or handle `#` comment lines. Consider using a tiny YAML parser library if the format grows.

### 9. No Test for NotFoundPage Component -- MODERATE

**File:** `packages/ui/src/components/not-found/NotFoundPage.tsx`

The new `NotFoundPage` component has no unit or component tests. While it is a simple presentational component, the project's CLAUDE.md states "Every new UI component gets component tests."

**Recommendation:** Add a basic component test verifying rendering with/without `path` and `message` props, and that callbacks fire on button clicks.

### 10. No Tests for `pageIdToFilename` or `extractFrontMatter` -- MODERATE

**File:** `packages/ui/src/components/storage/StorageContext.tsx`, lines ~261-266 and `git-space.ts` lines ~153-163

Two new utility functions (`pageIdToFilename` and `extractFrontMatter`) were added without dedicated unit tests. `pageIdToFilename` has edge cases (what about `.markdown` in the middle of a name? double extensions like `file.md.md`?). `extractFrontMatter` has edge cases around malformed YAML, missing closing `---`, etc.

**Recommendation:** Add unit tests for these functions, especially edge cases.

### 11. TypeScript Strict Mode Compliance -- OK

The code uses proper TypeScript types throughout. No instances of `any` or `@ts-ignore` were found in the diff. The `SpacesManifest` type is properly imported for test fixtures. The `resolveRouteToSpace` function has well-typed parameters and return values. The `Match` type alias in the function body is appropriately scoped.

### 12. Test Quality Assessment -- GOOD

The router tests (`router.test.ts`) are thorough with excellent coverage of:
- Base path variations (root, custom base, preview base)
- Git space URL parsing with file extensions, nested paths, legacy formats
- Roundtrip tests (build -> parse -> build produces stable URLs)
- Collision prevention test for the old `git-` prefix scheme
- `afterEach` cleanup of global state (`setBasePath`, `setUseGitPrefix`)

The `SpaceManager.test.ts` tests for `resolveRouteToSpace` are well-structured with good edge case coverage including multi-segment branch names.

The `git-space.test.ts` `parseCeptYaml` tests cover the intended YAML subset well.

### 13. `resolveRouteToSpace` Scoring Logic -- OK but Complex

**File:** `packages/ui/src/components/storage/SpaceManager.ts`, lines ~262-348

The scoring logic (`score: spaceBranch.length * 10 + (space.subPath?.length ?? 0)`) is reasonable for disambiguation but could benefit from a comment explaining why `* 10` is used (to ensure branch length dominates over subPath length). The function is well-documented with JSDoc.

---

## Inline Comments

| File | Line(s) | Comment |
|------|---------|---------|
| `packages/ui/src/components/App.tsx` | 1129-1159 | **Memory leak:** async `loadStats` has no cancellation mechanism. Add `let cancelled = false` pattern. |
| `packages/ui/src/components/App.tsx` | 1142 | **Performance:** `flattenPages(spacePages)` is called twice; cache the result. |
| `packages/ui/src/components/App.tsx` | 569 | **Churn:** `popstate` listener re-registered on every page/tree change. Use refs for mutable values. |
| `packages/ui/src/components/App.tsx` | 1264-1277 | **Readability:** Extract IIFE into a `useMemo` or variable. |
| `packages/ui/src/components/App.tsx` | 414-416 | **Error UX:** Clone failure shows 404 but `cloneStatus.error` was previously set. Verify the error path is still surfaced in UI (the clone dialog may no longer show the error). |
| `packages/ui/src/components/App.tsx` | 546-569 | **Bug risk:** `notFound` state is not cleared in the popstate handler, so a 404 page can persist after back-navigation. |
| `packages/ui/src/components/app-menu/AppMenu.tsx` | 37-45, 61-63 | **DRY:** GitHub SVG icon duplicated. Extract to shared component. |
| `packages/ui/src/components/not-found/NotFoundPage.tsx` | 1-44 | **Missing tests:** No component tests for this new component. |
| `packages/ui/src/components/storage/StorageContext.tsx` | 262-265 | **Missing tests:** `pageIdToFilename` needs edge case tests (double extensions, path-like page IDs). |
| `packages/ui/src/components/storage/git-space.ts` | 153-163 | **Missing tests:** `extractFrontMatter` has no tests; edge cases like missing closing `---` are untested. |
| `packages/ui/src/components/storage/git-space.ts` | 141 | **Edge case:** The condition `!trimmed.startsWith('-') && !trimmed.startsWith(' ')` means a line like `  other: value` (indented) would not terminate the list. This may be intentional but is undocumented. |
| `packages/ui/src/components/storage/SpaceManager.ts` | ~330 | **Magic number:** `spaceBranch.length * 10` scoring factor deserves a brief comment explaining the rationale. |

---

## References

- `packages/ui/src/components/App.tsx` -- Main application component with hooks and routing logic
- `packages/ui/src/router.ts` -- URL routing implementation
- `packages/ui/src/router.test.ts` -- Router test suite (comprehensive)
- `packages/ui/src/components/storage/SpaceManager.ts` -- Space management and `resolveRouteToSpace`
- `packages/ui/src/components/storage/SpaceManager.test.ts` -- Space manager tests (comprehensive)
- `packages/ui/src/components/storage/git-space.ts` -- Git space cloning, YAML parsing, file walking
- `packages/ui/src/components/storage/git-space.test.ts` -- Git space tests (good for covered functions)
- `packages/ui/src/components/storage/StorageContext.tsx` -- Storage utilities with `pageIdToFilename`
- `packages/ui/src/components/not-found/NotFoundPage.tsx` -- New 404 component (no tests)
- `packages/ui/src/components/app-menu/AppMenu.tsx` -- AppMenu with new GitHub link
