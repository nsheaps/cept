#!/usr/bin/env bash
set -euo pipefail

echo "=== Cept Session Bootstrap ==="

# ---- 1. Detect environment ----
IS_WEB_SESSION=false
if [[ "${CLAUDE_CODE_WEB:-}" == "true" ]] || [[ ! -d "$HOME/.local" && ! -f "$HOME/.mise/bin/mise" ]]; then
  IS_WEB_SESSION=true
  echo "[env] Detected ephemeral/web container"
else
  echo "[env] Detected persistent environment"
fi

# ---- 2. Install mise if missing ----
if ! command -v mise &>/dev/null; then
  echo "[setup] Installing mise..."
  curl -fsSL https://mise.run | sh
  export PATH="$HOME/.local/bin:$PATH"
  # Add to shell profile for this session
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

# ---- 3. Install tool versions via mise ----
echo "[setup] Installing tool versions from .mise.toml..."
mise install --yes 2>/dev/null || mise install

eval "$(mise activate bash)"

# ---- 4. Verify bun is available ----
if ! command -v bun &>/dev/null; then
  echo "[error] Bun not available after mise install. Falling back to direct install."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

echo "[tools] mise version: $(mise --version)"
echo "[tools] bun version: $(bun --version)"
echo "[tools] node version: $(node --version 2>/dev/null || echo 'not installed')"

# ---- 5. Install dependencies ----
if [[ ! -d "node_modules" ]] || [[ "$IS_WEB_SESSION" == "true" ]]; then
  echo "[deps] Installing dependencies..."
  bun install --frozen-lockfile 2>/dev/null || bun install
else
  echo "[deps] node_modules exists, skipping install"
fi

# ---- 6. Verify Git configuration ----
if ! git config user.name &>/dev/null; then
  git config user.name "Claude Code"
  git config user.email "claude-code@cept.dev"
fi

# ---- 7. Ensure we're on main ----
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "none")
echo "[git] Current branch: $CURRENT_BRANCH"

# Handle WIP branches from interrupted sessions
WIP_BRANCH=$(git branch --list 'wip/*' 2>/dev/null | head -1 | tr -d ' *' || true)
if [[ -n "$WIP_BRANCH" ]]; then
  echo "[git] Detected WIP branch: $WIP_BRANCH — rebasing onto main..."
  git checkout main
  git pull --rebase 2>/dev/null || true
  git rebase main "$WIP_BRANCH" 2>/dev/null && {
    git checkout main
    git merge --ff-only "$WIP_BRANCH"
    git branch -d "$WIP_BRANCH"
    git push origin --delete "$WIP_BRANCH" 2>/dev/null || true
    git push
    echo "[git] WIP branch merged into main and cleaned up"
  } || {
    echo "[git] WARNING: WIP rebase had conflicts — agent should resolve manually"
    git rebase --abort 2>/dev/null || true
    git checkout main
  }
elif [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "[git] Switching to main..."
  git checkout main
  git pull --rebase 2>/dev/null || true
fi

# ---- 8. Run quick validation ----
echo "[validate] Running typecheck..."
bun run typecheck 2>/dev/null && echo "[validate] Typecheck passed" || echo "[validate] Typecheck had issues (non-blocking for session start)"

echo "[validate] Running tests..."
bun run test 2>/dev/null && echo "[validate] Tests passed" || echo "[validate] Some tests failed (check TASKS.md for context)"

# ---- 9. Print status summary ----
echo ""
echo "=== Session Ready ==="
echo ""
if [[ -f "TASKS.md" ]]; then
  echo "--- Current Progress ---"
  # Show the last completed task and next TODO
  grep -n "^\- \[x\]" TASKS.md | tail -3 || true
  echo "..."
  grep -n "^\- \[ \]" TASKS.md | head -3 || true
  echo ""
fi
echo "Run 'bun run dev:web' to start the dev server"
echo "Run 'bun run validate' for full validation"
echo "========================"
