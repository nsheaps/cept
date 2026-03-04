# /status — Project Status Report

Generate a comprehensive status report:

1. Read `TASKS.md` and count completed vs total tasks per phase
2. Run `git log --oneline -20` to show recent commits
3. Run `bun run validate` (quick mode) to check health
4. Check for any TODO/FIXME/HACK comments: `grep -rn "TODO\|FIXME\|HACK" packages/ --include="*.ts" --include="*.tsx" | head -20`
5. Check test coverage if available

Output a summary like:

```
=== Cept Project Status ===

Phase Progress:
  Phase 0: Foundation     [5/7 complete] ████████░░ 71%
  Phase 1: Core Engine    [0/8 complete] ░░░░░░░░░░  0%
  ...

Health: All checks passing (or failed with details)
Last commit: <hash> <message> (<time ago>)
Next task: T0.6 — Set up Playwright with smoke test
Open TODOs: 12
```
