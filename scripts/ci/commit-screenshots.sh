#!/usr/bin/env bash
# Commits downloaded screenshot updates. The release workflow pushes the commit
# with the automation App token; [skip ci] avoids re-running CI on it.
set -euo pipefail

git add docs/screenshots/
if ! git diff --cached --quiet; then
  git commit -m "docs(screenshots): update feature screenshots [skip ci]"
fi
