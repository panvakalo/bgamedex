Strip out every comment that just explains WHAT the code does — keep only comments that explain WHY.
Only assess files from the current changed files.

Specifically:

- Remove obvious JSDoc (simple functions with clear names)
- Remove line-by-line explanations (e.g., "// Add header" before header code)
- Remove comments repeating what the code already says
- Keep comments about business logic, edge cases, workarounds, or non-obvious decisions
- Keep comments explaining performance trade-offs or architectural choices
- Keep comments that help new developers understand domain context

If a comment seems necessary to explain WHAT, refactor the code instead (better names, extract functions).
