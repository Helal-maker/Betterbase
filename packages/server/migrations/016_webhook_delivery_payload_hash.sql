-- Add payload hash for efficient webhook attempt lookups
-- Uses SHA-256 for deterministic hashing of payload JSON strings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE betterbase_meta.webhook_deliveries
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

-- Backfill existing rows
UPDATE betterbase_meta.webhook_deliveries
SET payload_hash = encode(digest(payload::text, 'sha256'), 'hex')
WHERE payload_hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_payload_lookup
  ON betterbase_meta.webhook_deliveries (webhook_id, event_type, payload_hash, created_at DESC);
