# Boundary fixtures

Deliberately broken (and one clean) source files for `tools/lint/boundaries.integration.test.ts`. Each file's header names the path it is linted as (`lint-as:`) and the rule and group it must trip (`expect:`), or `expect: none`. The test lints every `.ts` file here with the repo's real ESLint config, so the boundary gates are proven to fail on a forbidden import, not just to pass on the current tree.

ESLint ignores this directory and `tsconfig.scripts.json` excludes it, so the fixtures never fail the real lint or typecheck.
