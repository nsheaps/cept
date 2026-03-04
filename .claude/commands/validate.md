# /validate — Full Quality Gate Check

Run the complete validation suite and report results:

```bash
echo "=== Lint ===" && bun run lint
echo "=== Typecheck ===" && bun run typecheck
echo "=== Unit Tests ===" && bun run test:unit
echo "=== Integration Tests ===" && bun run test:integration
echo "=== E2E Tests ===" && bun run test:e2e
```

After running all checks, produce a summary table:

| Check | Status | Details |
|---|---|---|
| Lint | pass/fail | X warnings, Y errors |
| Typecheck | pass/fail | X errors |
| Unit Tests | pass/fail | X passed, Y failed, Z skipped |
| Integration Tests | pass/fail | X passed, Y failed |
| E2E Tests | pass/fail | X passed, Y failed |

If any check fails, list the specific failures and propose fixes.
Do NOT proceed with new feature work until all checks pass.
