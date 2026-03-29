-- =============================================================================
-- Amboras Analytics - Database Schema
-- =============================================================================
-- Design decisions documented below for each table and index.

-- Users table: supports email/password authentication for the dashboard.
-- UUIDs as primary keys prevent enumeration attacks and are safe for distributed inserts.
-- Email has a UNIQUE constraint as a secondary safety net (app also checks before INSERT).
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  name TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events table: the core analytics data store.
-- Design decisions:
--   - event_type uses a CHECK constraint to enforce valid enum values at the DB level,
--     preventing bad data even if the application layer is bypassed.
--   - JSONB for `data` column: flexible schema for different event types (page_view has
--     page_url, purchase has product_id + amount + currency). Avoids ALTER TABLE migrations
--     when adding new event properties.
--   - TIMESTAMPTZ (not TIMESTAMP) ensures timezone correctness across deployments.
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase')),
  timestamp TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Index strategy: tailored to the exact query access patterns.
--
-- 1. (store_id, timestamp DESC) — covers recent-activity queries (ORDER BY timestamp DESC).
--    DESC ordering allows PostgreSQL to do an index-ordered scan without a sort step.
CREATE INDEX IF NOT EXISTS idx_events_store_timestamp ON events (store_id, timestamp DESC);

-- 2. (store_id, event_type, timestamp DESC) — covers overview queries that filter by
--    event_type (e.g., COUNT(*) FILTER WHERE event_type = 'purchase').
CREATE INDEX IF NOT EXISTS idx_events_store_type_timestamp ON events (store_id, event_type, timestamp DESC);

-- 3. Partial expression index on product_id for purchase events only.
--    This index is much smaller than a full-table index because it only includes
--    ~20% of rows (purchases). Used by the top-products query.
CREATE INDEX IF NOT EXISTS idx_events_purchase_product ON events ((data->>'product_id')) WHERE event_type = 'purchase';
