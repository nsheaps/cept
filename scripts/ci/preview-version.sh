#!/usr/bin/env bash
# Computes the PR preview version and exports PREVIEW_VERSION to $GITHUB_ENV.
# Inputs: PR_NUMBER, HEAD_SHA.
set -euo pipefail

if ! next_version=$(bunx release-it --release-version --ci 2>/dev/null) || [ -z "$next_version" ]; then
  next_version=$(node -p "require('./package.json').version")
fi
short_sha=${HEAD_SHA:?HEAD_SHA is required}
short_sha=${short_sha:0:7}
echo "PREVIEW_VERSION=${next_version}-pr.${PR_NUMBER:?PR_NUMBER is required}+${short_sha}" >>"${GITHUB_ENV:-/dev/stdout}"
