# CLAUDE.md — Cept Project Knowledge

## Project Summary

Cept is a Notion clone with multiple storage backends: browser (IndexedDB), local folder, or Git repo. Git adds collaboration, history, and sync — but the full editor/database/graph experience works on any backend. See the full spec in `.claude/prompts/init.md` (the bootstrap prompt).

## Repository

- **Remote:** github.com/nsheaps/cept
- **Default branch:** main
- **Git workflow (D-21):** Docs-only changes are committed and pushed directly to `main` without review. Functional changes (code, CI) go through small, reviewable draft PRs; a PR may be merged once Henry (the review agent) approves and CI is green (D-48). The only exception for interrupted sessions is `wip/T<X>.<Y>` branches, which get rebased onto `main` immediately in the next session.
- **Space concept:** A **space** is a folder with a `space.cept.yaml` (or `space.cept.yml`) marker file at its root. One Git repo may contain multiple spaces in sub-folders. See [`docs/specs/requirements/03-spaces-and-storage.md`](docs/specs/requirements/03-spaces-and-storage.md).

## Toolchain

- **mise** manages all tool versions (see `.mise.toml`)
- **Bun** is the JS runtime, package manager, bundler, and test runner
- **Nx** orchestrates monorepo tasks (with Bun workspaces)
- **TypeScript strict mode** everywhere — no `any`, no `@ts-ignore`

## Key Commands

```bash
mise install                    # Install all tool versions (pinned exactly in .mise.toml)
mise run check                  # Full local gate: pins, lint, typecheck, unit + integration, build, security
mise run security               # gitleaks (history + tree) and osv-scanner (bun.lock); needs network for api.osv.dev
mise run <task>                 # install, lint, format, typecheck, test:unit, test:integration, test:e2e, build, check:pins
bun install                     # Install dependencies
bun run dev                     # Dev mode (all packages)
bun run dev:web                 # Dev mode (web only)
bun run dev:desktop             # Dev mode (desktop only)
bun run build                   # Production build
bun run test                    # All unit + integration tests (nx run-many)
bun run test:unit               # Unit tests, one Nx target per project
bun run test:integration        # Integration tests (the root cept-workspace project)
bun run test:e2e                # Playwright E2E tests
bun run test:e2e:screenshots    # E2E with screenshot capture
bun run lint                    # ESLint (per package)
bun run typecheck               # tsc --noEmit
bun run validate                # lint + typecheck + test (full gate)
mise run check                  # Full local gate: pins, lint (incl. workflows), typecheck, unit + integration tests, build, security
mise run lint:format            # prettier --check . (part of mise run lint)
mise run format                 # prettier --write . (CI's format.yml pushes this as an autofix commit on PRs)
mise run lint:workflows         # actionlint + shellcheck on scripts/ci + no multi-command `run:` steps
mise run check:targets          # every Nx project has build, typecheck, test:unit (or a skip reason) and one scope:/platform: tag (part of lint)
mise run build:web              # Web app only (what the PR preview deploys)
mise run screenshots:capture    # Regenerate docs/screenshots/features (needs Playwright browsers)
mise run ci:version-check       # Release-version outputs for the PR comment (writes $GITHUB_OUTPUT)
PR_TITLE="feat: x" mise run ci:pr-title  # Check a PR title is a Conventional Commit (types from .release-it.json)
nx graph                        # Visualize project dependency graph
nx affected -t test:unit        # Unit-test only affected packages
nx affected -t build            # Build only affected packages
```

## CI Conventions

Workflows call `mise run <task>` or a script in `scripts/ci/`; a `run:` step holds one command (`mise run lint:workflows` enforces it via `scripts/ci/no-inline-logic.ts`; synced templates are allowlisted there with a reason). Put shell logic in `scripts/ci/*.sh` (shellcheck-clean, `set -euo pipefail`) or `scripts/ci/*.ts` with a test beside it. Lint and typecheck are separate jobs (`_lint.yml`, `_typecheck.yml`). On pull requests the lint, typecheck, unit, integration, e2e and build jobs set `NX_BASE` to the PR base, and their mise tasks (via `scripts/ci/nx-targets.ts`) run `nx affected`; on `main` and locally they run every project. Root config files are the `sharedGlobals` input in `nx.json`, so changing one runs everything; add a new root config file there.

## Nx Targets

Every project defines `build`, `typecheck` and `test:unit`, or records why it has none in its `package.json` (`"cept": {"skipTargets": {"build": "<reason>"}}`); `mise run check:targets` enforces this. A package's `test:unit` is `vitest run --root <repo> --project unit <package dir>`, so the root Vitest config applies. Repo scripts and integration tests belong to the root `cept-workspace` project ([`project.json`](project.json)). Each package declares the runtime dependencies it imports, exactly pinned; the root `package.json` has none.

