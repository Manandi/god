# Global Weekly Quest push setup

This is a one-time setup for the game owner. Players only opt in from WEEKLY QUEST; they never choose a reminder time. The backend sends once daily at 7 PM in each opted-in player's timezone while that week's plan is unfinished.

1. Apply `migrations/202610070001_weekly_push.sql` to the `hollow-roots` Supabase project. This project already uses the `hunter_secret_ok` function from `schema.sql`.
2. Generate one VAPID key pair with `npx --yes web-push generate-vapid-keys`. Keep the private key out of GitHub and chat.
3. In Supabase Edge Function secrets, set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` contact address), `PUSH_CRON_SECRET` (a random secret), and `SUPABASE_SERVICE_ROLE_KEY`.
4. From an authenticated Supabase CLI, deploy the function: `supabase functions deploy weekly-ping --project-ref gitqmiwwakaejznucxqn`.
5. Enable `pg_cron`, `pg_net`, and Vault in Supabase Integrations. In `weekly-ping-schedule.sql`, replace `REPLACE_WITH_PUSH_CRON_SECRET` with the same `PUSH_CRON_SECRET`, then run the file once in the SQL editor.
6. Open the public game and use WEEKLY QUEST → TURN ON DAILY PING. The browser asks for notification permission and registers that device.

The push function returns only the public VAPID key to browsers. Its scheduled POST requires `PUSH_CRON_SECRET`; it reads subscriptions with the service role, and the subscription table has RLS enabled with direct access revoked. A player can remove only the subscription for their current browser using their hunter secret.
