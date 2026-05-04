# Pre-launch Security Audit & Remediation Plan

**Audit date:** 2026-05-04
**Branch:** main @ 36a8945
**Scope:** entire repo (Express/SQLite backend, Vue 3 frontend, Fly.io deploy)

This document is the launch-blocking punch list derived from the security audit. Items are grouped by phase. Each has a concrete file/line reference and an acceptance check.

---

## Phase 1 — Launch blockers (do before going commercial)

### 1.1 Cap PDF upload size — HIGH

**Where:** `backend/src/routes/chat.ts:35-44`
**Risk:** `multer({ storage: memoryStorage() })` has no `limits.fileSize`. A single authenticated user with `rules_access` can POST a multi-GB PDF; the entire file is buffered in memory before any size check, OOM-ing the 1GB Fly VM.
**Fix:**
```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: ...,
})
```
Also wrap `upload.single('pdf')` to translate Multer's `LIMIT_FILE_SIZE` into a 413 response (the existing wrapper at `chat.ts:160-167` already forwards errors as 400 — switch to 413 for size errors).
**Acceptance:** posting a 30MB PDF returns 413 within milliseconds (no memory spike).

### 1.2 Move `/identify-from-photo` behind `expensiveLimiter` — HIGH

**Where:** `backend/src/index.ts:150-151`, route in `backend/src/routes/games.ts:36-72`
**Risk:** the photo-identify endpoint makes a paid OpenAI gpt-4o-mini Vision call per request but is only protected by the global 300 req / 15 min limiter. Cost amplification.
**Fix:** either split `identify-from-photo` into its own router mounted with `expensiveLimiter`, or add a per-route limiter inline:
```ts
const photoLimiter = rateLimit({ windowMs: 60_000, max: 5, ... })
router.post('/identify-from-photo', photoLimiter, upload.single('photo'), ...)
```
**Acceptance:** the 6th call within 60s from one IP returns 429.

### 1.3 Bump runtime-critical vulnerable dependencies — HIGH

**Where:** `backend/package.json`, `frontend/package.json`
**Required bumps (all have GHSA advisories, all fix-available):**
| Package | Current | Bump to | Reason |
|---|---|---|---|
| `multer` | ^2.0.2 | ≥ 2.1.1 | 3× DoS advisories (incomplete cleanup, resource exhaustion, uncontrolled recursion) |
| `express-rate-limit` | ^8.2.1 | ≥ 8.2.2 | IPv4-mapped IPv6 bypasses per-client limits on dual-stack servers |
| `dompurify` (frontend) | current ≤ 3.3.3 | latest | Multiple sanitizer-bypass advisories — runtime XSS guard for chat |
| `vite` (frontend) | < 6.4.2 | ≥ 6.4.2 | Path traversal + WS file read |
| `postcss` (transitive) | < 8.5.10 | latest | XSS via unescaped `</style>` |

For `path-to-regexp < 0.1.13` (transitive via Express 4): add `"overrides": { "path-to-regexp": "^0.1.13" }` to `backend/package.json` rather than bumping to Express 5 pre-launch.

**Procedure:**
```bash
cd backend && npm audit fix && npm test
cd ../frontend && npm audit fix && npm test
```
If `npm audit fix` declines (semver-major), pin manually in package.json and re-test.

**Acceptance:** `npm audit` reports 0 high/critical in both workspaces.

### 1.4 Fix broken admin user delete — HIGH (correctness, blocks GDPR delete)

**Where:** `backend/src/routes/admin/users.ts:182-205`
**Bug:** the cascade transaction references `game_prices.game_id` and `rules_chunks.game_id`, but both tables key on `bgg_id` (`backend/src/database.ts:117-124, 161-169`). Transaction throws → user delete fails today.
**Fix:** delete those two lines (the rows are shared cache entries, not per-user data). Per-user rows already covered by the `uploaded_rules` / `rules_history` deletes above.
**Acceptance:** admin can delete a test user end-to-end; `users.id` no longer exists, transaction commits.

### 1.5 Run container as non-root — MEDIUM (defense in depth)

**Where:** `Dockerfile` — no `USER` directive
**Fix:**
```dockerfile
RUN useradd -r -u 10001 -g root nodeuser && \
    mkdir -p /data && chown -R nodeuser:root /app /data
USER nodeuser
```
Verify Fly's `/data` volume mount works for UID 10001 — if it doesn't, add `chown` to an entrypoint shim that runs before dropping privileges.
**Acceptance:** `fly ssh console` → `whoami` returns `nodeuser`. App still boots and writes to `/data/bgamedex.db`.

### 1.6 Tighten CSP — MEDIUM

