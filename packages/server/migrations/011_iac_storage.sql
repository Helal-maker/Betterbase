-- Per-project storage metadata
-- One row per stored object. Lives in the project schema.
-- Called from provision_project_schema() in DB-01.

CREATE OR REPLACE FUNCTION betterbase_meta.provision_iac_storage(p_slug TEXT)
RETURNS VOID AS $$
DECLARE
  s TEXT := 'project_' || p_slug;
BEGIN
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS %I._iac_storage (
      storage_id   TEXT PRIMARY KEY,
      s3_key       TEXT NOT NULL UNIQUE,
      bucket       TEXT NOT NULL,
      content_type TEXT,
      size_bytes   BIGINT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  $f$, s);
END;
$$ LANGUAGE plpgsql;