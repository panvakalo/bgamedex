Remove any tests that are low-value.
Only assess files that end with .test.ts. from the current changed files.

Remove a test if it’s:

- Shallow: asserts implementation details (state/private methods/instances) instead of user-observable output (DOM text, roles, accessibility).
- Tautological: only checks a mock was called (e.g., `toHaveBeenCalled`) without asserting an observable outcome/side effect.
- Snapshot-only: snapshot is the only meaningful assertion.
- Over-mocked: mocks most children/hooks/utils so little real behavior is exercised.
- Duplicate: overlaps another test’s behavior with no additional risk/coverage.

Be critical about it. It's also possible that nothing has to be removed.
If not sure, just report your reasoning.
