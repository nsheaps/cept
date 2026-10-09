# Cept Phase 1 delivery plan

**Status:** Draft for owner review, 2026-10-07 · **Owner:** nsheaps · **Scope source:** [scope.md](scope.md) (decisions D-26 to D-43) · **Requirements:** [requirements/README.md](requirements/README.md)

This plan turns the Phase 1 scope into an ordered list of small pull requests. It is based on five read-only area surveys (engineering and CI, spaces and storage, GitHub sync, editor and Markdown, PWA and desktop) done on 2026-10-07. Nothing in the surveys was run locally, so every "today" statement below is from reading code and CI history, not from executing it.

## Contents

1. [Goal and definition of done](#1-goal-and-definition-of-done)
2. [Ground rules for every PR](#2-ground-rules-for-every-pr)
3. [PR summary table](#3-pr-summary-table)
4. [Milestones](#4-milestones)
5. [Per-PR detail](#5-per-pr-detail)
6. [Parallelism](#6-parallelism)
7. [Requirements to write before their PR](#7-requirements-to-write-before-their-pr)
8. [Open owner questions](#8-open-owner-questions)
9. [Coverage check](#9-coverage-check)

## 1. Goal and definition of done

**Goal** (from the [owner's scope statement](scope.md#owners-scope-statement), narrowed by D-26 to D-43): build Cept up to, but not including, live co-editing, the CLI and daemon, the VS Code extension and databases. Phase 1 delivers:

- full space functionality: folder-tree spaces marked by `space.cept.yaml`, per-folder `.cept.yaml` config, several spaces open at once, lifecycle and legacy migration (D-30, D-41, D-42);
- four backends: browser IndexedDB, desktop local folder, File System Access folders on web, and GitHub (D-29);
- GitHub sync with **PATs only**, autodiscovery of spaces from `GET /user/repos`, full offline editing with queued commits and push on reconnect, conflicts surfaced, page history (D-27, D-30, D-31, D-37);
- full Markdown support: one lossless pipeline, GFM with footnotes and math, front matter for metadata, mermaid as the first fenced-block plugin, standard links with backlinks, search and a graph (D-14, D-15, D-32, D-33);
- comments stored inline as `cept:comment` HTML comments, with the PAT user as author (D-34), plus move/reorder, icon and cover, @page and @date mentions (D-35);
- the installable PWA as the phone app, with real mobile usability (D-43);
- desktop bundles (macOS dmg arm64 and x64, Windows NSIS x64, Linux AppImage and deb x64) on GitHub Releases with an Electrobun updater and app menus (D-28, D-40);
- a trustworthy CI gate: pinned tools, mise tasks, a secret scanner, required checks (D-38).

**Phase 1 is done when all of these hold:**

1. Every requirement in [scope.md §3](scope.md#3-phase-1-this-build-out) is `implemented` in its area file, with its acceptance criteria covered by automated tests (or recorded as a deviation with the owner's agreement).
2. The new and amended requirements from [scope.md §9](scope.md#9-requirements-to-add-or-amend) are written into the area files ([section 7](#7-requirements-to-write-before-their-pr)) and implemented.
3. `main` is green, and lint, typecheck, unit, integration, build, desktop and mobile e2e, security and PR-title checks are **required** status checks (REQ-ENG-020), including for Renovate automerge.
4. A tagged release attaches all five desktop artifacts, and CD fails loudly if any is missing (D-24).
5. The built PWA at `/cept/app/` installs, works offline and passes the mobile-viewport suite in CI.
6. Nothing that is half-working ships: database entries are gone from the UI (D-36), and every flow that spans several PRs has no entry point until its last PR lands.
7. CLAUDE.md, CONTRIBUTING.md, README.md, TASKS.md and the area files match what was built.

## 2. Ground rules for every PR

- **Owner policy.** Functional changes (code, CI, config) go in small draft PRs that merge once Henry approves and CI is green (D-48). Docs-only changes (the `D*` items below) are committed straight to `main` (D-21).
- **Size.** Aim for under about 400 changed lines of non-test code. S is under about 150 lines, M is about 150 to 400. Anything bigger is split; the only exception is PR 5, a mechanical Prettier reformat with no hand-written changes.
- **Red first.** Each PR starts with the failing test named in [section 5](#5-per-pr-detail) and shows it failing for the right reason before the fix.
- **Main stays releasable.** Every merge leaves the app booting on `BrowserFsBackend` alone (CLAUDE.md rule 6). A user-facing flow spread over several PRs gets its entry point (menu item, button, route) only in its last PR. Feature code may land earlier as library code with tests.
- **No weakened gates.** No `continue-on-error`, `if-no-files-found: warn`, `|| true`, `[skip ci]`, `any` or `@ts-ignore` to get green. A gate that cannot pass yet is a labelled, disabled placeholder that emits `::warning::`, never a fake success.
- **Docs travel with code.** A PR that changes visible behaviour updates the requirement's status in its area file and any affected developer docs.
- **Hot files.** `packages/ui/src/App.tsx` (about 1,700 lines), `CeptEditor.tsx`, `.github/workflows/*.yml` and `.mise.toml` are touched by many PRs. Extraction PRs (16, 28) come early to shrink `App.tsx` before features are added to it.

## 3. PR summary table

Docs-only items `D1` to `D6` go straight to `main` and are listed in [section 7](#7-requirements-to-write-before-their-pr). Dependencies on them are shown as `D2` etc.

| #   | Title (conventional commit)                                       | Area    | REQ / decision IDs                                      | Size | Depends on         |
| --- | ----------------------------------------------------------------- | ------- | ------------------------------------------------------- | ---- | ------------------ |
| 1   | `build(mise): pin tools exactly and add mise tasks`               | eng     | ENG-003, ENG-004, D-22, D-38                            | M    | —                  |
| 2   | `ci: run workflows through mise tasks and scripts/ci`             | eng     | ENG-004, ENG-005, ENG-010                               | M    | 1                  |
| 3   | `ci(security): add gitleaks and osv-scanner job`                  | eng     | ENG-018, AUTH-018, D-38                                 | S    | 1                  |
| 4   | `ci: check pr titles are conventional commits`                    | eng     | ENG-012                                                 | S    | 1                  |
| 5   | `style: format the repo with prettier`                            | eng     | ENG-006, ENG-007                                        | S\*  | 1                  |
| 6   | `ci: add format check and pr autofix`                             | eng     | ENG-006, ENG-007                                        | S    | 5                  |
| 7   | `build(nx): add build and test targets to every package`          | eng     | ENG-001, ENG-009, ENG-011                               | M    | 1                  |
| 8   | `build(nx): tag projects and enforce module boundaries`           | eng     | ENG-002, WEB-002, D-23                                  | M    | 7                  |
| 9   | `ci: scope pr tests to nx affected projects`                      | eng     | ENG-008                                                 | S    | 7                  |
| 10  | `ci(cd): replace fake-green native jobs with placeholders`        | eng     | ENG-009, APP-011, D-24, D-43                            | S    | 2                  |
| 11  | `ci: require status checks on main`                               | eng     | ENG-020, ENG-013                                        | S    | 2, 3, 4, 6, 8, 9   |
| 12  | `feat(core): add memory backend and backend conformance suite`    | spaces  | WEB-012, WS-008                                         | S    | —                  |
| 13  | `refactor(desktop): move local-fs backend out of core`            | spaces  | WEB-002, D-23, rule 1                                   | S    | 8, 12              |
| 14  | `feat(core): parse space.cept.yaml and .cept.yaml`                | spaces  | WS-002, WS-003, WS-004, D-30, D-41                      | M    | D2                 |
| 15  | `feat(core): discover spaces and .git in a backend tree`          | spaces  | WS-002, WS-019, WS-021, D-30                            | M    | 12, 14             |
| 16  | `refactor(ui): extract space manager and dedupe path helpers`     | spaces  | WS-007, WS-022                                          | M    | 12                 |
| 17  | `feat(ui): bind a storage backend per space`                      | spaces  | WS-007, WEB-003, WEB-004                                | M    | 12, 16             |
| 18  | `fix(demo): run the demo on the memory backend`                   | spaces  | WEB-012, WEB-013, WEB-014, WEB-016, ENG-015             | M    | 12, 17             |
| 19  | `feat(core): read and write spaces as folder trees`               | spaces  | WS-001, WS-018, D-41, D-42                              | M    | 12, 14             |
| 20  | `feat(ui): load the page tree from the folder layout`             | spaces  | WS-001, D-42                                            | M    | 17, 19             |
| 21  | `feat(ui): migrate legacy flat spaces to folders`                 | spaces  | WS-025 (new), WS-001, D-30                              | M    | 20, D2             |
| 22  | `feat(ui): path-based routes and not-found page`                  | spaces  | WS-013, D-42                                            | M    | 20, 21             |
| 23  | `feat(ui): probe backend capabilities and availability`           | spaces  | WS-017, WS-008, rule 4                                  | S    | 17                 |
| 24  | `feat(web): persist and restore file system access handles`       | spaces  | WS-012, WEB-023                                         | S    | 23                 |
| 25  | `feat(ui): open a local folder as a space`                        | spaces  | WS-012, WS-019, WEB-023                                 | M    | 15, 20, 24         |
| 26  | `feat(ui): space lifecycle and inactive-space stats`              | spaces  | WS-024 (new), D-30, D-42                                | M    | 17, 20, D2         |
| 27  | `refactor(web): read the git proxy url from one build setting`    | sync    | AUTH-009, D-39                                          | S    | —                  |
| 28  | `refactor(core): move git transport and clone behind core`        | sync    | WEB-003, rule 5                                         | M    | 8, 16, 27          |
| 29  | `feat(auth): pat provider and encrypted web token store`          | sync    | AUTH-001, AUTH-005, AUTH-012, D-27                      | M    | D4                 |
| 30  | `feat(ui): pat sign-in, account and sign-out ui`                  | sync    | AUTH-013, AUTH-005                                      | S    | 29                 |
| 31  | `feat(storage): authenticated incremental clone and fetch`        | sync    | AUTH-010, AUTH-011, WS-013, D-42                        | M    | 28, 29             |
| 32  | `feat(ui): remote-space settings and directory-url resolution`    | sync    | WS-013, D-42                                            | M    | 22, 31             |
| 33  | `feat(core): discover spaces from repos the pat can reach`        | sync    | WS-023 (new), AUTH-014, D-30                            | M    | 14, 29, D2         |
| 34  | `feat(ui): list discovered spaces and open or pin them`           | sync    | WS-023 (new), AUTH-014                                  | M    | 30, 31, 33         |
| 35  | `feat(core): git sync policy for author, messages and branch`     | sync    | WS-027 (new), WS-014, D-30                              | M    | 28, 29, D2         |
| 36  | `feat(ui): edit github spaces with auto-commit and sync`          | sync    | WS-014, D-42                                            | M    | 17, 20, 30, 31, 35 |
| 37  | `feat(sync): conflict view and push-to-new-branch fallback`       | sync    | WS-026 (new), WS-014, D-30                              | M    | 36, D2             |
| 38  | `feat(web): elect one sync leader per origin`                     | sync    | WEB-007, D-4, D-5, D-37                                 | M    | 36                 |
| 39  | `feat(sync): persistent commit queue and push on reconnect`       | sync    | WEB-007, WEB-011, WEB-024 (new), D-37                   | M    | 38, D4             |
| 40  | `feat(web): request persistent storage and warn on low quota`     | sync    | WEB-024 (new)                                           | S    | D4                 |
| 41  | `feat(history): page history list, diff and restore`              | sync    | NTN-016, WS-008, D-31                                   | M    | 23, 31             |
| 42  | `feat(storage): enable history and sync for folders with .git`    | sync    | WS-021                                                  | S    | 15, 25, 41         |
| 43  | `feat(spaces): publish a local space to a new github repo`        | sync    | WS-020, D-29                                            | M    | 30, 36             |
| 44  | `refactor(ui): remove database entries from the slash menu`       | editor  | EDT-003, D-36                                           | S    | —                  |
| 45  | `test(core): add a lossless markdown round-trip corpus`           | editor  | EDT-005, EDT-014, EDT-022, EDT-023                      | M    | D3                 |
| 46  | `feat(core): preserve front matter byte-for-byte`                 | editor  | EDT-026 (new), EDT-005                                  | M    | 45, D3             |
| 47  | `feat(core): bridge mdast and prosemirror for core blocks`        | editor  | D-15, EDT-005, EDT-014                                  | M    | 45, D6             |
| 48  | `feat(core): serialize custom blocks and unknown html losslessly` | editor  | EDT-002, EDT-022, EDT-023, EDT-024                      | M    | 47                 |
| 49  | `feat(ui): route the editor through the shared pipeline`          | editor  | EDT-001, EDT-005, EDT-011, EDT-024                      | M    | 46, 48, 52         |
| 50  | `feat(editor): add a fenced-block plugin interface`               | editor  | EDT-013, EDT-010, EDT-011                               | M    | 49                 |
| 51  | `feat(editor): render mermaid as a fenced-block plugin`           | editor  | EDT-002, EDT-010, D-33                                  | M    | 50                 |
| 52  | `feat(markdown): support footnotes and math`                      | editor  | EDT-012, EDT-014, EDT-015, EDT-016                      | M    | 47                 |
| 53  | `feat(core): extract links and build the link graph`              | links   | EDT-018, EDT-020, D-32, D-41                            | M    | 14, 47             |
| 54  | `feat(ui): resolve relative links and assets through the backend` | links   | EDT-027 (new)                                           | M    | 20, 49, D3         |
| 55  | `feat(ui): rewrite inbound links when a page moves`               | links   | EDT-027 (new), NTN-012                                  | M    | 53, 54             |
| 56  | `feat(ui): backlinks panel and link-aware search`                 | links   | EDT-021, D-32                                           | M    | 20, 53             |
| 57  | `feat(ui): graph view as a fenced graph block`                    | links   | EDT-019, EDT-020                                        | M    | 50, 53             |
| 58  | `feat(editor): page and date mentions as standard links`          | links   | EDT-004, D-35                                           | M    | 49, 53             |
| 59  | `feat(ui): set page icon and cover in front matter`               | parity  | NTN-013, D-35                                           | M    | 46, 49             |
| 60  | `feat(ui): move and reorder pages with front-matter order`        | parity  | NTN-012, D-35                                           | M    | 21, 46             |
| 61  | `feat(core): parse and serialize cept:comment markers`            | comment | NTN-005, NTN-006, D-34                                  | M    | 48, D3             |
| 62  | `feat(editor): anchored and page-level comments with author`      | comment | NTN-002, NTN-003, NTN-007                               | M    | 30, 49, 61         |
| 63  | `feat(ui): comments panel and new-since-last-visit badge`         | comment | NTN-008, D-34                                           | M    | 62                 |
| 64  | `feat(sync): merge comments by id`                                | comment | NTN-010, WS-026 (new)                                   | S    | 37, 61             |
| 65  | `test(editor): bind editor and comment acceptance tests`          | editor  | EDT-025, NTN-011, NTN-001                               | S    | 51, 52, 56–64      |
| 66  | `fix(web): base-path-aware manifest, icons and ios metadata`      | pwa     | WEB-009, D-43                                           | S    | —                  |
| 67  | `fix(web): precache built assets under the base path`             | pwa     | WEB-005, WEB-006, WEB-008, WEB-020                      | M    | 66                 |
| 68  | `test(e2e): add a built-bundle pwa project`                       | pwa     | WEB-022, WEB-019, ENG-017                               | M    | 2, 67              |
| 69  | `fix(ui): phone layouts, safe areas and 44px touch targets`       | pwa     | APP-020, D-43                                           | M    | —                  |
| 70  | `fix(ui): keep the caret above the on-screen keyboard`            | pwa     | APP-020, D-43                                           | S    | 69                 |
| 71  | `test(e2e): require the mobile viewport suite`                    | pwa     | ENG-017, ENG-020, APP-020, WEB-022                      | S    | 11, 68, 70         |
| 72  | `build(desktop): scaffold the electrobun shell`                   | desktop | APP-006, APP-007, APP-018, WEB-001, D-17, D-28, D-43    | M    | 7                  |
| 73  | `refactor(desktop): remove electron bridge and slim the bridge`   | desktop | APP-008, D-43                                           | S    | 72                 |
| 74  | `feat(desktop): open local folders with external-edit watch`      | desktop | WS-009, WS-010, APP-009                                 | M    | 13, 19, 23, 72     |
| 75  | `feat(desktop): store tokens in the os keychain`                  | desktop | AUTH-012                                                | S    | 29, 72             |
| 76  | `feat(desktop): app menus for about, help and settings`           | desktop | APP-017, D-40                                           | S    | 73                 |
| 77  | `feat(desktop): update from github releases`                      | desktop | APP-014, D-28                                           | M    | 72                 |
| 78  | `ci(release): build and attach the macos dmg`                     | desktop | APP-002, APP-011, APP-012, APP-013, APP-015, D-24, D-28 | M    | 10, 72             |
| 79  | `ci(release): build and attach windows and linux packages`        | desktop | APP-001, APP-003, APP-011, APP-012, APP-013, D-24, D-28 | M    | 78                 |
| 80  | `ci: smoke-test desktop packaging on prs and sync versions`       | desktop | APP-019, APP-021                                        | M    | 79                 |

\* PR 5 is a large mechanical diff (Prettier output only) but S in hand-written lines; review is "did anything other than formatting change?".

**Totals:** 80 PRs (M0 11, M1 15, M2 17, M3 9, M4 13, M5 15) plus 6 docs-only commits.

## 4. Milestones

Milestones are logical groups with an exit criterion. They overlap in time ([section 6](#6-parallelism)); a milestone's exit criterion is checked when its last PR merges.

### M0 — Trustworthy CI gate

PRs, in order: 1 → 2, 3, 4, 5 (parallel) → 6, 7, 10 → 8, 9 → 11. D1 lands alongside.

**Exit criterion:** every workflow calls only `mise run <task>`; tools are pinned exactly; the secret scanner fails on a seeded secret; Prettier, PR-title and Nx module-boundary checks run; native CD jobs no longer pass while producing nothing; lint, typecheck, unit, integration, build, desktop e2e, security and PR title are required checks on `main`, and a red Renovate PR cannot automerge.

M0 comes first because main only went green again on 2026-10-06 (PR #354), and nothing protects it until checks are required.

### M1 — Space model

PRs, in order: 12, 14 (parallel) → 13 (after PR 8), 15, 16, 19 → 17 → 18, 20, 23 → 21, 24, 26 → 22, 25. Needs D2 first.

**Exit criterion:** a space is a folder tree marked by `space.cept.yaml`, with path-based page ids, README/index folder pages, `.cept.yaml` `ignore:` honoured and never written on open; each space has its own backend and several can be open; the demo runs in memory and never touches persisted spaces; legacy flat spaces migrate without data loss; a web user can open a real folder via the File System Access API; unknown routes show NotFound.

### M2 — GitHub sync with PAT

PRs, in order: 27, 29 (parallel) → 28, 30 → 31, 33, 35, 40 → 32, 34, 36, 41 → 37, 38, 42, 43 → 39. Needs D2 and D4.

**Exit criterion:** a user signs in with a fine-grained or classic PAT; discovered spaces from `GET /user/repos` are listed and cloned only when opened or pinned; PAT-backed spaces are editable, auto-commit and push, fetch incrementally, survive offline edits with a persistent queue and a single sync leader per origin, and surface conflicts with a push-to-new-branch fallback; anonymous public clones stay read-only; page history list, diff and restore work where the backend has history; no component hardcodes the CORS proxy or imports `isomorphic-git` outside `GitBackend`.

### M3 — Markdown and editor pipeline

PRs, in order: 44 (any time) · 45 → 46, 47 → 48, 52 → 49 → 50 → 51. Needs D3 and the D-15 decision (D6).

**Exit criterion:** one Markdown pipeline serves the editor and core; the round-trip corpus (GFM, footnotes, math, toggles, custom blocks, unknown HTML, Obsidian/Jekyll/Hugo front matter) is byte-for-byte lossless; mermaid renders as on GitHub and saves as a plain fence; no database entry is reachable from the UI.

### M4 — Comments, links, graph and Notion parity

PRs, in order: 53, 59, 60, 61 (parallel) → 54, 56, 57, 58, 62 → 55, 63, 64 → 65.

**Exit criterion:** standard relative links and assets resolve through the backend and are rewritten on move; backlinks, search and the graph block are derived from standard links and honour `ignore:`; @page and @date mentions round-trip as standard links; icon, cover and order are set in the UI and stored in front matter; anchored and page-level comments are stored inline with the PAT user as author, merge by id and show a new-since-last-visit badge; editor and comment acceptance tests are bound and running.

### M5 — PWA on phones and desktop bundles

PWA track: 66 → 67 → 68; 69 → 70; then 71. Desktop track: 72 → 73, 77 → 74, 75, 76 → 78 → 79 → 80. Needs D5.

**Exit criterion:** the built PWA at `/cept/app/` installs (manifest, icons, iOS metadata), precaches its shell and reloads offline; the mobile-viewport suite (safe areas, caret above the keyboard, 44px targets, no horizontal scroll) is a required check; `@cept/desktop` builds an Electrobun app with menus, a local-folder backend with external-edit watch, a keychain token store and an updater; a tag produces dmg (arm64 and x64), NSIS x64, AppImage and deb x64 on the GitHub Release and fails if any is missing; PRs run a desktop packaging smoke test.

## 5. Per-PR detail

Each entry gives: **Changes** (packages and files), **Red** (the failing test written first), **Accept** (the check that proves it), **Risk**.

### M0 — Trustworthy CI gate

**PR 1 — `build(mise): pin tools exactly and add mise tasks`**

- Changes: `.mise.toml` pins bun, node, gitleaks, osv-scanner, actionlint and shellcheck exactly; adds tasks `install`, `lint`, `format`, `typecheck`, `test:unit`, `test:integration`, `test:e2e`, `build`, `check` (under `.mise/tasks/` or `[tasks]`). Root `package.json` scripts stay as the inner commands.
- Red: a `scripts/ci/check-pins.ts` unit test that fails on any non-exact version in `.mise.toml` (fails today on `bun = "1"`).
- Accept: `mise run check` passes locally; CI unchanged and green.
- Risk: the pinned Bun must match `bun.lock`; check before choosing the version.

**PR 2 — `ci: run workflows through mise tasks and scripts/ci`**

- Changes: every `_*.yml` step calls `mise run <task>`; inline shell in `pr-version-check.yml`, `_update-screenshots.yml`, `cd.yml` and `preview-deploy.yml` moves to `scripts/ci/*.sh` (shellcheck-clean); `npx vite build` becomes a task; typecheck moves out of `_lint.yml` into its own `_typecheck.yml` job so every check that PR 11 requires has exactly one job name.
- Red: actionlint plus a small `scripts/ci/no-inline-logic` check that fails on `run:` blocks longer than one command.
- Accept: CI green with only mise calls; preview deploy still publishes.
- Risk: the screenshot and release jobs push with `[skip ci]` from the automation App; keep their behaviour identical.

**PR 3 — `ci(security): add gitleaks and osv-scanner job`**

- Changes: `_security.yml` running `mise run security` (gitleaks on history and tree, osv-scanner on `bun.lock`); wired into `ci.yml` and `_tag-release` needs.
- Red: `tools/security/gates.integration.test.ts` runs the `security` task against `tools/security-fixtures/` (a fake key and a lockfile with a known-vulnerable version) and asserts a non-zero exit; it fails until the task exists. The fixtures are excluded from the real-tree scan by path, and the test proves the exclusion does not hide them.
- Accept: job green on the real tree; any existing finding is fixed or allowlisted with a reason.
- Risk: history may already contain a finding; triage before merging.

**PR 4 — `ci: check pr titles are conventional commits`**

- Changes: a PR-title workflow calling a mise task.
- Red: a unit test of the title checker with valid and invalid titles.
- Accept: this PR's own title passes; a bad title fails.
- Risk: none notable.

**PR 5 — `style: format the repo with prettier`**

- Changes: `prettier --write .` output only, plus `.prettierignore` for generated files.
- Red: `prettier --check .` fails on `main`.
- Accept: `prettier --check .` passes; `git diff --ignore-all-space` shows only formatting; tests unchanged.
- Risk: conflicts with every open PR; merge when few PRs are open and announce it.

**PR 6 — `ci: add format check and pr autofix`**

- Changes: `lint` task runs `prettier --check`; a PR job runs `mise run format` and commits fixes (never `[skip ci]`).
- Red: a PR with a deliberate formatting violation fails lint.
- Accept: the same PR gets an autofix commit and goes green.
- Risk: autofix commits on fork PRs cannot push; skip forks with a `::warning::`. Commits pushed with `GITHUB_TOKEN` do not trigger CI, so the autofix job pushes with the automation App token or the PR never gets a green run on its final commit.

**PR 7 — `build(nx): add build and test targets to every package`**

- Changes: real `build` and `test:unit` targets for desktop, web and docs, and a documented `nobuild` marker for `@cept/mobile` (Capacitor is later, D-43, and APP-018 covers desktop only) and `@cept/signaling` (co-editing is later; its existing tests keep running); replace the `echo` scripts in `docs/package.json`; dependencies declared in each package's `package.json` (ENG-011); root `test` runs through Nx.
- Red: a script test that fails when any project lacks a `build`, `typecheck` or `test:unit` target or marker.
- Accept: `nx run-many -t build,typecheck,test:unit` passes.
- Risk: moving tests to per-project configs changes the vitest alias setup (`@cept/core` and `@cept/ui` aliased to source); keep the root aliases until every project is migrated.

**PR 8 — `build(nx): tag projects and enforce module boundaries`**

- Changes: `scope:` and `platform:` tags in each `package.json` `nx.tags`; `@nx/enforce-module-boundaries` in `eslint.config.js`; `no-restricted-imports` for `isomorphic-git*` outside `GitBackend` and for `node:*`, `electrobun`, `@capacitor/*` in core and ui; a `tools/boundary-fixtures/` gate test.
- Red: the fixture with a forbidden import must fail lint.
- Accept: lint green; known violations (`core/storage/local-fs.ts` uses `node:fs`; `App.tsx` and `git-space.ts` import `isomorphic-git` and concrete backends, D-23) are listed in a checked-in baseline file that the gate reads; any new violation fails. PRs 13 and 28 empty the baseline.
- Risk: the baseline must only shrink; add a test that fails if it grows.

**PR 9 — `ci: scope pr tests to nx affected projects`**

- Changes: `fetch-depth: 0` or `nrwl/nx-set-shas`; PR jobs run `nx affected`; `main` runs everything.
- Red: a `scripts/ci` test that runs `nx show projects --affected --files=packages/signaling-server/src/index.ts` and asserts `ui` is not in the list, plus one with a root config file asserting every project is listed; it fails until PR jobs use the affected set.
- Accept: the same change skips ui tests on a PR; `main` runs the full suite.
- Risk: affected detection misses changes to root config; treat root files as affecting everything.

**PR 10 — `ci(cd): replace fake-green native jobs with placeholders`**

- Changes: in `cd.yml`, remove `if-no-files-found: warn`, `continue-on-error: true`, `npx cap sync` and the `2>/dev/null || true` upload; desktop jobs become disabled placeholders that emit `::warning::` ("desktop packaging lands in PRs 78 and 79"); iOS and Android jobs become disabled placeholders (D-43).
- Red: a `scripts/ci` lint that fails on any of those patterns in workflow files.
- Accept: a tag dry run publishes the web app and emits the warnings; no job reports success for an artifact it did not build.
- Risk: none for users; the release simply stops claiming native builds until M5.

**PR 11 — `ci: require status checks on main`**

- Changes: enable `require-checks` in `.github/settings.yml` (line 282) with the explicit check names from PRs 2 to 8; confirm the ruleset bypass for the automation App's screenshot and release pushes; remove or explain `.github/settings.yml.corrupt.893782f`.
- Red: a `scripts/ci/check-required-checks` unit test that reads `.github/settings.yml` and the `ci.yml` job names and fails when any of lint, typecheck, unit, integration, build, e2e, security or PR title is not a required check (fails today: `require-checks` is commented out, which is how #347 to #351 automerged red on 2026-10-05/06).
- Accept: a deliberately red test PR cannot merge; the next release and screenshot pushes still land.
- Risk: a missing bypass deadlocks releases. Check the ruleset before merging. PR 71 later adds the mobile e2e check to the list.

### M1 — Space model

**PR 12 — `feat(core): add memory backend and backend conformance suite`**

- Changes: `core/src/storage/memory.ts` (a real `MemoryBackend` with `listDirectory`, `watch`, `stat`); a shared conformance suite run against memory, browser-fs, web-fs (mocked handles) and git backends; the test helper uses `MemoryBackend`.
- Red: the conformance suite against today's helper fails (`listDirectory` returns `[]`).
- Accept: suite green for all backends; recursive delete behaviour is specified by the suite.
- Risk: the suite may expose real differences between backends; fix or record them per backend.

**PR 13 — `refactor(desktop): move local-fs backend out of core`**

- Changes: `local-fs.ts` and its tests move to `@cept/desktop` (or a `platform:node` package); core exports stay platform-free.
- Red: the boundary fixture for `node:fs` in core is in the PR 8 baseline; removing the baseline entry fails until the move.
- Accept: lint green with the baseline entry removed; conformance suite still runs against `LocalFsBackend` in its new home.
- Risk: Vite stubs for `node:fs` in the web build can be removed; check the web bundle still builds.

**PR 14 — `feat(core): parse space.cept.yaml and .cept.yaml`**

- Changes: `core/src/space/config.ts` with Zod schemas for `space.cept.yaml` (`name`, `slug`, `version`, optional `branch`; D-3, D-30) and `.cept.yaml` (`ignore:`, `hide:` alias; D-41); `.yaml` over `.yml` precedence; nearest-wins merge from the space root down; default hidden paths (dotfiles, `.git/`, `.cept/`). Adds `zod` and `ignore` (exact pins) to core; YAML uses the existing `js-yaml` (REQ-WS-004).
- Red: unit tests for precedence, schema version, unknown keys, nearest-wins merge, `hide:` alias and gitignore-style matching.
- Accept: tests green; the schema doc in `03-spaces-and-storage.md` matches the Zod schema.
- Risk: key casing (WS open question 10) must be settled in D2 first.

**PR 15 — `feat(core): discover spaces and .git in a backend tree`**

- Changes: `core/src/space/discover.ts` walks a backend, finds markers, does not descend into a found space (D-3), and detects `.git` by walking up to the repo root (WS-021); read-only, never creates files.
- Red: an integration test over a fixture tree with two spaces, a nested marker that is reported but not treated as a space, and a `.git` in a parent folder.
- Accept: tests green; a write-spy backend records zero writes (WS-019).
- Risk: large trees; walk lazily and stop at found spaces.

**PR 16 — `refactor(ui): extract space manager and dedupe path helpers`**

- Changes: a `SpaceManager` class plus `useSpaces` hook in `ui/src/components/storage/`; the lifecycle handlers move out of `App.tsx` (lines ~855 to 1100); `spaceWorkspaceFile` and `spacePagesDir` exist once.
- Red: new unit tests for the class covering create, switch, rename and delete against `MemoryBackend`.
- Accept: existing SpaceManager and App tests stay green; `App.tsx` shrinks.
- Risk: behaviour-preserving refactor of a hot file; land it before any feature PR touches `App.tsx`.

**PR 17 — `feat(ui): bind a storage backend per space`**

- Changes: `StorageContext` holds a backend per open space instead of one global backend with path prefixes; `SpaceMeta` records the backend kind; `instanceof BrowserFsBackend` checks go.
- Red: a test with two spaces on two `MemoryBackend`s where writes to one never appear in the other.
- Accept: tests green; the app still boots on `BrowserFsBackend` alone (rule 6) in e2e smoke.
- Risk: existing users' data lives under one IndexedDB backend with prefixes; the default space must keep reading the same paths.

**PR 18 — `fix(demo): run the demo on the memory backend`**

- Changes: `?demo`, `showDemoContent`, demo reset and the Pages demo build flag use a separate `MemoryBackend` space; `handleClearAllData` and `handleResetDemo` no longer touch the default space.
- Red: a test that `.cept/spaces.json` and the default space's files are unchanged after opening and resetting the demo (fails today: demo overwrites and renames the default space).
- Accept: test green; e2e demo flow and screenshots still pass.
- Risk: this fixes a data-loss bug; call it out in the release notes.

**PR 19 — `feat(core): read and write spaces as folder trees`**

- Changes: `core/src/space/tree.ts` builds a page tree from folders: path-based page ids, `README.md`/`index.md` folder pages with documented precedence, `ignore:` filtering via PR 14; writes create files at paths, never touching unrelated files.
- Red: a round-trip test reading a fixture folder and writing the tree back with every file byte-identical.
- Accept: tests green on `MemoryBackend` and `BrowserFsBackend`.
- Risk: replaces `page-${Date.now()}` ids, which can collide; path ids remove that.

**PR 20 — `feat(ui): load the page tree from the folder layout`**

- Changes: `StorageContext` and the sidebar use PR 19 for new spaces; legacy spaces keep the old reader until PR 21.
- Red: a component test that a fixture folder space shows its hierarchy and folder pages in the sidebar.
- Accept: tests green; creating, renaming and moving pages writes files at paths.
- Risk: two layouts coexist briefly; detect by marker presence.

**PR 21 — `feat(ui): migrate legacy flat spaces to folders`**

- Changes: a one-time, reversible migration from `.cept/workspace-state.json` plus `pages/page-<ts>.md` (and `.cept/spaces/<id>/pages/`) to a folder tree with `space.cept.yaml`; keeps a backup under `.cept/migration-backup/` until the user confirms.
- Red: a migration test over a legacy fixture covering idempotency, nesting, favourites and no data loss.
- Accept: test green; an e2e test seeds a legacy space and sees the same pages after reload.
- Risk: real user data; never delete the backup automatically.

**PR 22 — `feat(ui): path-based routes and not-found page`**

- Changes: `ui/src/router.ts` uses path ids (dropping the `git-` prefix heuristic); `buildPath` and space id format change together; a NotFound page replaces the silent fallback.
- Red: router unit tests for path ids with slashes, encoded names and unknown paths.
- Accept: tests green; e2e deep link to a page and to a missing page.
- Risk: existing bookmarked URLs; keep old `/s/<id>/<page-ts>` URLs redirecting via the migration map.

**PR 23 — `feat(ui): probe backend capabilities and availability`**

- Changes: a capability probe (File System Access present, IndexedDB available, git available) and an availability matrix per platform (WS-017), covering phone PWAs; UI gates on `backend.capabilities`, never on `backend.type` (rule 4).
- Red: component tests with and without a mocked `showDirectoryPicker`.
- Accept: options appear only where available; a grep test fails on `type === 'git'` in ui.
- Risk: none notable.

**PR 24 — `feat(web): persist and restore file system access handles`**

- Changes: `web-fs.ts` handle persistence used by the app, permission re-request on reload.
- Red: unit test with mocked handles for persist, reload and permission denied.
- Accept: tests green.
- Risk: browser permission prompts differ by browser; Chromium only in Phase 1.

**PR 25 — `feat(ui): open a local folder as a space`**

- Changes: "Open folder" flow using PRs 15, 19 and 24: picks a folder, discovers spaces or offers to create a marker (only on explicit user action), opens the space.
- Red: unit test that opening a fixture folder performs zero writes (WS-019); e2e in Chromium with a mocked picker.
- Accept: tests green; the flow is the only new entry point.
- Risk: `watch()` is a no-op on web; external edits show on refresh only (documented).

**PR 26 — `feat(ui): space lifecycle and inactive-space stats`**

- Changes: create, rename (edits `space.cept.yaml`, warns on slug change), "remove from device" versus "delete", allowing the last and default space to be handled explicitly; page counts and storage stats for inactive spaces (D-42).
- Red: component tests for remove versus delete, deleting the default space, and stats.
- Accept: tests green; e2e for create, rename and remove.
- Risk: delete on a GitHub space means a commit; this PR covers local spaces and leaves GitHub delete to PR 36.

### M2 — GitHub sync with PAT

**PR 27 — `refactor(web): read the git proxy url from one build setting`**

- Changes: `VITE_CORS_PROXY` (default `https://cors.isomorphic-git.org`) read in one config module; the four literals in `App.tsx` (lines 363, 467, 987, 1064) use it; a lint or grep guard forbids the literal elsewhere.
- Red: the guard test fails on today's tree.
- Accept: guard and config unit test green.
- Risk: none notable.

**PR 28 — `refactor(core): move git transport and clone behind core`**

- Changes: `createGitHttp()` and a clone helper in `@cept/core`; `App.tsx` and `git-space.ts` stop importing `isomorphic-git` and concrete backends; clone-dir cleanup for `/.cept/git-clones/<ts>`; `walkMarkdownFiles` stops stripping front matter.
- Red: removing the PR 8 baseline entries for `isomorphic-git` in ui fails lint until the move.
- Accept: baseline empty for these files; existing clone tests green.
- Risk: re-clone behaviour must stay identical until PR 31.

**PR 29 — `feat(auth): pat provider and encrypted web token store`**

- Changes: `core/src/auth/pat.ts` (`PatAuthProvider` validating via `GET /user`, reporting what the token grants, fine-grained and classic); an encrypted IndexedDB `TokenStore` using WebCrypto in `@cept/web`; the provider stays host-agnostic (AUTH-001).
- Red: store round-trip and validation tests with mocked `fetch`, including a 401.
- Accept: tests green; no token appears in any log or error string (test asserts redaction).
- Risk: the public proxy sees PATs (accepted by D-39); say so in the sign-in UI.

**PR 30 — `feat(ui): pat sign-in, account and sign-out ui`**

- Changes: settings field to paste a PAT, account display (login, avatar), sign-out that clears the store.
- Red: component tests for valid, invalid and sign-out.
- Accept: tests green; e2e with a mocked API.
- Risk: none notable.

**PR 31 — `feat(storage): authenticated incremental clone and fetch`**

- Changes: clone takes `HttpAuth`; refresh uses `fetch` plus fast-forward instead of re-cloning; 401/403 raise a re-authenticate prompt with no retry loop; full-depth fetch option for history; anonymous clones stay read-only, PAT-backed ones become writable-capable (D-42).
- Red: integration test against a local authenticated git HTTP server: private clone, then fetch with no new clone.
- Accept: tests green; the background re-clone path is gone.
- Risk: re-clone would wipe edits once spaces are editable, so this must land before PR 36.

**PR 32 — `feat(ui): remote-space settings and directory-url resolution`**

- Changes: remote-space UI (GitHub link, page menu, settings with remote URL, branch, last synced, refresh); a directory URL matches an existing space with a more specific sub-path instead of creating a duplicate (D-42).
- Red: router tests for directory URLs against existing spaces.
- Accept: tests green; e2e opening the same repo twice yields one space.
- Risk: none notable.

**PR 33 — `feat(core): discover spaces from repos the pat can reach`**

- Changes: `core/src/space/autodiscover.ts`: `GET /user/repos` (paged), skip forks and archived, default-branch recursive Git Trees, find markers, honour declared `branch:`, ETag cache, rate-limit headers, flag spaces lost to revoked access.
- Red: unit tests with mocked REST responses: two spaces in one repo, a fork, an archived repo, a 403 on one repo, a nested marker.
- Accept: tests green; no clone happens during discovery.
- Risk: rate limits on large accounts; cap concurrency and respect `X-RateLimit-*`.

**PR 34 — `feat(ui): list discovered spaces and open or pin them`**

- Changes: a "Discovered" list using PR 33; open or pin clones via PR 31. Deviation: the existing `RepoPicker` is not wired here, because picking a repository without a space (or creating one) writes a marker; it moves to PR 36.
- Red: component test that discovered spaces are listed and not cloned until opened.
- Accept: tests green; e2e with mocked API.
- Risk: none notable.

**PR 35 — `feat(core): git sync policy for author, messages and branch`**

- Changes: author and committer from `GET /user` (name, noreply email); debounced auto-commit with a documented message template; tracked branch per space (default branch unless `branch:`); per-device sync settings under `.cept/`, not committed; `SyncEngine` conflict detection from structured errors instead of message strings.
- Red: unit tests for author resolution, debounce and message template, and branch selection.
- Accept: tests green.
- Risk: quota on big clones; surface quota errors explicitly (WS-027).

**PR 36 — `feat(ui): edit github spaces with auto-commit and sync`**

Deviation: split in two. **PR 36a** (`feat(core): git space session with auto-commit and sync`) adds `GitSpaceSession` in `@cept/core` (a backend rooted at the space that records edits, auto-commit, and pull-then-push under the PR 35 settings) and the bare-repo integration test below. **PR 36b** wires it into the app (the rest of the list). The UI half is large on its own, and the session is testable without it.

- Changes: instantiate `GitBackend`, `AutoCommitEngine` and `SyncEngine` for PAT-backed spaces; remove `readOnly: true` for them (`SpaceManager.ts:147`); sync status indicator; manual push and pull; GitHub space delete as a commit; wires the existing `RepoPicker` (moved from PR 34) to start a space in a repository without one.
- Red: integration test with a local bare repo: edit, commit, push, and a second clone pulls the change.
- Accept: tests green; anonymous clones stay read-only.
- Risk: lightning-fs under concurrent tabs; until PR 38, auto-push runs only in the focused tab.
- Deviation (PR 36b): the app does not build `GitBackend`, `AutoCommitEngine` and `SyncEngine` itself; it opens a `GitSpaceSession` (PR 36a) per active writable space and binds its backend in `SpaceManager`. A space is writable when it was synced with the sign-in and its folder holds `space.cept.yaml`, so `readOnly` stays `true` for other remote spaces and anonymous clones. Manual push and pull are one "Sync now" action (`pushNow`). "Focused tab" is implemented as `document.visibilityState === 'visible'`. Left out: an App-level test with a live session (covered by the hook, indicator and bare-repo integration tests instead), and making anonymous spaces' local copies read-only (existing behaviour, unchanged).

**PR 37 — `feat(sync): conflict view and push-to-new-branch fallback`**

- Changes: per-file conflict view (mine, theirs, edit merged) wired to the existing `ConflictResolver`; key-wise front-matter merge; conflict copies kept; rejected push offers "push to a new branch" (`cept/...`).
- Red: integration test with a diverging bare repo and a protected-branch rejection.
- Accept: tests green; nothing lost in either case.
- Risk: block-aware Markdown merge needs the M3 pipeline; until then merge is line-based and overlapping edits go to the conflict view.
- Deviation (PR 37): the merge is Cept's own (`text-merge.ts`, `tree-merge.ts`), not isomorphic-git's `merge` and not the `merge-engine` strategies: isomorphic-git's merge driver sees only file names, throws on add/add, and leaves no usable conflict state, so `GitBackend` plans the merge on flattened trees and writes the merge commit itself. `ConflictResolver` was reworked to Keep mine / Keep theirs / Edit merged (Keep the file / Delete it for delete/modify) and emits `ConflictResolution`s. A copy is kept only when one side is chosen over the other; an edited merge or a deletion keeps none (both versions stay in history). A push with nothing new no longer contacts the remote, so a protected branch does not refuse a no-op. Left out: an App-level test with a live session (covered by the component, hook and bare-repo integration tests).

**PR 38 — `feat(web): elect one sync leader per origin`**

- Changes: Web Locks leader election with a BroadcastChannel; the sync loop runs only in the leader (SharedWorker where available, leader tab otherwise).
- Red: unit test with a mock `navigator.locks`; Playwright two-tab test that only one tab pushes.
- Accept: tests green.
- Risk: leader handover on tab close; test it explicitly.
- Deviation (PR 38): one leader per space (the lock is named after the session key), not per origin, so tabs on different spaces each sync their own. No SharedWorker: the session, its lightning-fs clone and the editor's bound backend live in the page, so the leader is always a tab; the browser's lock queue does the handover. The BroadcastChannel only carries "a sync settled" so followers refresh their indicator; followers do not reload the open page on the leader's pulls. Without Web Locks the visible-tab rule from PR 36b applies.

**PR 39 — `feat(sync): persistent commit queue and push on reconnect`**

- Changes: pending-push state persisted in IndexedDB; `online`/`offline` events wired to `SyncEngine.reportOnline()`; flush from the leader; pending-sync indicator.
- Red: integration test: go offline, make N commits, reload, reconnect, the remote has N commits.
- Accept: tests green.
- Risk: overlaps the service worker (PR 67); the SW only wakes the leader, the queue lives in core.
- Deviation (PR 39): the queue is the clone itself, not a separate IndexedDB store. Unpushed commits already live in the clone (lightning-fs, backed by IndexedDB), and `localChanges` counts them, so only the request to push is stored: a `cept-push-queued` marker in the clone's `.git`, written by `pushNow` and conflict resolution and removed once a push succeeds. With auto-push on (the default) the first sync after a reload pushes regardless. The existing "N unsynced" count is the pending-sync indicator; offline it reads "N waiting".

**PR 40 — `feat(web): request persistent storage and warn on low quota`**

- Changes: `navigator.storage.persist()` on first space creation; warning when denied or quota is low.
- Red: unit tests with mocked `navigator.storage`.
- Accept: tests green.
- Risk: none notable.
- Note (PR 40): "first space creation" is the first space created or cloned from GitHub in each page load, so a refusal is shown again after a reload rather than remembered. "Low" means under 50 MB, or under a tenth of the quota, left. The warning is a toast of a new `warning` type. Tracked under REQ-WEB-004 rather than a new requirement.

**PR 41 — `feat(history): page history list, diff and restore`**

- Changes: wire `HistoryViewer` into the page menu; restore writes the old content as a new edit and is offered only on writable spaces (anonymous clones get list and diff only until PR 36 makes PAT-backed spaces writable); hidden when `capabilities.history` is false.
- Red: component test for gating; integration test restoring a prior version from a local repo.
- Accept: tests green.
- Risk: `log(path)` is slow on long histories; page the list.
- Note (PR 41): clones are shallow (depth 1), so the list ends at the clone's boundary until the user chooses "Download older versions", which fetches the full history without moving the branch or the working tree. The gate is not `capabilities.history` of the space's backend (writable spaces are bound to a `RecordingBackend` over the browser backend, which reports no history) but whether the space is a GitHub space on a host that keeps a clone (`pageHistoryAccess`). Restore needs the space's editing session to be open; read-only and still-opening spaces get the list and diffs. Folder pages show the history of their `index.md`/`README.md`.

**PR 42 — `feat(storage): enable history and sync for folders with .git`**

- Changes: when PR 15 finds `.git` above an opened folder, the space gets history (and sync if a remote and token exist).
- Red: unit tests with and without `.git`, and with the space in a subfolder.
- Accept: tests green.
- Risk: isomorphic-git over File System Access handles may be slow; desktop uses the native path (PR 74).
- Note (PR 42, deviation): history only; sync is deferred. The repository is read through a file system that refuses every write (`openLocalRepository`), so opening or browsing never changes it (REQ-WS-019). Committing and pushing from the browser into a repository the user also edits with Git, an IDE or other tools risks a corrupt index or a moved branch under them, and File System Access gives no locking. Edits and restores are saved to the working files and the user commits them. A `.git` file (worktree, submodule) is not followed. A shallow local repository's older versions are not downloaded (there is no remote transport for it). Sync for local repositories can come with the desktop native path (PR 74).

**PR 43 — `feat(spaces): publish a local space to a new github repo`**

- Changes: create a repo via the REST API, add the remote, push; the space becomes GitHub-backed (WS-020 as limited by D-29).
- Red: integration test against a mocked API and a local bare repo.
- Accept: tests green.
- Risk: fine-grained PATs may lack repo-creation rights; show the needed permission.
- Note (PR 43): the local space is kept after publishing (the user removes it), so no data is deleted on the strength of a push. Dot files and folders are not published (`.cept/` holds device state, `.git/` a repository); GitHub's auto-init README is removed unless the space has one. Each copied file is compared byte for byte before the commit. A space still in the flat layout must be opened (and so converted) first. A push that fails after the repository was created is retried into the same repository. The test runs against a local bare repository served by `git http-backend`; repository creation is unit-tested through the dialog's error mapping, since the providers' `createRepo` already has its own tests.

### M3 — Markdown and editor pipeline

**PR 44 — `refactor(ui): remove database entries from the slash menu`**

- Changes: no slash or UI path reaches database views; `inline-database.ts` stays registered off; library code untouched (D-36).
- Red: update `slash-commands.feature` and `SlashCommandMenu.test.tsx` to assert no database items.
- Accept: tests and slash e2e green.
- Risk: none notable.
- Note (PR 44): the slash menu already had no database item and `CeptEditor` never registered `inline-database.ts`, so this PR adds the guards (a unit test that no command mentions databases, an e2e that `/database` shows "No results", a feature scenario) and drops the `/database` row from the in-app features page and `docs/content/guides/features.md`. The red test is in `slash-command.test.ts` rather than `SlashCommandMenu.test.tsx`, which only renders the items it is given.

**PR 45 — `test(core): add a lossless markdown round-trip corpus`**

- Changes: `core/src/markdown/__fixtures__/` golden corpus (GFM, toggles, callouts, columns, footnotes, math, mermaid, unknown HTML, Obsidian/Jekyll/Hugo front matter) and a harness asserting parse-then-serialize equals input; current failures marked as expected, so the baseline is visible.
- Red: the harness itself, with expected failures listed.
- Accept: suite runs in CI; the expected-failure list is the M3 burn-down.
- Risk: expected-failure markers must be removed as PRs fix them, never added.
- Note (PR 45): the corpus is 20 fixtures in `packages/core/src/markdown/__fixtures__/round-trip/`, run by `round-trip.test.ts`; all 20 start as expected failures in `expected-failures.json`. Every one fails at least because `serialize` always writes regenerated front matter (PR 46). The other losses: callouts, columns, toggles, footnotes, unknown HTML and `cept:comment` markers are dropped; nested list items are dropped; `...`-closed front matter is not recognised; and `_x_`, `~~~`, autolinks, table padding and `\,` in math are normalised. The fixtures are excluded from Prettier so they stay byte for byte.

**PR 46 — `feat(core): preserve front matter byte-for-byte`**

- Changes: front matter split and rejoin that keeps unknown keys, key order and comments; reserved keys per EDT-026 parsed into typed metadata; title falls back to first H1, then filename; Cept never adds front matter to a file the user has not edited.
- Red: corpus fixtures for front matter pass from expected-failure to green.
- Accept: those fixtures green; `App.tsx` no longer passes raw front matter into the editor.
- Risk: none beyond the schema decision in D3.

**PR 47 — `feat(core): bridge mdast and prosemirror for core blocks`**

- Changes: the single pipeline chosen in D6 (recommended option A: remark/mdast as the one parser and serializer with ProseMirror JSON as the bridge) for paragraphs, headings, lists, task lists, tables, code, quotes, links, images.
- Red: corpus fixtures for GFM core syntax.
- Accept: those fixtures green.
- Risk: the central design decision; spike first and record the result in D6. If the mapper passes about 400 lines, split by node family (block nodes first, then inline marks and tables) rather than growing the PR.

**PR 48 — `feat(core): serialize custom blocks and unknown html losslessly`**

- Changes: serializers for callout, toggle (GFM-compatible encoding, EDT-024), columns, embed, bookmark, image and the HTML fallback; unknown HTML kept verbatim. Math belongs to PR 52.
- Red: corpus fixtures for each custom block and unknown HTML.
- Accept: fixtures green.
- Risk: toggles and blockquotes share `> `; the encoding decision must be in `08-editor.md`.

**PR 49 — `feat(ui): route the editor through the shared pipeline`**

- Changes: `CeptEditor` loads and saves through PRs 46 to 48; `tiptap-markdown` removed; `CeptMarkdownParser`'s duplicate body parser retired.
- Red: `CeptEditor.test.tsx` round-trips toggle, callout, columns and image blocks.
- Accept: tests and editor e2e green.
- Risk: touches every block; keep screenshots in the PR. It waits for PR 52 so that removing `tiptap-markdown` does not regress the existing KaTeX math blocks on `main`.

**PR 50 — `feat(editor): add a fenced-block plugin interface`**

- Changes: an internal interface: a plugin claims a fence language, renders a node view, and serializes back to the same fence (EDT-013; third-party registry is later).
- Red: unit test registering a fake plugin; its fence serializes unchanged.
- Accept: test green.
- Risk: keep the interface internal and small.

**PR 51 — `feat(editor): render mermaid as a fenced-block plugin`**

- Changes: mermaid as the first plugin, lazily imported; plain ` ```mermaid ` fence on save.
- Red: component test rendering an SVG for a GitHub-valid diagram, and a round-trip fixture.
- Accept: tests green; e2e screenshot of a diagram.
- Risk: mermaid under jsdom; test rendering in the e2e and serialization in unit tests.

**PR 52 — `feat(markdown): support footnotes and math`**

- Changes: remark footnote and math support in the pipeline, with the math node mapped to the existing KaTeX node and serialized back to `$..$` and `$$..$$`; footnote reuse for repeated information (EDT-016).
- Red: corpus fixtures for `[^1]`, `$..$` and `$$..$$`.
- Accept: fixtures green.
- Risk: none notable.

### M4 — Comments, links, graph and Notion parity

**PR 53 — `feat(core): extract links and build the link graph`**

- Changes: link extraction from mdast (relative `.md` links and anchors); one graph model in core replacing the UI's separate types (EDT-020); `ignore:` and default-hidden paths excluded; dead `convertWikiLinksToMarkdown` removed.
- Red: unit tests over a fixture space covering relative links, anchors, ignored paths and dotfiles.
- Accept: tests green.
- Risk: none notable.

**PR 54 — `feat(ui): resolve relative links and assets through the backend`**

- Changes: in-app navigation for relative `.md` links and heading anchors; relative images and attachments load through the StorageBackend; non-Markdown files listed read-only.
- Red: component tests for link click and image load from `MemoryBackend`.
- Accept: tests green.
- Risk: blob URL lifetime; revoke on unmount.

**PR 55 — `feat(ui): rewrite inbound links when a page moves`**

- Changes: renaming or moving a page rewrites inbound relative links with a preview; one commit in Git spaces.
- Red: unit test over a fixture space with three inbound links.
- Accept: tests green.
- Risk: partial failure mid-rewrite; write all files or none.

**PR 56 — `feat(ui): backlinks panel and link-aware search`**

- Changes: backlinks panel from the PR 53 index; search index fed from the same pass.
- Red: component test: after B links to A, A's backlinks list B.
- Accept: tests green.
- Risk: incremental index updates on edit; full rebuild is acceptable for Phase 1 sizes.

**PR 57 — `feat(ui): graph view as a fenced graph block`**

- Changes: ` ```graph ` as the second fenced-block plugin using `KnowledgeGraphView`.
- Red: render test with a fixture graph; round-trip fixture.
- Accept: tests green.
- Risk: none notable.

**PR 58 — `feat(editor): page and date mentions as standard links`**

- Changes: @page serializes as a standard relative Markdown link (link text = page title, target = the page file's relative path) and feeds backlinks; @date serializes as plain text in a documented format.
- Red: round-trip tests and a backlink test.
- Accept: tests green.
- Risk: @person stays later; the menu must not offer it.

**PR 59 — `feat(ui): set page icon and cover in front matter`**

- Changes: icon and cover pickers in `PageHeader` writing to front matter via PR 46.
- Red: test that setting an icon updates only that key in the file.
- Accept: tests green.
- Risk: none notable.

**PR 60 — `feat(ui): move and reorder pages with front-matter order`**

- Changes: drag to reorder writes `order`; move between folders moves files (links rewritten once PR 55 lands; this PR depends only on the tree and front matter).
- Red: `page-tree-utils.test.ts` sorts by `order`, then title.
- Accept: tests green.
- Risk: renumbering many siblings causes noisy commits; use sparse order values.

**PR 61 — `feat(core): parse and serialize cept:comment markers`**

- Changes: the D3 format for `<!-- cept:comment {...} -->`, with id, author, created, anchor and Markdown body; room for later threading; malformed markers preserved as unknown HTML.
- Red: corpus fixtures for anchored, page-level and malformed comments.
- Accept: fixtures green.
- Risk: the format must be fixed in D3 before this PR.

**PR 62 — `feat(editor): anchored and page-level comments with author`**

- Changes: an editor mark for anchored comments and a page-level list; author from the signed-in PAT user, device-local display name otherwise (NTN-007).
- Red: add a comment, save, reload: anchor and author survive.
- Accept: tests green.
- Risk: anchors after heavy edits; anchor by marker position, not offsets.

**PR 63 — `feat(ui): comments panel and new-since-last-visit badge`**

- Changes: comments panel; per-device last-visit timestamp; badge in sidebar and page header.
- Red: component test for the badge.
- Accept: tests green.
- Risk: none notable.

**PR 64 — `feat(sync): merge comments by id`**

- Changes: comment markers merge by id during sync merges (PR 37), so two people adding comments never conflict.
- Red: integration test with two clones adding different comments to one page.
- Accept: test green.
- Risk: none notable.

**PR 65 — `test(editor): bind editor and comment acceptance tests`**

- Changes: bind the editor-area and comment `.feature` files to step definitions; drop wiki-link scenarios; database steps marked Phase 2; update the Notion parity table (NTN-001).
- Red: unbound steps fail the integration project.
- Accept: integration green with every Phase 1 scenario bound.
- Risk: none notable.

### M5 — PWA on phones and desktop bundles

**PR 66 — `fix(web): base-path-aware manifest, icons and ios metadata`**

- Changes: icons in `packages/web/public/icons/`; manifest `start_url`, `scope`, `id`, icons and shortcuts relative to the base; `index.html` gets `viewport-fit=cover`, `apple-touch-icon` and `apple-mobile-web-app-capable`.
- Red: a Playwright check against the built bundle at `/cept/app/` that every manifest icon returns 200 and `start_url` sits under the base (fails today: icons missing).
- Accept: check green.
- Risk: none notable.

**PR 67 — `fix(web): precache built assets under the base path`**

- Changes: precache list generated from the Vite build manifest; base-relative URL patterns; versioned cache name; install errors caught and reported; per-deployment isolation kept (WEB-020).
- Red: unit test of the generated list; built-bundle test that load, go offline, reload still renders (fails today under `/cept/app/`).
- Accept: tests green.
- Risk: a broken SW strands users; ship with a kill-switch path in the update flow.

**PR 68 — `test(e2e): add a built-bundle pwa project`**

- Changes: a Playwright project running `vite build` plus `vite preview` at the production base, covering install criteria, SW registration and offline reload; also runs against PR previews where possible (WEB-019).
- Red: the project fails on any of the PR 66 or 67 criteria if reverted.
- Accept: project green in CI.
- Risk: CI time; run it on PRs that touch web or ui only (PR 9).

**PR 69 — `fix(ui): phone layouts, safe areas and 44px touch targets`**

- Changes: global safe-area padding; a 44px minimum for interactive elements; sidebar that no longer covers buttons on phones (removes the `closeSidebarOnMobile` workaround); no horizontal scroll at 360px.
- Red: Pixel 5 and iPhone e2e assertions for no horizontal scroll, 44px targets and safe-area padding with an emulated inset.
- Accept: assertions green; screenshots updated.
- Risk: touches many styles; screenshots in the PR. Playwright's iPhone profiles run on WebKit, so this PR also installs WebKit in the e2e job (through lane A's task pattern).

**PR 70 — `fix(ui): keep the caret above the on-screen keyboard`**

- Changes: `visualViewport` handling and `interactive-widget=resizes-content` so the caret stays visible.
- Red: e2e test that after focusing and typing near the bottom, the caret lies inside `visualViewport`.
- Accept: test green on Pixel 5 and iPhone profiles.
- Risk: emulation approximates real keyboards; note manual check on a device.

**PR 71 — `test(e2e): require the mobile viewport suite`**

- Changes: Mobile Chrome and an iPhone profile run the core flows with screenshots; their checks join the required list from PR 11.
- Red: the mobile project is not required today.
- Accept: a deliberately broken phone layout blocks a test PR.
- Risk: flaky mobile tests would block everyone; fix flakes before making it required.

**PR 72 — `build(desktop): scaffold the electrobun shell`**

- Changes: Electrobun dependency, entrypoint and config in `@cept/desktop`; `build` and `dev` targets (root `dev:desktop` works); the shell loads the built `@cept/web` bundle as a thin wrapper (D-43).
- Red: a smoke test that `nx run desktop:build` produces an app bundle for the host OS.
- Accept: test green on Linux CI; headless launch where possible.
- Risk: the largest unknown in Phase 1; spike before opening the PR. If the scaffold passes about 400 lines, split config and entrypoint from the build target.

**PR 73 — `refactor(desktop): remove electron bridge and slim the bridge`**

- Changes: delete `ElectronBridge` and Electron references in docs; the bridge covers desktop and the web fallback only (APP-008, D-17).
- Red: a grep test that fails on `electron` imports.
- Accept: tests green.
- Risk: none notable.

**PR 74 — `feat(desktop): open local folders with external-edit watch`**

- Changes: `LocalFsBackend` (moved in PR 13) wired through the bridge; open-folder dialog; external edits update the open space.
- Red: watch integration test against a temp dir.
- Accept: tests green; manual check of an external edit.
- Risk: recursive `fs.watch` differs by OS; test on all three in CI.

**PR 75 — `feat(desktop): store tokens in the os keychain`**

- Changes: an OS keychain `TokenStore` implementation for desktop.
- Red: unit test with a mocked keychain; contract test shared with the web store.
- Accept: tests green.
- Risk: Linux keyring availability; fall back with a visible warning.

**PR 76 — `feat(desktop): app menus for about, help and settings`**

- Changes: native menu template; menu clicks emit UI events (D-40; no tray).
- Red: unit test of the template; bridge test that clicks emit events.
- Accept: tests green.
- Risk: none notable.

**PR 77 — `feat(desktop): update from github releases`**

- Changes: the existing `auto-updater.ts` fed by the Electrobun updater from GitHub Releases.
- Red: extend `auto-updater.test.ts` with a recorded Releases response.
- Accept: tests green; manual update check against a test release.
- Risk: updater format must match the artifacts from PRs 78 and 79.

**PR 78 — `ci(release): build and attach the macos dmg`**

- Changes: re-enable the macOS job from PR 10 as an arm64 and x64 matrix via `mise run build:desktop`; `if-no-files-found: error`; signing and notarization optional with `::warning::` when secrets are missing.
- Red: a tag dry run with the artifact removed fails the job.
- Accept: a test tag attaches both dmgs.
- Risk: macOS runner minutes; build only on tags plus PR 80's smoke.

**PR 79 — `ci(release): build and attach windows and linux packages`**

- Changes: re-enable Windows (NSIS x64) and Linux (AppImage and deb x64) jobs the same way; the final upload fails on error.
- Red: tag dry run with a missing artifact fails.
- Accept: a test tag attaches NSIS, AppImage and deb.
- Risk: deb packaging may need extra tooling pinned in mise.

**PR 80 — `ci: smoke-test desktop packaging on prs and sync versions`**

- Changes: a PR job building an unsigned package on Linux (and macOS when desktop changes); the desktop package version is set from release-it (APP-021).
- Red: a test that fails when the package filename or version differs from the root version.
- Accept: PR job green; version check green.
- Risk: none notable.

## 6. Parallelism

Up to four lanes can run at once without touching the same files:

| Lane                 | PRs                                                | Main files touched                                                    | Can start after                |
| -------------------- | -------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| A — CI               | 1–11, then 71, 78–80                               | `.mise.toml`, `.github/workflows/`, `scripts/ci/`, `nx.json`          | now                            |
| B — core spaces/sync | 12, 14, 15, 19, 29, 33, 35                         | `packages/core/src/storage`, `core/src/space`, `core/src/auth`        | now (14 needs D2)              |
| C — ui spaces/sync   | 16 → 17 → 18, 20–26, then 27, 28, 30–32, 34, 36–43 | `App.tsx`, `ui/src/components/storage`, `router.ts`, `StorageContext` | 16 after 12                    |
| D — markdown/editor  | 44, 45–52, then 53–65                              | `core/src/markdown`, `ui/src/components/editor`, `CeptEditor.tsx`     | now (45 needs D3; 47 needs D6) |
| E — PWA              | 66–70                                              | `packages/web/public`, `service-worker.ts`, ui CSS, `e2e/`            | now                            |
| F — desktop          | 72–77                                              | `packages/desktop`                                                    | after 7                        |

Rules that keep the lanes conflict-free:

- **M0 first in lane A, but not blocking others.** PRs 12, 14, 16, 44, 45, 66 and 69 can be developed while M0 lands; they merge after PR 2 so they run under the new workflows. PRs 13 and 28 also wait for PR 8, because their red step is removing a boundary-baseline entry.
- **PR 5 (Prettier) is a merge barrier.** Merge it when as few PRs as possible are open, and rebase all open PRs right after.
- **`App.tsx` is single-lane.** Only lane C edits it. PR 16 goes first; PRs 18, 22, 26, 27, 28, 32 and 36 each touch it, so they are serialized in that lane. Lane D's PRs 46 and 49 edit `App.tsx` only where page content is passed to the editor; they rebase after lane C's current PR and merge between lane C PRs.
- **`CeptEditor.tsx` is single-lane** (lane D). Lane E's PR 69 changes CSS only and coordinates with PR 49 if both touch editor styles.
- **Workflows are single-lane** (lane A). PR 68 adds its Playwright project in `e2e/` and a job through lane A's pattern; PR 71 is the only lane E change to required checks.
- **Pairs that are safe in parallel:** 12 ∥ 14 ∥ 27 ∥ 29 ∥ 44 ∥ 45 ∥ 66 ∥ 69 ∥ 72; 19 ∥ 33 ∥ 35 ∥ 47; 53 ∥ 59 ∥ 60 ∥ 61; 74 ∥ 75 ∥ 76 ∥ 77.
- **Cross-lane dependencies to watch:** 21 and 60 both write the folder tree (land 21 first); 37 and 64 share the merge engine; 39 and 67 meet at the service worker (the SW only wakes the leader); 62 needs 30 for author identity; 74 needs 13 and 19.

## 7. Requirements to write before their PR

The proposals in [scope.md §9](scope.md#9-requirements-to-add-or-amend) are not yet in the area files (a grep on 2026-10-07 found none of the new IDs). Each is written as a docs-only commit to `main` before the first PR that needs it.

| Item | Docs change (straight to `main`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Area file                                                                                                                          | Needed by              |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1   | Correct stale engineering state: REQ-ENG-017 "Current state" (main green again since PR #354), the REQ-ENG-005 table, REQ-ENG-019 workflow docs, README badge and CONTRIBUTING claims (ENG-014); fix TASKS.md T5.x/P5.x checkboxes against what is wired; CLAUDE.md desktop row says Electrobun on all three OSes.                                                                                                                                                                                                                                               | [10-engineering-and-ci.md](requirements/10-engineering-and-ci.md), README, CONTRIBUTING, TASKS.md                                  | before PR 1 (context)  |
| D2   | Write **REQ-WS-023** space autodiscovery (PAT-only `GET /user/repos`, Git Trees, `branch:`), **REQ-WS-024** space lifecycle UI, **REQ-WS-025** legacy flat-space migration, **REQ-WS-026** git sync conflict resolution, **REQ-WS-027** git sync policy; amend **REQ-WS-014** and **REQ-APP-010** so in-process sync (SharedWorker or leader tab, Electrobun main process) is the complete path and daemon parts are deferred; settle key casing (WS open question 10) for `space.cept.yaml` and front matter; add the `.cept.yaml` schema (D-41) to REQ-WS-018. | [03-spaces-and-storage.md](requirements/03-spaces-and-storage.md), [07-native-apps.md](requirements/07-native-apps.md)             | 14, 21, 26, 33, 35, 37 |
| D3   | Write **REQ-EDT-026** page front-matter schema (reserved keys title, icon, cover, tags, aliases, description, created, updated, order, id; unknown keys round-trip) and **REQ-EDT-027** standard links, assets and foreign files; specify the toggle encoding (EDT-024); specify the exact `cept:comment` JSON format (D-34) and amend **REQ-NTN-005** (inline, not sidecar YAML) and **REQ-NTN-007** (author from the PAT user, device-local name otherwise).                                                                                                   | [08-editor.md](requirements/08-editor.md), [11-notion-parity-and-comments.md](requirements/11-notion-parity-and-comments.md)       | 45, 46, 48, 54, 61     |
| D4   | Write **REQ-WEB-024** PWA durable offline sync and storage persistence (Phase 1 parts only; the OAuth callback parts are Phase 2); amend **REQ-AUTH-005** for fine-grained and classic PATs, validation and what the token grants (multiple accounts and App precedence noted as Phase 2).                                                                                                                                                                                                                                                                       | [01-browser-app-and-pwa.md](requirements/01-browser-app-and-pwa.md), [09-remotes-and-auth.md](requirements/09-remotes-and-auth.md) | 29, 39, 40             |
| D5   | Amend **REQ-APP-001 to 003** with the D-28 format and architecture table, and **REQ-APP-013 and 015** with optional signing and GitHub Releases only; mark daemon-dependent parts of REQ-APP-010 and 017 deferred (D-40).                                                                                                                                                                                                                                                                                                                                        | [07-native-apps.md](requirements/07-native-apps.md)                                                                                | 72, 78                 |
| D6   | Record the owner's D-15 pipeline choice (option A remark/mdast with a ProseMirror bridge, or option B markdown-it with per-node serializers) and the spike result.                                                                                                                                                                                                                                                                                                                                                                                               | [08-editor.md](requirements/08-editor.md)                                                                                          | 47                     |

REQ-AUTH-019 (GitHub App registration and iac wiring) from §9 is Phase 2 and is not part of this plan.

## 8. Open owner questions

1. ~~D-15 pipeline~~ Decided (D-49): option A, remark/mdast with a ProseMirror bridge; PR 47 starts with the spike.
2. ~~`cept:comment` format~~ Decided (D-44): draft approved; D3 defines the fields.
3. ~~Required-check bypass~~ Decided (D-45): reuse the automation App and the `_tag-release.yml` pattern; the App bypasses the PR and status-check rulesets, not `protect-default-branch`.
4. ~~Boundary baseline~~ Decided (D-46): accepted.
5. ~~Key casing~~ Decided (D-47): camelCase everywhere.
6. Merge policy (D-48): a functional PR merges once Henry approves and CI is green.

## 9. Coverage check

Every Phase 1 requirement in [scope.md §3](scope.md#3-phase-1-this-build-out) maps to at least one PR above, except these, which are already implemented and only need to keep passing: REQ-WEB-015, REQ-WEB-021, REQ-WS-011, REQ-ENG-005, REQ-ENG-010, REQ-ENG-014 and REQ-EDT-001 (PR 49 must keep EDT-001 green). REQ-WEB-001 and REQ-WEB-002 are covered by the boundary work (PRs 8, 13, 28) and the desktop shell (PR 72); REQ-WEB-004 by PR 17's boot check; REQ-WS-022 by PR 16 and D1; REQ-ENG-019 (workflow docs match the rulesets) by D1, re-checked after PR 11 changes the rulesets; REQ-ENG-012 by PR 4 plus the existing release-it flow, which PRs 2 and 11 must keep working.

Nothing from Phase 2, Phase 3, later or out is built: no GitHub App, relay Worker or iac work (PAT only), no database UI (PR 44 removes it), no static rendering or docs site, no Capacitor builds (PR 10 disables them, PR 7 marks `@cept/mobile` `nobuild`), no co-editing, no `[[wiki-links]]` (PR 53 deletes the dead converter, PR 65 drops the scenarios), no Notion import, no @person mentions (PR 58), and no comment threading or resolving (PR 61 only leaves room for it).

The surveys did not verify: whether CI run 37564606906 finished green, the state of PRs #246 and #283 after #354, `_update-screenshots.yml` in full, and whether `inline-database.ts` is registered in `CeptEditor`. Check these at the start of PRs 2, 11 and 44.
