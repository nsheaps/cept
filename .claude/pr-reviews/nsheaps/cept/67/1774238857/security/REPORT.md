# Security Review: PR #67

**Score: 72 / 100**

## Summary

This PR introduces git space URL routing improvements, a GitHub link feature in the app menu, a 404 page, file browser root path scoping, and `.cept.yaml` parsing. The overall security posture is reasonable for a client-side SPA, but there are several findings worth addressing -- primarily around URL construction from user-controlled data and insufficient path traversal guards in the file browser.

---

## Findings

### 1. XSS via GitHub URL Construction (Medium Severity)

**File:** `packages/ui/src/components/App.tsx`, lines 1264-1273

The `githubUrl` prop passed to `AppMenu` is constructed by string-interpolating values derived from `parseRemoteSpaceId()`, which in turn parses space IDs that originate from URL path segments (user-controlled input):

```typescript
const subPath = parsed.subPath ? `${parsed.subPath}/` : '';
return `https://${parsed.repo}/blob/${parsed.branch}/${subPath}${selectedPageId}`;
```

`parsed.repo`, `parsed.branch`, `parsed.subPath`, and `selectedPageId` all flow from URL path segments through the router. While React's JSX escaping prevents attribute-level XSS in the `href` (React escapes attribute values), a crafted space ID could construct a URL pointing to a `javascript:` URI if the `https://` prefix were ever removed or bypassed. Currently the hardcoded `https://` prefix mitigates this for standard cases.

**However**, there is no validation that `parsed.repo` actually represents a legitimate hostname/path. A malicious space ID like `evil.com/phishing-page@main` would produce `https://evil.com/phishing-page/blob/main/...`, sending users to an attacker-controlled domain that is not GitHub.

**Recommendation:** Validate that `parsed.repo` starts with a known Git host (e.g., `github.com/`, `gitlab.com/`) or at minimum display the target domain to the user before navigation. Consider using a URL allowlist.

**Inline comment location:** `packages/ui/src/components/App.tsx` line 1273

### 2. `target="_blank"` Usage (Low Severity -- Properly Mitigated)

**Files:**
- `packages/ui/src/components/app-menu/AppMenu.tsx`, lines 37-38, 64-65
- `packages/ui/src/components/settings/SettingsModal.tsx`, line 503

All `target="_blank"` links include `rel="noopener noreferrer"`, which correctly prevents the opened page from accessing `window.opener`. This is the standard mitigation and is properly applied throughout the PR.

**No action needed.**

### 3. Path Traversal in FileBrowser rootPath (Medium Severity)

**File:** `packages/ui/src/components/settings/SettingsModal.tsx`, line 488

```typescript
rootPath={browsingSpaceId === 'default' ? '/' : `.cept/spaces/${browsingSpaceId}`}
```

The `browsingSpaceId` is set from `selectedSpace.id`, which for remote spaces is a string like `github.com/nsheaps/cept@main::docs`. This value is interpolated directly into a file path. While the space ID comes from the manifest (not directly from URL input), if a space ID were crafted with `../` sequences (e.g., via a malicious manifest or localStorage tampering), the file browser root could escape the intended `.cept/spaces/` directory.

More importantly, the `FileBrowser` component itself has **no path containment**: the `handleGoUp` function allows navigating to any parent directory:

```typescript
const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
```

There is no check that `parent >= rootPath`. A user can navigate up from the root path all the way to `/`, browsing the entire virtual filesystem regardless of where the file browser was opened.

**Recommendation:**
1. Add path normalization and validation to reject space IDs containing `..` or other traversal sequences.
2. In `FileBrowser.handleGoUp`, clamp navigation to `rootPath` as a floor:
   ```typescript
   if (currentPath === rootPath || currentPath === '/') return;
   const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
   setCurrentPath(parent.startsWith(rootPath) ? parent : rootPath);
   ```

**Inline comment locations:**
- `packages/ui/src/components/settings/SettingsModal.tsx` line 488
- `packages/ui/src/components/settings/FileBrowser.tsx` lines 83-86

### 4. `.cept.yaml` Injection / Abuse (Low Severity)

**File:** `packages/ui/src/components/storage/git-space.ts`, `parseCeptYaml` function (lines 124-161)

The custom YAML parser is intentionally minimal and only extracts the `hide` key with string array values. This is a sound security design choice -- it avoids the risks of full YAML parsing (e.g., prototype pollution from `yaml.load()` with unsafe options, or billion-laughs attacks).

**However**, the `hide` values from `.cept.yaml` are used to filter directory entries by name comparison (`hiddenSet.has(e.name)`). There is no normalization of these values. A `.cept.yaml` in a malicious repo could set `hide` to values like `..` or empty strings, but the impact is limited to hiding entries from the sidebar (a cosmetic/UX issue, not a security bypass), since hidden entries are just filtered from display, not deleted.

