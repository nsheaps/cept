#!/usr/bin/env bash
# Extracts this tag's CHANGELOG.md section into a notes file.
# Inputs: GITHUB_REF_NAME (tag, e.g. v1.2.3); $1 = notes file (default /tmp/release-notes.md).
# Output: auto=true|false in $GITHUB_OUTPUT (true when there is no entry).
set -eu # no pipefail: a missing CHANGELOG.md must yield auto-generated notes

version="${GITHUB_REF_NAME:?GITHUB_REF_NAME is required}"
version="${version#v}"
notes_file=${1:-/tmp/release-notes.md}
notes=$(sed -n "/^## \\[${version}\\]/,/^## \\[/p" CHANGELOG.md 2>/dev/null | head -n -1 | tail -n +2)

if [ -z "$notes" ]; then
  echo "No changelog entry found for ${version}, using auto-generated notes"
  echo "auto=true" >>"${GITHUB_OUTPUT:-/dev/stdout}"
else
  echo "auto=false" >>"${GITHUB_OUTPUT:-/dev/stdout}"
  echo "$notes" >"$notes_file"
fi
