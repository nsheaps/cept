# Contributing to Cept

Thank you for your interest in contributing to Cept! This guide will help you get started.

## Development Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) for tool version management
- [Bun](https://bun.sh/) (installed via mise)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/nsheaps/cept.git
cd cept

# Install tools (Node.js, Bun, etc.)
mise install

# Install dependencies
bun install

# Start development server
bun run dev
```

### Key Commands

```bash
bun run dev          # Dev mode (all packages)
bun run dev:web      # Dev mode (web only)
bun run build        # Production build
bun run test         # All unit + integration tests, through Nx
bun run lint         # ESLint
mise run lint        # ESLint, workflow lint and prettier --check
mise run format      # Apply Prettier formatting
bun run typecheck    # TypeScript check
bun run validate     # Full quality gate (lint + typecheck + test)
```

## Project Structure

```
cept/
├── packages/
│   ├── core/       # Business logic, storage backends, CRDT
│   ├── ui/         # React components and hooks
│   ├── web/        # Vite SPA + PWA
│   ├── desktop/    # Electrobun (macOS) + Electron
│   ├── mobile/     # Capacitor iOS + Android
│   └── signaling-server/  # WebSocket signaling
├── docs/           # Documentation site
├── e2e/            # Playwright E2E tests
└── features/       # BDD feature files
```

## Architecture Rules

These rules are enforced in code review and CI:

1. `@cept/ui` and `@cept/core` must **never** import platform-specific modules
2. All persistence goes through the `StorageBackend` interface
3. Git-specific UI is gated by `backend.capabilities` checks
4. The app must boot to a fully functional state with `BrowserFsBackend` alone
5. TypeScript strict mode everywhere — no `any`, no `@ts-ignore`

## Making Changes

### Code Style

- TypeScript strict mode
- ESLint for lints, Prettier for formatting. `mise run lint` fails on unformatted files. Same-repo PRs get an autofix commit from the Format workflow; on fork PRs, run `mise run format` yourself.
- Prefer functional patterns where appropriate
- Write tests for all new code

### Packages and Nx Targets

- Every Nx project has `build`, `typecheck` and `test:unit` targets. A project that genuinely has nothing to build or unit-test says why in its `package.json`: `"cept": {"skipTargets": {"build": "<reason>"}}`. `mise run lint` runs `mise run check:targets`, which fails otherwise.
- Declare each runtime dependency in the package that imports it, with an exact version. The root `package.json` holds tooling only.

### Testing Requirements

- Every new function/class gets unit tests
- Every new UI component gets component tests
- Run `bun run validate` before submitting

### Commit Messages and PR Titles

Pull requests are squash-merged, so the PR title becomes the commit on `main`, and release-it reads it to choose the next version. The `PR Title` check fails unless the title is a [Conventional Commit](https://www.conventionalcommits.org/):

- Format: `type(scope): subject`. The scope is optional and lowercase; add `!` after the type or scope for a breaking change. At most 100 characters.
- Types are the ones listed in [`.release-it.json`](.release-it.json): `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `ci`, `build`, `style`, `revert`, `chore`.
- Check a title locally with `PR_TITLE="fix(editor): keep the caret after paste" mise run ci:pr-title`.

Use the commit body to explain **why** the change was made:

```
feat(sync): replay the offline queue in batches

The offline queue now replays queued operations in configurable
batches with delays between batches to avoid overwhelming the
server on reconnect.
```

## Reporting Issues

- Use [GitHub Issues](https://github.com/nsheaps/cept/issues)
- Include steps to reproduce for bugs
- Include expected vs actual behavior
- Include browser/OS version if relevant

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
