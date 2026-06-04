# Scale Plan — From One Machine to Many

**Status:** planning
**Trigger:** "hundreds of simultaneous users" / before adding a 2nd Fly machine
**Prereq context:** see `AUDIT.md §3.1–3.2` (this doc expands those items)

The app currently runs on **one Fly machine** with **SQLite on one volume** and **all coordination state in process memory**. That topology is correct and cheap for a single machine, but it is a hard ceiling: you cannot add a second machine safely until the items below are done. This doc is the migration plan to break that ceiling.

---

## Why a 2nd machine is unsafe today

Two independent failures, both silent (no error, just wrong behavior):

| State | Where | What breaks with 2 machines |
|---|---|---|
| Rate-limit counters | `express-rate-limit` default MemoryStore (`index.ts` `globalLimiter`, `authLimiter`, `expensiveLimiter`, `adminAuthLimiter`); plus the hand-rolled upload counter `chat.ts:18` `uploadCounts` | Each machine counts independently → effective limit is **N×** the intended cap. A 10/min AI limiter becomes 20/min with 2 machines. Cost + abuse protection silently halves. |
| OAuth state / auth codes | `auth.ts:14-15` (`oauthStates`, `authCodes`), `admin/auth.ts:12-13` | OAuth callback / code-exchange may land on a **different machine** than the one that issued the state. Login fails intermittently (~50% with 2 machines). |
| SSE client registry | `sse.ts` `clients` Map | An event published on machine A never reaches a user connected to machine B. Real-time notifications become unreliable. |
| Database | `better-sqlite3` on the `playdex_data` volume | A Fly volume attaches to **one** machine. A 2nd machine has no DB, or (worse, if you fork the volume) a divergent copy → split-brain. |

**Conclusion:** two prerequisites — (A) shared coordination store (Redis), (B) shared/replicated database — must both land before scaling out.

---

## Part A — Move coordination state to Redis

**Goal:** rate limits, OAuth state, auth codes, and upload counters become shared across machines.

**Add:** [Upstash Redis](https://fly.io/docs/reference/redis/) via `fly redis create` (managed, regional, TLS). Set `REDIS_URL` as a Fly secret.

**Dependencies:**
```bash
cd backend && npm i ioredis rate-limit-redis
```

### A1. Shared rate-limit store
Replace the default MemoryStore on all four limiters in `index.ts`:
```ts
import { RedisStore } from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!, { tls: {} })
const store = (prefix: string) => new RedisStore({
  prefix,
  sendCommand: (...args: string[]) => redis.call(...args),
})

const globalLimiter = rateLimit({ windowMs: 15*60_000, max: 300, store: store('rl:global:'), ... })
// repeat for authLimiter, expensiveLimiter, adminAuthLimiter, photoIdentifyLimiter (games.ts)
```
Keep a fallback: if `REDIS_URL` is unset (local dev, single machine), default back to MemoryStore so dev isn't forced onto Redis.

### A2. Upload counter → Redis
`chat.ts:18` `uploadCounts` Map → Redis `INCR` + `EXPIRE`:
```ts
// key: upload:<userId>, INCR then EXPIRE 3600 on first hit; reject when > UPLOAD_RATE_LIMIT
```

### A3. OAuth state + auth codes → Redis
`auth.ts` and `admin/auth.ts`: replace the two Maps with short-TTL Redis keys.
- `oauth:state:<state>` → `userId`, `EX 600` (10 min)
- `authcode:<code>` → `jwt`, `EX 60` (codes are single-use, short-lived)
- On consume: `GETDEL` (atomic read-and-delete) so a code can't be replayed across machines.
- Delete the `evictOldest` helpers — TTLs replace manual eviction.

### A4. SSE across machines (only if you need cross-machine realtime)
Two options:
- **Simplest:** Fly Redis Pub/Sub. Each machine subscribes to a `sse` channel; `sendEvent` publishes `{userId, event}`; every machine relays to its locally-connected clients. ~30 lines in `sse.ts`.
- **Defer:** if notifications can tolerate "delivered only if user is on the same machine," skip this for the first multi-machine step and add pub/sub later. (Acceptable short-term; not for production-quality realtime.)

**Acceptance (Part A):**
- Hammer an AI endpoint from one IP across 2 machines → 429 at the *combined* configured limit, not 2×.
- Google login succeeds 20/20 times with 2 machines behind the LB.
- Restarting one machine does not reset another's rate-limit counters.

---

## Part B — Database that survives multiple machines

Two viable paths. **Recommendation: start with LiteFS** (keeps SQLite, minimal code change), migrate to Postgres only if write contention becomes the bottleneck.

### Option B1 — LiteFS (recommended first step)
SQLite replication for Fly. One **primary** (read+write), N **replicas** (read-only, auto-forward writes to primary).

| Pros | Cons |
|---|---|
| Keep `better-sqlite3` and all existing SQL — near-zero app changes | Single writer (still); writes forwarded to primary |
| Reads scale horizontally across replicas | Brief write unavailability during primary failover |
| Cheap, no separate DB server | FTS5 + triggers replicate fine, but test the `rules_chunks_fts` virtual table under replication |

**Work:** add LiteFS config + the FUSE mount to the Dockerfile, point `DB_PATH` at the LiteFS mount, designate primary via Fly. App code largely unchanged. The synchronous-write-blocks-event-loop characteristic remains — mitigated by reads going to replicas.

### Option B2 — Fly Postgres (if writes become the wall)
Migrate schema + queries to Postgres.

| Pros | Cons |
|---|---|
| True concurrent writes; no single-writer ceiling | Rewrite all `better-sqlite3` calls (sync → async `pg`); biggest code change in this plan |
| Mature connection pooling, backups, metrics | Must port FTS5 → Postgres `tsvector`/`pg_trgm`; re-test RAG keyword fallback |
| Standard horizontal read replicas | Operational cost of a managed PG |

**Embeddings note:** `rules_chunks.embedding` is JSON in a TEXT column today and cosine similarity runs in JS (`embeddings.ts`). On Postgres, consider `pgvector` to push similarity into the DB. On LiteFS it stays as-is (fine at current scale).

**Acceptance (Part B):**
- 2+ machines serve reads from the DB simultaneously; data is consistent.
- A write on the primary is visible on a replica within the expected lag window.
- Full RAG path (embedding search **and** FTS5 fallback) returns correct chunks post-migration.
- Admin user-delete cascade (`admin/users.ts`) still commits.

---

## Recommended sequence

1. **Launch tier (done):** `min_machines=1`, auto-stop off, 2GB/2CPU, health checks. → handles tens–low-hundreds of concurrent light users on one box.
2. **Part A (Redis):** ~1 day. Removes the coordination-state blocker. *Still one machine* but now safe to add more.
3. **Part B1 (LiteFS):** ~1–2 days. Now you can run **N machines**, reads scale out.
4. **Scale out:** raise `min_machines_running`, re-enable `auto_stop_machines='stop'` with a sensible floor, add regions if users are global.
5. **Part B2 (Postgres):** only if write throughput on the single LiteFS primary becomes the measured bottleneck. Don't pre-optimize into this.

## Observability to add alongside
- Fly metrics dashboard + alert on the `/api/health` check (config landed in `fly.toml`).
- Track event-loop lag (synchronous SQLite is the thing to watch); log slow queries.
- OpenAI spend alert (cost is low today — see audit — but a usage anomaly should page someone).
