#!/usr/bin/env bash
# Compares regenerated screenshots with HEAD pixel by pixel. Files whose pixels
# are identical are restored (so a metadata-only diff is not committed).
# Output: changed=true|false in $GITHUB_OUTPUT (stdout when unset).
set -euo pipefail

sudo apt-get update -qq
sudo apt-get install -y -qq imagemagick >/dev/null

old=$(mktemp --suffix=.png)
trap 'rm -f "$old"' EXIT

changed=false
for new_file in docs/screenshots/features/*.png; do
  [ -f "$new_file" ] || continue

  # A file not tracked at HEAD is new, which is a real change.
  if ! git show HEAD:"$new_file" >"$old" 2>/dev/null; then
    echo "NEW: $new_file"
    changed=true
    continue
  fi

  # AE = absolute error (differing pixel count). `compare` exits 1 when the
  # images differ, so the exit status is not a failure signal here.
  diff=$(compare -metric AE "$new_file" "$old" /dev/null 2>&1 || true)

  if [ "$diff" = "0" ]; then
    echo "UNCHANGED (metadata only): $new_file"
    git checkout HEAD -- "$new_file"
  else
    echo "CHANGED ($diff pixels differ): $new_file"
    changed=true
  fi
done

echo "changed=$changed" >>"${GITHUB_OUTPUT:-/dev/stdout}"
