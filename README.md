# Store Analytics Dashboard

Full-stack multi-tenant eCommerce analytics dashboard built with TypeScript, Next.js 16, NestJS 11, and PostgreSQL 16.

---

## Setup Instructions

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d

# 2. Set up and start the backend (NestJS, port 4000)
cd backend
copy .env.example .env           # Windows  (use `cp` on Mac/Linux)
npm install
npm run db:setup                  # Creates tables + seeds 25,000 events
npm run start:dev                 # → http://localhost:4000/api/v1

# 3. Set up and start the frontend (Next.js, port 3000) — open a new terminal
cd frontend
copy .env.example .env.local
npm install
npm run dev                       # → http://localhost:3000
```

### Prerequisites
- Node.js ≥ 18
- Docker (for PostgreSQL 16 container)
- npm

### Verifying it works
1. Open http://localhost:3000
2. Sign up with any email/password
3. Login → the dashboard loads with revenue cards, charts, and activity feed

---

## Architecture Decisions

### Data Aggregation Strategy
- **Decision:** Query-time aggregation using indexed PostgreSQL SQL with conditional `SUM`, `COUNT(*) FILTER`, and `COALESCE`.
- **Why:** Avoids pre-aggregation infrastructure (rollup tables, cron jobs, materialized views). The SQL is the single source of truth — transparent, auditable, and easy to extend. At ~25k events, indexed queries return in <50ms.
- **Trade-offs:**
  - *Gained:* Simple architecture, no staleness/consistency bugs, no extra infra to maintain.
  - *Sacrificed:* At very high scale (100M+ events), query-time aggregation would slow down. I'd then introduce hourly/daily materialized views with incremental refresh.

### Real-time vs. Batch Processing
- **Decision:** Hybrid — near real-time via client-side polling every 15 seconds, with no pre-computed rollups.
- **Why:** Meets dashboard freshness requirements with minimal complexity. No WebSocket server, pub/sub broker, or background workers needed.
- **Trade-offs:**
  - *Accuracy vs. Speed:* Data is at most 15s stale, which is acceptable for an analytics dashboard (not a trading platform).
  - *Complexity vs. Performance:* Polling introduces redundant requests when data hasn't changed. With more time, I'd add SSE (Server-Sent Events) for push-based updates — simpler than full WebSocket management.

### Frontend Data Fetching
- **Decision:** Client-side fetching (`"use client"`) with `Promise.all` for parallel API calls. Auth state in `localStorage`. `useMemo` for derived chart data.
- **Why:** The dashboard is inherently interactive — store switching, time window changes, auto-refresh, and logout all require client-side state. `Promise.all` fires all three analytics requests concurrently, reducing total load time from ~3× serial to ~1× (the slowest query). `cache: "no-store"` on fetch ensures polling always gets fresh data.

### Performance Optimizations

| Optimization | Why |
|---|---|
| **Composite B-tree indexes** on `(store_id, timestamp DESC)` | Index-ordered scans for recent activity — no sort step needed |
| **Partial expression index** on `(data->>'product_id') WHERE event_type = 'purchase'` | Only indexes ~20% of rows (purchases), much smaller than a full-table index |
| **SQL `FILTER` clauses** instead of app-level counting | Single table scan for all event-type counts |
| **`COALESCE`** for null-safe aggregation | No runtime errors on empty stores or time windows |
| **`Promise.all`** for parallel API calls | Concurrent fetching reduces dashboard load time |
| **`useMemo`** for chart data derivation | Prevents re-computation on unrelated state changes (e.g., pagination) |
| **Client-side pagination** (10 events/page) | Keeps the DOM small; all 20 events fetched once, paginated locally |
| **Connection pool** (`pg` Pool, configurable `max`) | Reuses DB connections across requests |

---

## Known Limitations

- **Auth is mock/demo-grade** — tokens are `storeId` strings, not signed JWTs. Upgrade path: swap the guard's string comparison with `jwt.verify()`.
- **No Redis caching** — every poll cycle re-executes SQL queries. For high traffic, I'd add a Redis cache with ~30s TTL.
- **No event ingestion API** — events are seeded via script, not live-ingested. Would need a `POST /events` endpoint with queue-based processing (e.g., BullMQ).
- **20-event limit** — recent activity fetches a fixed 20 events. Server-side pagination with cursor-based approach would scale better.
- **No unit/integration tests** — I'd add Jest specs for the guard, service SQL correctness, and DTO validation.
- **Single currency** — amounts are all USD. Multi-currency would require a `currency` field and conversion rates.

---

## What I'd Improve With More Time

1. **Redis caching** for overview and top-products queries (TTL = 30s, invalidate on new events)
2. **SSE (Server-Sent Events)** replacing polling for the activity stream — push-based, lower overhead
3. **Pre-aggregated rollup tables** (hourly/daily) for datasets beyond 1M events
4. **Date-range picker** with timezone-aware filtering instead of preset windows
5. **Server-side pagination** with cursor-based approach for recent activity
6. **Integration tests** — guard logic, SQL correctness, API contract validation
7. **Rate limiting** on auth endpoints to prevent brute-force attacks
8. **Event ingestion API** (`POST /events`) with batch support and BullMQ background processing
9. **Export to CSV/PDF** for analysts who need offline reports
10. **Predictive analytics** — trend lines and anomaly detection using simple moving averages

---

## Time Spent

Approximately 2 hours.
