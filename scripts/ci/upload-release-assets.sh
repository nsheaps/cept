#!/usr/bin/env bash
# Uploads downloaded desktop artifacts in dist/ to the release for GITHUB_REF_NAME.
# Moved unchanged from cd.yml; PR 10 reworks the native jobs and this step.
set -euo pipefail

if ls dist/*.dmg dist/*.exe dist/*.AppImage 2>/dev/null; then
  gh release upload "${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}" dist/*.dmg dist/*.exe dist/*.AppImage --clobber 2>/dev/null || true
fi
