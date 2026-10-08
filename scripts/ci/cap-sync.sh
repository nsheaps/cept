#!/usr/bin/env bash
# Syncs Capacitor for one platform. Usage: cap-sync.sh <ios|android>
set -euo pipefail

cd packages/mobile
npx cap sync "${1:?usage: cap-sync.sh <ios|android>}"