**Where:** `backend/src/index.ts:48-62`
**Issue:** `scriptSrc: ["'self'", "'unsafe-inline'"]` defeats most CSP guarantees against XSS.
**Fix (preferred):** generate a per-response nonce and emit it on Vite's bootstrap script + helmet directives.
```ts
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64')
  next()
})
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...,
      scriptSrc: ["'self'", (_req, res) => `'nonce-${(res as any).locals.cspNonce}'`],
    }
  }
}))
```
Then inject the nonce into the served `index.html`. If that's too involved before launch, **at minimum add `'strict-dynamic'`** to `scriptSrc` so attacker-injected `<script>` tags still need the nonce. Leave `styleSrc` `'unsafe-inline'` for now (Tailwind v4 needs it).
**Acceptance:** browser DevTools → CSP violation report when a synthetic inline `<script>alert(1)</script>` is injected; legitimate app still loads.

---

## Phase 2 — Hardening (do within 2 weeks of launch)

### 2.1 Stop logging user-supplied chat content

**Where:** `backend/src/routes/chat.ts:138`, `backend/src/rules-chunker.ts:27, 48, 95`
**Fix:** remove or hash query strings and validation responses before logging. Replace with structured fields like `{ event: 'rules_validation', gameTitle, valid }`.
**Reason:** Fly logs persist for 30 days and may be shared with support staff — user chat content shouldn't leave the request.

### 2.2 Add per-user SSE connection cap

**Where:** `backend/src/sse.ts:8-25`
**Fix:** limit `clients.get(userId)?.length` to ~5; close the oldest when exceeded. Add a 30s heartbeat (already present at `index.ts:169-171` ✅) but also a max-age timeout (e.g. 4h) to prevent zombie connections.

### 2.3 Migrate off `pdf-parse@1.1.1`

**Where:** `backend/src/pdf-extract.ts`
**Reason:** unmaintained npm package; ships an old `pdfjs-dist`; quirky import-time filesystem access.
**Action:** swap to `pdf-parse-fork` or `unpdf`. Smoke-test against a few real BGG rulebooks.

### 2.4 Build TS → JS in Docker; drop `tsx` from runtime

**Where:** `Dockerfile:17, 30`
**Reason:** smaller image, smaller attack surface, faster cold starts.
**Action:** add a `tsc` build step in the backend stage; ship `dist/` + `node_modules` only. Remove the global `tsx` install.

### 2.5 Tighten avatar magic-byte check

**Where:** `backend/src/routes/auth.ts:436-447`
**Issue:** WebP signature only checks `RIFF` (also matches AVI/WAV). Not exploitable as-is (rendered via `<img>`) but trivial to harden.
**Fix:** for the WebP entry, also verify bytes 8–11 are `WEBP`.

### 2.6 Add request body schema validation at boundary

**Where:** all `routes/*.ts` POST/PATCH/PUT handlers
**Today:** validation is hand-rolled and inconsistent.
**Recommendation:** add `zod` (or `valibot`) and validate `req.body` once per route. Reduces the chance of a future regression introducing bad input handling.

---

## Phase 3 — Operational / scale (do before 2nd Fly machine)

### 3.1 Move OAuth state, auth codes, rate-limit store to Redis

**Where:** `routes/auth.ts:14-15`, `routes/admin/auth.ts:12-13`, `routes/chat.ts:18`, default `express-rate-limit` store
**Reason:** all in-memory. Two Fly machines = silent rate-limit bypass + broken OAuth handoffs.
**Action:** introduce `ioredis` + `rate-limit-redis`. Use Fly Upstash add-on or self-hosted.

### 3.2 Add Fly health check + alerting

**Where:** `fly.toml`, `/api/health` already exists at `index.ts:44-46`
**Action:** wire a Fly `[checks]` block to hit `/api/health` every 10s; add Slack or email alerts on failure.

### 3.3 Document log retention & PII policy

If we want SOC2-/GDPR-aligned commitments, write a one-pager explaining: what's logged, retention period, who can access logs, how to request deletion.

---

## Out of scope / deferred

| Item | Why deferred |
|---|---|
| Migrate Express 4 → 5 | Breaking; ReDoS in `path-to-regexp` is mitigated by `npm overrides` at the version level (1.3) |
| Bump `resend` to v6 (breaking) | Only affects internal webhook signing via `svix → uuid`; not user-facing |
| Two-factor auth on admin | Single-admin app for now; revisit when there are ≥3 admins |
| Move avatar from data-URL to object storage | Performance, not security; revisit at >1k users |
| Friends search rate limit | Currently bounded by global 300/15min; explicit limit nice but not load-bearing |

---

## Verification checklist (run before flipping the launch flag)

- [ ] `npm audit` returns 0 high/critical in both workspaces
- [ ] Manual test: 30MB PDF upload → 413
- [ ] Manual test: 6 photo-identify calls in 60s from one IP → 429
- [ ] Manual test: admin deletes a test user end-to-end (no errors)
- [ ] `fly ssh console` → `whoami` ≠ root
- [ ] CSP violation visible in DevTools when synthetic `<script>` injected
- [ ] No user-supplied text in `fly logs` for 5 minutes of production-like load
- [ ] Smoke test: full auth flow (Google OAuth, email register, password reset) on staging
