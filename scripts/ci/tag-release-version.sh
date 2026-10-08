#!/usr/bin/env bash
# Decides whether main has a releasable version.
# Output: skip=true|false and next_version in $GITHUB_OUTPUT (stdout when unset).
# Here a failing or empty release-it both mean "skip"; the tag job has nothing to do.
set -uo pipefail

out=${GITHUB_OUTPUT:-/dev/stdout}
next_version=$(bunx release-it --release-version --ci 2>/dev/null)
exit_code=$?

if [ "$exit_code" -ne 0 ] || [ -z "$next_version" ]; then
  echo "No version bump needed (exit code: $exit_code)"
  echo "skip=true" >>"$out"
else
  echo "Next version: $next_version"
  echo "next_version=$next_version" >>"$out"
  echo "skip=false" >>"$out"
fi