## Monorepo Packages

| Package           | Path                         | Purpose                                                                             |
| ----------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `@cept/core`      | `packages/core/`             | Business logic, StorageBackend (browser/local/git), DB engine, CRDT, parsers, graph |
| `@cept/ui`        | `packages/ui/`               | React components, hooks, stores (no platform deps)                                  |
| `@cept/web`       | `packages/web/`              | Vite SPA + PWA service worker                                                       |
| `@cept/desktop`   | `packages/desktop/`          | Electrobun shells (macOS, Windows, Linux)                                           |
| `@cept/mobile`    | `packages/mobile/`           | Capacitor iOS + Android                                                             |
| `@cept/signaling` | `packages/signaling-server/` | Yjs WebSocket signaling server                                                      |
| `@cept/docs`      | `docs/`                      | Starlight/VitePress documentation site                                              |
| `@cept/e2e`       | `e2e/`                       | Playwright E2E tests + screenshot capture                                           |

## Architecture Rules (NEVER VIOLATE)

1. `@cept/ui` and `@cept/core` must NEVER import platform-specific modules (electron, @capacitor/\*, node:fs direct)
2. All persistence goes through the `StorageBackend` interface — NEVER read/write files directly
3. `@cept/core` and `@cept/ui` depend ONLY on `StorageBackend`, NEVER on a specific backend implementation
4. Git-specific UI is gated by `backend.capabilities` checks, NEVER by `backend.type === "git"`
5. NO module outside of `GitBackend` may import `isomorphic-git` directly
6. The app MUST boot to a fully functional state with `BrowserFsBackend` alone — zero Git, zero filesystem
7. All auth goes through `AuthProvider` abstraction (only needed for Git remotes)
8. Prefer isomorphic-git over GitHub API for all Git operations
9. Markdown files use HTML comments (`<!-- cept:block -->`) for extended blocks
10. Database schemas are YAML files in `.cept/databases/`
11. Opening a local folder MUST NOT modify existing files unless the user explicitly edits them in Cept

Lint enforces rules 1, 3 and 5 and the project dependency directions. Every Nx project has one `scope:` and one `platform:` tag (`nx.tags` in `package.json`; `mise run check:targets` checks it); `@nx/enforce-module-boundaries` in [`eslint.config.js`](eslint.config.js) constrains imports by tag, and `cept/restricted-imports` ([`tools/lint/boundaries.js`](tools/lint/boundaries.js)) forbids platform modules in core and ui, concrete backends in ui and `isomorphic-git` outside `GitBackend`. Older violations are listed in [`tools/lint/boundary-baseline.json`](tools/lint/boundary-baseline.json) with a per-file `count`, which may only go down; `tools/lint/boundaries.integration.test.ts` proves the rules fail on [`tools/boundary-fixtures/`](tools/boundary-fixtures/) and that the baseline neither grows nor goes stale. Never add a baseline entry to get green; fix the import.

## Task Tracking

Current progress is tracked in `TASKS.md`. Always:

1. Check `TASKS.md` for current phase and next task
2. Follow the task execution protocol (Spec & Research -> Red -> Green -> Refactor -> Validate -> Document & Review Spec -> Commit)
3. Mark tasks complete when done
4. Never skip to a later phase without completing the current one

## Session Resume Protocol

When resuming work (user says "continue"):

1. Start from the latest `main`. If a `wip/` branch exists from a previous interrupted session, rebase it onto `main`; docs-only work then fast-forwards into `main`, functional work moves to a PR branch.
2. `git pull` to get latest changes
3. Read `TASKS.md` to determine current phase and last completed task
4. Run `bun run validate` to verify the repo is in a clean state
5. If tests fail, fix them before starting new work
6. Pick up the next incomplete task
7. Follow the task execution protocol
8. After each completed task, push docs-only changes to `main`; push functional changes to a branch and open (or update) a small draft PR for owner approval

## Testing Requirements

- Every new function/class gets unit tests
- Every new UI component gets component tests
- Every new user-visible feature gets E2E tests with screenshots
- `bun run validate` must pass before committing
- Screenshots go to `docs/screenshots/` for documentation

## Claude Code Web Notes

- Container is ephemeral — all work must be committed to Git
- Run `session-start.sh` automatically at session start (it handles tool installation)
- Use `git push` frequently to preserve work
- If `mise` or `bun` are not available, the session-start script installs them
- Network access is limited to allowed domains — see `.claude/settings.json`
