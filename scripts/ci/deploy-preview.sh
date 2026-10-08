#!/usr/bin/env bash
# Publishes packages/web/dist to /pr-<N> on the gh-pages branch. Input: PR_NUMBER.
set -euo pipefail

pr_number=${PR_NUMBER:?PR_NUMBER is required}
deploy_dir="pr-${pr_number}"

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# The build is complete, so discard working tree changes before switching branch.
git checkout -- .
git fetch origin gh-pages || true
if git rev-parse --verify origin/gh-pages >/dev/null 2>&1; then
  git checkout -B gh-pages origin/gh-pages
else
  git checkout --orphan gh-pages
fi

rm -rf "${deploy_dir}"
mkdir -p "${deploy_dir}"
cp -r packages/web/dist/* "${deploy_dir}/"

# Shared site-level 404 router, if not already present.
if [ ! -f 404.html ]; then
  git show origin/main:.github/pages/404.html >404.html
  git add 404.html
fi

git add "${deploy_dir}"
git commit -m "Deploy preview for PR #${pr_number}" --allow-empty
git push origin gh-pages
