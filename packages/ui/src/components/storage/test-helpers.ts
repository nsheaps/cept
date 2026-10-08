/**
 * Shared test helpers for storage-related tests.
 *
 * The in-memory backend is the real `MemoryBackend` from @cept/core (verified by
 * the storage conformance suite); it also offers the synchronous seed/inspect
 * helpers (`seedText`, `seedFile`, `readText`, `hasFile`) these tests use.
 */

export { MemoryBackend } from '@cept/core';
