-- Export jobs table: stores async export results for the background CSV export function
-- CSV results are stored in MinIO, not in the database
CREATE TABLE IF NOT EXISTS betterbase_meta.export_jobs (
  id              BIGSERIAL PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES betterbase_meta.projects(id) ON DELETE CASCADE,
  requested_by    TEXT NOT NULL,   -- admin email
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | complete | failed
  row_count       INT,
  result_object_key   TEXT,        -- MinIO object key (e.g., exports/proj_123/export_456.csv)
  result_expires_at   TIMESTAMPTZ, -- When the URL expires
  error_msg       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id
  ON betterbase_meta.export_jobs (project_id, created_at DESC);