# CLAUDE.md

Guidance for AI Coding Agents working with this repository.

## Code Patterns

### Type Definitions

Always use **camelCase** for TypeScript interfaces (axios handles API conversion):

```typescript
interface AgentDto {
  id: number;
  profileId: number; // camelCase, not profile_id
  createdAt: string;
  isActive: boolean;
}
```

### Stores

Pinia stores use Composition API:

```typescript
export const useExampleStore = defineStore(
  "ExampleStore",
  () => {
    const items = ref<Item[]>([]);
    const loading = ref(false);

    const fetchItems = async () => {
      loading.value = true;
      items.value = await getService().getItems();
      loading.value = false;
    };

    return { items, loading, fetchItems };
  },
  { persist: { pick: ["items"] } },
);
```

- State in `ref()`, derived in `computed()`, actions are async functions
- Persist specific fields with `{ persist: { pick: [...] } }`

### Component Structure

Vue SFCs: `<script setup>` → `<template>` → `<style scoped>`

```vue
<script setup lang="ts">
interface Props {
  title: string;
  disabled?: boolean;
}
const props = withDefaults(defineProps<Props>(), { disabled: false });
const emit = defineEmits<{ (e: "submit", value: string): void }>();
</script>

<template>
  <div class="flex items-center gap-2">
    <SubHeader>{{ props.title }}</SubHeader>
    <BaseButton :disabled="props.disabled" @click="emit('submit', 'value')" />
  </div>
</template>
```

### Styling

1. **Tailwind CSS** - Standard utility classes (no prefix)

   ```html
   <div class="flex items-center gap-4 p-2"></div>
   ```

2. **SCSS** - Only for complex styling not achievable with Tailwind

## Code Standards

### Comments

Comments are context budget—AI agents read every token. Make them count.

**KEEP:** Business reasoning, architectural decisions, edge cases, complex algorithms
**AVOID:** Line-by-line explanations, redundant JSDoc, type repetition, empty TODOs

A short, accurate comment in the right place guides better than verbose documentation. JSDoc only for complex pure functions with non-obvious behavior.

### Imports

ESLint enforces order: builtins → external → internal (`@/...`) → relative
Alphabetized within groups, newlines between groups.

### File Organization

Keep files small and focused—large files are an architectural smell.

- **Target:** ~300-400 lines per file (soft limit, not dogma)
- **Split by responsibility:** One clear purpose per module
- **Refactoring pattern:** When extracting from large files, keep the old file as a stable shell that delegates to new code (reduces blast radius)
- **Signs of trouble:** God objects, mega components, files requiring frequent scrolling

## Testing

Tests are signal—AI agents treat them as truth. Bloated test files dilute that signal.

### Unit Tests (Vitest)

**DO:**

- Test user-observable behavior (DOM, emitted events, store state)
- Use meaningful assertions verifying actual outcomes
- Mock at service boundaries, not implementation details
- Keep test files focused (~1 describe per behavior domain)
- Write a characterization test before major refactors (locks current behavior)

**Structure:** Follow **AAA** (Arrange–Act–Assert) for scannable tests. Follow **FIRST** (Fast, Independent, Repeatable, Self-validating, Timely)—kill flakiness aggressively.

**DO NOT:**

- Test implementation details (internal state, method calls)
- Write tautological tests (mock → expect called)
- Over-mock everything (provides no confidence)
- Write snapshot-only tests without behavioral assertions
- Create mega test files with hundreds of repetitive cases

```typescript
// Good: Tests behavior
it("should emit addTool event when tool selected", async () => {
  const wrapper = mount(AttachToolsField, { props });
  await wrapper.find('[data-testid="add-tool"]').trigger("click");
  expect(wrapper.emitted("addTool")?.[0]).toEqual([5]);
});
```

### Test File Organization

- Co-locate tests with source: `Component.vue` → `Component.test.ts`
- Split large test suites by behavior domain, not arbitrary groupings
- Prefer fewer meaningful tests over exhaustive shallow coverage

## Feature Documentation

Large features have their own README.md (e.g., `src/components/tools/editor/README.md`). Check feature directories before working on complex areas.

## AI Agent Guidelines

Be a collaborative partner, not a code vending machine. Question requirements before executing—the user's first approach may not be optimal. Surface trade-offs and alternatives. When something seems off, push back constructively rather than blindly implementing. Assume good intent but verify assumptions.

### Git Operations

**🚨 ABSOLUTE RULE - NO EXCEPTIONS:**

**NEVER run `git commit` or `git push` automatically.** Completing a task, running tests, or fixing code does NOT imply permission to commit.

- **NEVER** run `git commit` unless the user explicitly says "commit" or uses `/conv-commit`
- **NEVER** run `git push` without explicit permission
- **ALWAYS** stop after making changes and running tests - ask the user what to do next
- **DO** make code changes, run tests, and show results
- **DO** wait for user to decide when to commit/push

**Valid triggers for committing:**

- User says "commit this" or "commit these changes"
- User uses the `/conv-commit` command
- User explicitly asks you to commit

**NOT valid triggers:**

- Task completion
- All tests passing
- Code review complete
- Any implicit assumption that work should be committed

### Development Guidelines

- **Discover context** - Read files before modifying; don't hallucinate
- **Check for READMEs** - Look for feature-specific docs in component directories
- **Respect patterns** - Follow existing service, store, component patterns
- **Minimal changes** - Only change what's requested; avoid over-engineering
- **No premature abstraction** - Three similar lines > unnecessary helper
- **Security first** - Validate inputs at system boundaries
- **Test behavior** - Verify outcomes, not implementation

## RTK

**Always prefix shell commands with `rtk`** — token-optimized proxy (60-90% savings). Safe passthrough: if no filter exists, command runs unchanged. In chains, prefix each: `rtk git add . && rtk git commit -m "msg"`.

Covers: `git`, `gh`, `npm`, `npx`, `vitest`, `tsc`, `lint`, `ls`, `grep`, `find`, `docker`, `kubectl`, `curl`. Run `rtk gain` for savings stats.
