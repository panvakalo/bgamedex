# Ship

Run all checks, commit, push, and deploy to production.

## Instructions

Execute these steps in order. Stop immediately if any step fails.

### 1. Run all tests

```bash
cd /Users/panos.vakalopoulos/workspace/panos/playdex && rtk npm test
```

This runs both frontend and backend tests.

### 2. TypeScript check

```bash
cd /Users/panos.vakalopoulos/workspace/panos/playdex/frontend && ./node_modules/.bin/vue-tsc -b --noEmit
```

### 3. Build frontend

```bash
cd /Users/panos.vakalopoulos/workspace/panos/playdex/frontend && ./node_modules/.bin/vite build
```

### 4. Commit

Run `/git-commit` to stage and commit changes with a conventional commit message.

### 5. Push

```bash
cd /Users/panos.vakalopoulos/workspace/panos/playdex && rtk git push
```

### 6. Deploy

```bash
cd /Users/panos.vakalopoulos/workspace/panos/playdex && fly deploy
```

Wait for the deploy to complete and confirm it succeeded.

## Failure Handling

- If tests fail: fix the failures and re-run, or stop and report.
- If TypeScript or build fails: fix the errors and re-run, or stop and report.
- If deploy fails: report the error and do NOT retry automatically.

$ARGUMENTS
