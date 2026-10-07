-- One-time scheduling setup for the weekly-ping Edge Function.
-- Before running:
-- 1. Enable pg_cron, pg_net, and Vault in Supabase Integrations.
-- 2. Deploy weekly-ping and set PUSH_CRON_SECRET, VAPID_PUBLIC_KEY,
--    VAPID_PRIVATE_KEY, VAPID_SUBJECT, and SUPABASE_SERVICE_ROLE_KEY as function secrets.
-- 3. Replace the placeholder below with the same random PUSH_CRON_SECRET value.
-- The schedule checks every 15 minutes; the function sends at 7 PM local time.

select vault.create_secret(
  'REPLACE_WITH_PUSH_CRON_SECRET',
  'weekly_push_cron_secret',
  'Authorization secret for the weekly-ping scheduled function'
);

select cron.schedule(
  'weekly-ping-15m',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://gitqmiwwakaejznucxqn.supabase.co/functions/v1/weekly-ping',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_uRC4vHHdHUnrdsqV2cSajA_HWrPTmZK',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'weekly_push_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $job$
);
