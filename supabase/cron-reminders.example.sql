-- Run this after deploying the app and setting CRON_SECRET in Vercel.
-- Store the same secret in Supabase Vault; do not paste it into this file.
select vault.create_secret('https://YOUR_DEPLOYMENT.vercel.app', 'taskgoblin_app_url');
select vault.create_secret('YOUR_CRON_SECRET', 'taskgoblin_cron_secret');

select cron.schedule(
  'taskgoblin-send-due-reminders',
  '* * * * *',
  $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'taskgoblin_app_url') || '/api/cron/reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'taskgoblin_cron_secret')
      )
    );
  $$
);

-- 20:00 Asia/Singapore is 12:00 UTC throughout the year.
-- This job sends one deduplicated project report per active Telegram group,
-- including progress, urgent work, ownership, blockers and a seven-day outlook.
select cron.schedule(
  'taskgoblin-daily-project-report',
  '0 12 * * *',
  $$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'taskgoblin_app_url') || '/api/cron/project-reports',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'taskgoblin_cron_secret')
      )
    );
  $$
);
