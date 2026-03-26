# Conventional Commit

Analyze staged changes and create conventional commits with well-structured messages following team best practices.

## Workflow

### 1. Analyze Staged Changes

Run `git diff --staged` to examine what's being committed:

```bash
git diff --staged
```

If nothing is staged, inform the user and exit. If files are staged, proceed to message crafting.

### 2. Determine Commit Type

Based on the changes, select the appropriate type:

- **feat**: New features or enhancements to existing functionality
- **fix**: Bug fixes, corrections, or issue resolutions
- **chore**: Maintenance tasks, dependency updates, test fixes, configuration changes

### 3. Identify Scope

Extract scope from changed file paths:

- Multiple unrelated files → use broader scope or most impacted area
- Single focused component → use specific scope

Keep scopes lowercase, concise (1-2 words), and consistent with existing commit history.

### 4. Craft Summary Line

Format: `<type>(<scope>): <summary>`

**Summary requirements:**

- Start with lowercase
- Under 72 characters total
- Use imperative mood: "add" not "added"
- Focus on user-facing outcome, not implementation
- Be specific: "improve agent step panel layout" > "UI improvements"

**Examples:**

- `feat(tools): add context-aware toolbar positioning`
- `fix(tool-editor): improve agent step panel layout`
- `chore: test fix`

### 5. (Optional) Write Bullet Point Body

Only use bullet points if the changes are significant and avoid bloating the body.
Each bullet should explain **what changed**, **how it works**, and **why it matters**:

```
- Remove fixed max-height constraint from agent step prompt editor
- Add sensible min-height (128px) that grows with content
- Enable panel-level scrolling for step tabs
- Disable 'large' prop for agent steps to prevent 100vh height
```

**Body guidelines:**

- Each bullet is a standalone fact
- Include technical specifics (values, classnames, prop names)
- Use arrow notation for renames: `Parameters → Inputs`
- Group related changes logically
- Omit obvious implementation details
- Focus on changes reviewers can verify
- Make sure bullet points are scannable, no more than 2-3
- If more than 2-3 bullet points are needed, suggest atomic commit splitting

### 6. Execute Commit

Use heredoc format for proper multi-line handling:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <summary>

- Bullet point 1
- Bullet point 2
- Bullet point 3

Refs: HALO-123
EOF
)"
```

**Important:**

- Always use heredoc (`<<'EOF'`) for multi-line messages
- Include the Claude Code attribution footer
- Do NOT include thread IDs or amp references
- Verify commit succeeded with `git log -1 --oneline`

## Commit Message Examples

### Feature with multiple changes

```
feat(tools): improve parameters/variables UX with inline descriptions

- Add inline description text below Parameters, Variables, Undefined Variables headers
- Remove info icon tooltips (descriptions now visible by default)

Refs: HALO-123
```

### Fix

```
fix(tools): only auto-scroll to node if not already visible

Refs: HALO-456
```

### Rename/refactor

```
feat(tools): rename parameters/variables to friendlier terminology

- Parameters → Inputs
- Variables → Tool Variables

Refs: HALO-789
```

### No ticket detected (no HALO-{N} in branch name)

```
chore: test fix
```

## Edge Cases

**Multiple scopes affected:** Use the primary/most impacted scope, or use a broader scope like `tools` instead of `tool-editor`.

**Very small changes:** Don't use bullet list

```
fix(tools): remove default padding from tool name input for alignment
```

**Massive refactor:** Consider if the commit is too large and and suggest splitting it into atomic commits first.

**Unclear type:** Default to `chore` for maintenance/cleanup, `fix` for corrections, `feat` for any new capability.
