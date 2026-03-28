CREATE TABLE IF NOT EXISTS betterbase_meta.iac_scheduled_jobs (
  id             TEXT PRIMARY KEY,
  project_slug   TEXT NOT NULL,
  function_path  TEXT NOT NULL,     -- e.g. "mutations/users/sendDigest"
  args           JSONB NOT NULL DEFAULT '{}',
  run_at         TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
                 -- pending | running | completed | failed | cancelled
  attempts       INT NOT NULL DEFAULT 0,
  max_attempts   INT NOT NULL DEFAULT 3,
  error_msg      TEXT,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iac_jobs_run_at
  ON betterbase_meta.iac_scheduled_jobs (run_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_iac_jobs_project
  ON betterbase_meta.iac_scheduled_jobs (project_slug, status);