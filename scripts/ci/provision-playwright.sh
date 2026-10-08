#!/usr/bin/env bash
# Copies Playwright's browsers out of its official image into ~/.cache/ms-playwright.
# Playwright's browser CDN (storage.googleapis.com / playwright.download.prss.microsoft.com)
# stalls intermittently from CI, hanging `playwright install` for the full job
# timeout. The image is version-matched to the installed @playwright/test.
# Input: PLAYWRIGHT_VERSION.
set -euo pipefail

img="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION:?PLAYWRIGHT_VERSION is required}-noble"
docker pull "$img"
cid=$(docker create "$img")
mkdir -p ~/.cache/ms-playwright
docker cp "$cid:/ms-playwright/." ~/.cache/ms-playwright/
docker rm "$cid" >/dev/null
ls -1 ~/.cache/ms-playwright
