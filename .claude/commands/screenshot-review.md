# /screenshot-review — Review E2E Screenshots

1. Run the E2E tests with screenshot capture: `bun run test:e2e:screenshots`
2. List all new/changed screenshots in `docs/screenshots/`
3. For each changed screenshot, show the path and describe what it captures
4. Ask the user to confirm the screenshots look correct
5. If confirmed, commit them: `git add docs/screenshots/ && git commit -m "docs: update E2E screenshots"`
