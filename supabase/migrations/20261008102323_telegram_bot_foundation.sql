/*
# Telegram bot foundation

1. Modified Tables
- `erp_service_partners`: new `telegram_chat_id` (text) - the partner's Telegram chat, filled when the partner logs in to the bot with their phone.
2. New Tables
- `erp_bot_config` (single row, id = 1): `webhook_secret` (random secret Telegram must send with every update), `cron_secret` (secret for the scheduled evening report), `function_url`, `bot_username`, `connected_at`, `updated_at`.
- `erp_bot_log`: audit of every bot action - `chat_id`, `actor_type` (staff/partner/unknown), `actor_id`, `actor_name`, `action`, `details` (jsonb), `created_at`.
3. Security
- RLS enabled on both tables.
- `erp_bot_config` has NO policies: only the server (service role) can read the secrets.
- `erp_bot_log`: admin/manager can read; nobody can write from the browser (only the bot server writes).
4. Notes
- Indexes on telegram chat ids and log lookups.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_service_partners' AND column_name='telegram_chat_id') THEN
    ALTER TABLE erp_service_partners ADD COLUMN telegram_chat_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_erp_staff_tg ON erp_staff (telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_erp_partners_tg ON erp_service_partners (telegram_chat_id);

CREATE TABLE IF NOT EXISTS erp_bot_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  cron_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  function_url text,
  bot_username text,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO erp_bot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE erp_bot_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS erp_bot_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text,
  actor_type text NOT NULL DEFAULT 'unknown',
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_bot_log_created ON erp_bot_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_bot_log_action ON erp_bot_log (action);
ALTER TABLE erp_bot_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_log_select_admin" ON erp_bot_log;
CREATE POLICY "bot_log_select_admin" ON erp_bot_log FOR SELECT
TO authenticated USING (erp_staff_role() IN ('admin','manager'));
