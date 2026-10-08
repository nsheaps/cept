# Security gate fixtures

Deliberately broken inputs for `tools/security/gates.integration.test.ts`. They
prove the `mise run security` gates (gitleaks, osv-scanner) fail on real
problems; a gate that cannot fail proves nothing.

- `config.txt` holds a fake high-entropy API key. It is not a real credential.
- `bun.lock` pins `lodash@4.17.15` (GHSA-p6mc-m468-83gw, prototype pollution).

The real-tree scans skip this directory by path (`.gitleaks.toml` allowlist;
`osv-scanner` is pointed at the root `bun.lock` only). The test copies the
files elsewhere and checks the gates still fail, so the exclusion cannot hide a
regression in the gates themselves. Never put a real secret here.
