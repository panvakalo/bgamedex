# Test Active Changes

Generate high-quality unit tests for all active git changes (staged, unstaged, and untracked source files).

## Philosophy

Tests are a safety net — they should catch real regressions and give confidence that the application works. Every test must justify its existence by covering behavior a user or caller depends on. If a test wouldn't catch a meaningful bug, don't write it.

## Workflow

### 1. Discover Changed Source Files

Run these commands to collect all active changes:

```bash
git diff --name-only          # unstaged changes
git diff --cached --name-only # staged changes
git ls-files --others --exclude-standard # untracked files
```

Combine all results into a deduplicated list. **Filter to only testable source files:**

- Include: `.ts`, `.vue` files under `src/`
- Exclude: `*.test.ts` (existing tests), `*.config.*`, `*.d.ts`, `package*.json`, `tsconfig*`, lock files, images, markdown, `main.ts`, `router.ts`, `style.css`, `index.ts` (entry points), type-only files (files exporting only interfaces/types with no runtime code)
- Exclude: files where changes are only to imports, comments, or formatting

### 2. Classify Each File

For each testable source file, read the file and its diff (`git diff <file>` or full content for new files) and classify:

- **Composable** (`use*.ts`): Test the hook's reactive behavior, state transitions, side effects
- **Utility/Service** (`.ts`): Test input/output contracts, error handling, edge cases
- **Vue Component** (`.vue`): Test user interactions, emitted events, rendered output, conditional rendering
- **Route handler** (`routes/*.ts`): Test request/response contracts, auth guards, error responses
- **Middleware** (`auth.ts`, etc.): Test authentication flows, token validation, error paths

### 3. Decide What to Test

For each file, analyze the **actual changes** (not the entire file) and determine:

**MUST test:**
- Public API contracts (exported functions, composable return values, component props/events)
- State transitions and side effects (reactive state changes, localStorage, API calls)
- Error handling paths (invalid input, network failures, auth failures)
- Conditional logic branches (if/else, switch, ternary)
- Data transformations (mapping, filtering, formatting)
- Security-critical code (auth, token validation, input sanitization)

**DO NOT test:**
- Type definitions or interfaces (no runtime behavior)
- Simple passthrough/wrapper functions with no logic
- Configuration objects
- Template-only changes with no behavioral impact
- Third-party library behavior (e.g., don't test that `ref()` works)
- Internal implementation details (private state, method call order)

**SKIP the file entirely if:**
- Changes are cosmetic (imports, formatting, comments only)
- The file is a pure type definition file
- The file is a thin wrapper delegating entirely to another module that already has tests
- No meaningful behavior can be asserted

It's completely valid to produce zero tests if no changes warrant testing. Say so explicitly.

### 4. Check for Existing Tests

Before writing tests, check if a `.test.ts` file already exists for the source file:

- If yes: read it, understand what's already covered, and **only add tests for new/changed behavior**. Do not duplicate existing coverage. Add new `describe` blocks or `it` cases within the existing file.
- If no: create a new co-located `.test.ts` file following established patterns.

### 5. Write Tests

Follow these rules strictly:

**Structure:**
- Use AAA pattern (Arrange → Act → Assert) — every test must have all three
- One behavior per test — the test name should describe the expected outcome
- Use descriptive `it('should ...')` names that read as specifications
- Group related tests in `describe` blocks by behavior domain
- Keep test files focused and scannable

**Quality bar:**
- Each test must assert an **observable outcome** (DOM content, return value, emitted event, state change, error thrown)
- Mock only at system boundaries (network, localStorage, timers, external APIs) — never mock the unit under test
- Use `vi.spyOn` over `vi.fn` when possible to preserve real behavior
- Restore mocks in `afterEach` to prevent test pollution
- Test edge cases: empty inputs, boundary values, error states, concurrent calls
- Test the sad path — error handling is where most bugs hide

**What makes a test valuable:**
- It would fail if the behavior it describes broke
- It tests something a user or API consumer depends on
- It covers a code path that could regress independently
- It documents non-obvious behavior through its assertions

**What makes a test worthless:**
- It only verifies a mock was called (tautological)
- It passes even if the implementation is completely wrong
- It duplicates another test with different variable names
- It tests framework internals (Vue reactivity, Express routing)

**Patterns to follow (from this codebase):**

Backend middleware/function:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('functionName', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('should return expected output for valid input', () => {
    const result = functionName(validInput)
    expect(result).toEqual(expectedOutput)
  })

  it('should throw/return error for invalid input', () => {
    expect(() => functionName(invalidInput)).toThrow('message')
  })
})
```

Frontend composable:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useComposable', () => {
  beforeEach(() => { /* setup */ })
  afterEach(() => { vi.restoreAllMocks() })

  it('should update state when action is called', () => {
    const { state, action } = useComposable()
    action(input)
    expect(state.value).toBe(expectedValue)
  })
})
```

Vue component:
```typescript
import { mount } from '@vue/test-utils'
import Component from './Component.vue'

describe('Component', () => {
  it('should render content based on props', () => {
    const wrapper = mount(Component, { props: { title: 'Test' } })
    expect(wrapper.text()).toContain('Test')
  })

  it('should emit event on user interaction', async () => {
    const wrapper = mount(Component)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('eventName')).toHaveLength(1)
  })
})
```

### 6. Validate

After writing all tests, run the test suite to ensure everything passes:

```bash
# Run only the new/modified test files
cd frontend && npx vitest run --reporter=verbose <test-files>
cd backend && npx vitest run --reporter=verbose <test-files>
```

If tests fail, fix them. Tests must pass before finishing.

### 7. Report

Summarize what was done:

- List each source file analyzed
- For each: what tests were written and why, or why the file was skipped
- Total: X tests written across Y files, Z files skipped (with reasons)

$ARGUMENTS
