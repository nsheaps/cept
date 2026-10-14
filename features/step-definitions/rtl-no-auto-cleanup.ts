// Steps of one scenario run as separate tests, so Testing Library must not unmount the
// editor between them (each step file cleans up in AfterEachScenario instead). RTL reads
// this flag when it first loads, so it is set here, before any test file imports it.
process.env.RTL_SKIP_AUTO_CLEANUP = 'true';
