---
name: review-pr
description: Review the current HALO branch for bugs, reuse, Vue patterns, i18n, tests, and project-convention violations before opening a PR.
argument-hint: "[base-branch]"
disable-model-invocation: true
---

# PR Reviewer

Review the current branch's changes against the base branch (default: main) for code quality, potential bugs, best practices, and reusability.

## Instructions

1. First, get the diff of the current branch against the base branch:
   - Run `git diff origin/main...HEAD` to see all changes
   - Run `git log origin/main..HEAD --oneline` to see commit history

2. Read the project documentation to understand coding guidelines:
   - Read `CLAUDE.md` for project-specific coding standards and patterns
   - Check for feature-specific READMEs in relevant component directories (e.g., `src/components/tools/editor/README.md`)

3. Search the codebase for existing patterns that could be reused:
   - Check `src/components/atoms/` and `src/components/` for reusable components
   - Check `src/composables/` for shared composables
   - Check `src/stores/` for existing stores
   - Check `src/services/` for API services
   - Check `src/utils/` for utility functions

4. Analyze the changes against the documentation guidelines and the following categories:

---

### Reusability & DRY Principles (HIGH PRIORITY)

**Before creating anything new, verify it doesn't already exist:**

- Is there an existing component that does the same or similar thing?
- Is there a composable that provides this functionality?
- Is there a utility function that handles this logic?
- Is there a store that manages this state?
- Can an existing component be extended rather than creating a new one?

**Flag violations:**

- Creating new components when similar ones exist (e.g., creating a new button instead of using `BaseButton`)
- Duplicating logic that exists in a composable (e.g., `useNotify`, `useAnalyticsColors`)
- Creating local state when a store already manages it
- Writing utility functions that already exist in `src/utils/`
- Copy-pasting code from other files instead of extracting shared functionality

**Suggest consolidation:**

- If similar code exists in multiple places, suggest extracting to a shared location
- If a pattern is used 3+ times, it should be a component/composable/utility

---

### Code Quality

- Unused imports or variables
- Code duplication within the PR and across the codebase
- Overly complex functions (consider splitting)
- Missing error handling
- Inconsistent naming conventions
- Functions doing too many things (single responsibility)

---

### Vue/Frontend Best Practices

**Component Design:**

- Components should be small and focused
- Props should be properly typed with interfaces
- Use `defineEmits` with proper typing
- Always prefer composition API over options API
- Use `computed` for derived state, not methods

**Reactivity:**

- Missing `key` attributes in v-for loops
- Reactive state mutations outside proper channels
- Using `ref` when `computed` is more appropriate
- Watching too many dependencies unnecessarily

**Lifecycle:**

- Missing cleanup in `onBeforeUnmount` (event listeners, intervals, subscriptions)
- Side effects in setup that should be in `onMounted`

**Performance:**

- Unnecessary re-renders
- Missing computed caching
- Large components that should be split
- Not using `v-once` for static content
- Not using `v-memo` for expensive list items

---

### TypeScript Best Practices

- Use proper types, avoid `any`
- Define interfaces for props, emits, and complex objects
- Use type guards for narrowing
- Export types that are used across files
- Use `as const` for literal types

---

### Styling & CSS

- Use Tailwind classes with `tw-` prefix for most styling
- Avoid chaining too many Tailwind classes (if >8-10 classes, consider alternatives)
- Use scoped SCSS (`<style scoped lang="scss">`) for complex styling that's difficult with Tailwind
- Avoid inline styles
- Use CSS variables for theming (dark mode support)
- Check responsive design breakpoints
- Use existing spacing/color conventions

---

### Accessibility

- Missing keyboard navigation
- Color contrast issues
- Missing focus states
- Images without alt text

---

### Security

- XSS vulnerabilities (v-html with user content)
- Sensitive data in logs or error messages
- Hardcoded credentials or API keys
- User input not sanitized

---

### Internationalization

- All user-facing text must use `$t()` or `t()` translations
- Check `src/locales/en-gb.json` for existing translation keys
- Use pluralization where appropriate (`$t('KEY', count)`)

---

### Testing

- Are new features covered by tests?
- Are edge cases tested?
- Do tests follow existing patterns in the codebase?

---

### File Organization

- Is the file in the correct directory?
- Does the file naming follow conventions?
- Are related files grouped together?
- Should this be split into multiple files?

---

### Documentation Compliance

Verify the changes follow guidelines from project documentation:

**From CLAUDE.md:**

- Services use factory pattern with `{ accountId }` parameter
- Types use camelCase (axios handles API snake_case conversion)
- Stores use Composition API with `ref()`, `computed()`, async actions
- Components follow `<script setup>` → `<template>` → `<style scoped>` order
- Tailwind classes use `tw-` prefix
- Comments are minimal and meaningful (no redundant JSDoc)
- Files target ~300-400 lines (split if larger)

**General patterns:**

- New features should follow the "Adding Features" checklist in CLAUDE.md
- Check if feature-specific README exists and is being followed

---

5. **Thoroughly analyze before responding:**
   - Take time to reason through each file and change carefully
   - Cross-reference changes against the documentation guidelines you read
   - For each new component/function, actively search for existing alternatives
   - Consider the broader impact of changes on the codebase
   - Think through edge cases and potential issues
   - Do not rush to conclusions - thorough analysis is more valuable than speed

6. After completing your analysis, provide your review in this format:

```
## PR Review Summary

**Files Changed:** [number]
**Commits:** [number]
**Risk Level:** [Low/Medium/High]

### Documentation Violations 📋
[List any violations of CLAUDE.md or feature-specific README guidelines]
[Reference the specific guideline being violated]

### Reusability Issues 🔄
[List cases where existing functionality should be used instead of new code]
[Suggest specific components/composables/utils that already exist]

### Critical Issues 🔴
[List any blocking issues that must be fixed]

### Warnings ⚠️
[List non-blocking issues that should be addressed]

### Suggestions 💡
[List optional improvements]

### What Looks Good ✅
[Highlight positive aspects: good reuse of existing code, clean patterns, etc.]

### File-by-File Notes
[Detailed notes for specific files if needed, including line numbers]
```

$ARGUMENTS
