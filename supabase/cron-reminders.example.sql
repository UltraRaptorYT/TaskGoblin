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
