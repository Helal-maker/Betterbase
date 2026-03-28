-- Inngest instance settings
INSERT INTO betterbase_meta.instance_settings (key, value)
VALUES 
  ('inngest_api_key', '""'),
  ('inngest_env_id', '""'),
  ('inngest_mode', '"self-hosted"')
ON CONFLICT (key) DO NOTHING;

-- Add description column to instance_settings if not exists
ALTER TABLE betterbase_meta.instance_settings 
ADD COLUMN IF NOT EXISTS description TEXT;