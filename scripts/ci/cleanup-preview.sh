#!/usr/bin/env bash
# Removes /pr-<N> from the checked-out gh-pages branch. Input: PR_NUMBER.
set -euo pipefail

pr_number=${PR_NUMBER:?PR_NUMBER is required}
deploy_dir="pr-${pr_number}"

if [ -d "${deploy_dir}" ]; then
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"
  rm -rf "${deploy_dir}"
  git add -A
  git commit -m "Clean up preview for PR #${pr_number}" --allow-empty
  git push origin gh-pages
fi
