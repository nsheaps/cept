# /phase-gate — Phase Completion Verification

Run before starting a new phase. Checks ALL quality gates:

1. Verify all tasks in the current phase are marked `[x]` in TASKS.md
2. Run full validation suite (`/validate`)
3. Check code coverage for the phase's primary package (target: 80%+)
4. Verify documentation is updated for all new features
5. Run E2E tests and capture fresh screenshots
6. Create a summary commit: `git commit -m "milestone: complete Phase X"`
7. Tag the commit: `git tag phase-X-complete`
8. Push: `git push && git push --tags`
9. Print: "Phase X complete. Ready to begin Phase X+1."

If any gate fails, list what's missing and do NOT proceed.
