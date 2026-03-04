# /continue — Resume Development

Read `TASKS.md` and determine the current phase and next incomplete task.

1. Run `bun run validate` to check repo health
2. If validation fails, fix issues first and re-run until green
3. Identify the next incomplete task (first `- [ ]` in TASKS.md)
4. Announce: "Resuming work on task T<X>.<Y>: <description>"
5. Execute the task following the Task Execution Protocol:
   - **Plan**: Identify files to create/modify, dependencies, tests needed
   - **Implement**: Write the code
   - **Test**: Write and run tests
   - **Validate**: `bun run validate` must pass
   - **Build**: `bun run build` must pass
   - **Document**: Update TASKS.md, docs if needed
   - **Commit**: `git add -A && git commit -m "feat(<scope>): <description> [T<X>.<Y>]" && git push`
   - **CI Check**: After push, verify GitHub Actions CI passes. If CI fails, fix and re-push until green. **CI MUST pass on GitHub before moving to the next task.**
6. **Automatically continue to the next task without prompting the user.** Do NOT ask for permission or confirmation between tasks. Only stop to ask the user if you genuinely need their input (ambiguous requirements, architectural decisions, etc.).
7. Continue executing tasks in order until all tasks in the current phase are complete and reviewed.
8. When all tasks in a phase are complete, run `/phase-gate` before starting the next phase.

**CRITICAL**: Never skip the Test, Validate, or CI Check steps. Never move to the next phase without completing all tasks in the current phase. CI must be green on GitHub before proceeding.