The `parentHidden` propagation (line 209-210) merges parent hidden sets into children, which means a `.cept.yaml` at the repo root could hide entries throughout the entire tree. This is by design but worth documenting.

**No critical action needed.** The minimal parser approach is good. Consider adding a note that `.cept.yaml` from untrusted repos can affect sidebar display.

### 5. NotFoundPage Path Display (Low Severity -- Properly Mitigated)

**File:** `packages/ui/src/components/not-found/NotFoundPage.tsx`, lines 408-411

```tsx
<p className="cept-not-found-path" data-testid="not-found-path">
  Could not find: <code>{path}</code>
</p>
```

The `path` value comes from `window.location.pathname` and is rendered inside a `<code>` element. React's JSX automatically escapes the content, so there is no XSS risk from rendering arbitrary path strings. This is correct.

**No action needed.**

### 6. `restoreRoute()` URL Decode (Low Severity)

**File:** `packages/ui/src/router.ts`, lines 317-327

```typescript
const encodedRoute = params.get('route');
if (encodedRoute) {
  const decoded = decodeURIComponent(encodedRoute);
  const route = parseRoute(decoded);
  replaceRoute(route);
  return route;
}
```

The `?route=` parameter (from 404.html redirect) is decoded and parsed. The `parseRoute` function only extracts structured segments (split on `/`, check for `g`, `s`, `docs` prefixes), so injection through this parameter would require crafting a path that the parser interprets as a valid space ID. The resulting URL is passed to `history.replaceState`, which does not navigate -- it only updates the displayed URL. This is safe.

**No action needed.**

### 7. `__COMMIT_SHA__` in GitHub URL (Low Severity)

**File:** `packages/ui/src/components/settings/SettingsModal.tsx`, line 503

```tsx
<a href={`https://github.com/nsheaps/cept/commit/${__COMMIT_SHA__}`} target="_blank" rel="noopener noreferrer">
```

`__COMMIT_SHA__` is a build-time constant injected via Vite's `define` config from `process.env.COMMIT_SHA`. Since this is set at build time (not user input) and is JSON-stringified, this is safe. The hardcoded `https://github.com/nsheaps/cept/commit/` prefix ensures the URL always points to the expected GitHub repository.

**No action needed.**

---

## Inline Comments Summary

| File | Line | Severity | Finding |
|------|------|----------|---------|
| `packages/ui/src/components/App.tsx` | 1273 | Medium | GitHub URL constructed from user-derived space ID could point to non-GitHub domains |
| `packages/ui/src/components/settings/SettingsModal.tsx` | 488 | Medium | `browsingSpaceId` interpolated into path without traversal sanitization |
| `packages/ui/src/components/settings/FileBrowser.tsx` | 83-86 | Medium | `handleGoUp` has no floor check against `rootPath`, allows navigating above root |
| `packages/ui/src/components/app-menu/AppMenu.tsx` | 37-38 | OK | `target="_blank"` properly mitigated with `rel="noopener noreferrer"` |
| `packages/ui/src/components/storage/git-space.ts` | 124-161 | Low | Minimal YAML parser is a good security choice; `hide` values not normalized but impact is cosmetic |
| `packages/ui/src/components/not-found/NotFoundPage.tsx` | 408-411 | OK | Path display properly escaped by React JSX |
| `packages/ui/src/router.ts` | 317-327 | OK | `?route=` parameter properly handled through structured parser |

---

## Context Notes

- This is a client-side SPA running in the browser. All storage is in IndexedDB/lightning-fs (no server-side file system). Path traversal in the FileBrowser affects the virtual filesystem only, not the host OS. However, the virtual FS may contain data from other spaces that should be isolated.
- The Git clone operation goes through isomorphic-git with a CORS proxy, so the actual network security boundary is at the browser level. The constructed GitHub URLs are for navigation only (opening in a new tab), not for API calls.
- The `parseCeptYaml` avoiding a full YAML parser is a deliberate and positive security choice.

## Score Justification

- **-15 points:** GitHub URL construction from unvalidated space IDs allows phishing via non-GitHub domains (Finding 1)
- **-10 points:** FileBrowser has no path containment -- `handleGoUp` can escape the `rootPath` boundary (Finding 3)
- **-3 points:** No sanitization of `browsingSpaceId` for path traversal characters before interpolation (Finding 3)
- **+0 points:** All other areas (target="_blank", YAML parsing, NotFoundPage, restoreRoute) are properly handled

Final score: **72 / 100**
