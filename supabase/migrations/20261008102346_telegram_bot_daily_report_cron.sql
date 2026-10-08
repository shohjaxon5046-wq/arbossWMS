/*
# Enable scheduling for the Telegram evening report

1. Extensions
- `pg_net` (lets the database call the bot server) and `pg_cron` (runs jobs on a schedule).
2. Scheduled job
- `erp_bot_daily_report`: every day at 15:00 UTC (20:00 Tashkent) it calls the bot server with the private cron secret from `erp_bot_config`; the bot then sends the daily report to admins and managers.
- If the bot is not connected yet (no function_url), the job does nothing.
3. Security
- The secret is read inside the database; it is never exposed to the browser.
*/

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION erp_bot_fire_daily_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cfg erp_bot_config%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg FROM erp_bot_config WHERE id = 1;
  IF v_cfg.function_url IS NULL OR v_cfg.connected_at IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := v_cfg.function_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', v_cfg.cron_secret),
    body := jsonb_build_object('action','daily_report')
  );
END $$;

REVOKE ALL ON FUNCTION erp_bot_fire_daily_report() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  PERFORM cron.unschedule('erp_bot_daily_report') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'erp_bot_daily_report');
  PERFORM cron.schedule('erp_bot_daily_report', '0 15 * * *', 'SELECT public.erp_bot_fire_daily_report()');
END $$;
