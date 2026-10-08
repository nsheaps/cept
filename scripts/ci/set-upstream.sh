#!/usr/bin/env bash
# Sets the upstream of a branch so release-it does not complain.
# Usage: set-upstream.sh <remote-branch> [local-branch]   (local defaults to the current branch)
# Best effort: release-it only warns when there is no upstream.
set -euo pipefail

remote_branch=${1:?usage: set-upstream.sh <remote-branch> [local-branch]}
git branch --set-upstream-to="origin/$remote_branch" ${2:+"$2"} 2>/dev/null || true
