#!/usr/bin/env bash
# Bump version across all packages in the monorepo.
# Usage: ./scripts/bump-version.sh <new-version>

set -euo pipefail

VERSION="${1:?Usage: bump-version.sh <version>}"

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo "Error: Version must be semver (e.g., 1.2.3 or 1.2.3-beta.1)" >&2
  exit 1
fi

echo "Bumping all packages to v${VERSION}..."

# Update root package.json
bun --eval "
const pkg = require('./package.json');
pkg.version = '${VERSION}';
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update all workspace package.json files
for dir in packages/*/; do
  if [ -f "${dir}package.json" ]; then
    bun --eval "
const pkg = require('./${dir}package.json');
pkg.version = '${VERSION}';
require('fs').writeFileSync('${dir}package.json', JSON.stringify(pkg, null, 2) + '\n');
"
    echo "  Updated ${dir}package.json"
  fi
done

# Also update docs if it has a package.json
if [ -f "docs/package.json" ]; then
  bun --eval "
const pkg = require('./docs/package.json');
pkg.version = '${VERSION}';
require('fs').writeFileSync('docs/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
  echo "  Updated docs/package.json"
fi

echo "Done. All packages set to v${VERSION}."
echo ""
echo "Next steps:"
echo "  git add -A && git commit -m 'chore: bump version to v${VERSION}'"
echo "  git tag v${VERSION}"
echo "  git push origin main --tags"
