#!/usr/bin/env bash
# Publishes packages/web/dist to /app on the gh-pages branch.
# Input: GITHUB_REF_NAME (for the commit message).
set -euo pipefail

git fetch origin gh-pages || true
git checkout gh-pages || git checkout --orphan gh-pages

rm -rf app
mkdir -p app
cp -r packages/web/dist/* app/

git show origin/main:.github/pages/404.html >404.html
git show origin/main:.github/pages/index.html >index.html

git add app/ 404.html index.html
git commit -m "Deploy production app (${GITHUB_REF_NAME:?GITHUB_REF_NAME is required})" --allow-empty
git push origin gh-pages
