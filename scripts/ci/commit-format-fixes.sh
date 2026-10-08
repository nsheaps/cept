#!/usr/bin/env bash
# Commits Prettier's fixes and pushes them to the PR branch.
# Runs after `mise run format` in format.yml. The checkout uses the automation
# App token, so the push starts a new CI run; never add [skip ci] here, or the
# PR's final commit would have no checks.
# Usage: commit-format-fixes.sh <pr-head-branch>
set -euo pipefail

branch=${1:?usage: commit-format-fixes.sh <pr-head-branch>}

if git diff --quiet; then
  echo "Formatting is already clean; nothing to commit."
  exit 0
fi

git diff --stat
git commit --all --message "style: apply prettier formatting"
git push origin "HEAD:refs/heads/$branch"
echo "::notice title=Format autofix::Pushed Prettier fixes to $branch; CI re-runs on the new commit."
