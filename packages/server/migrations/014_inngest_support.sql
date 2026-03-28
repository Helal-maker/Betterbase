-- Export jobs table: stores async export results for the background CSV export function
CREATE TABLE IF NOT EXISTS betterbase_meta.export_jobs (
  id            BIGSERIAL PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES betterbase_meta.projects(id) ON DELETE CASCADE,
  requested_by  TEXT NOT NULL,   -- admin email
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | complete | failed
  row_count     INT,
  result_csv    TEXT,            -- stored in DB for v1; move to MinIO in v2
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_project_id
  ON betterbase_meta.export_jobs (project_id, created_at DESC);