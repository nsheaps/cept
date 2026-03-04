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
   - **Document**: Update TASKS.md, docs if needed
   - **Commit**: `git add -A && git commit -m "feat(<scope>): <description> [T<X>.<Y>]" && git push`
6. After completing the task, check if there is time/context remaining for the next task
7. If yes, continue to next task. If no, print a summary of what was done and what's next.

**CRITICAL**: Never skip the Test or Validate steps. Never move to the next phase without completing all tasks in the current phase.
