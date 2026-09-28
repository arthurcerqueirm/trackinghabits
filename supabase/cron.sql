-- =====================================================================
--  Agendador dos lembretes (rode DEPOIS do deploy na Vercel)
--  1. Database > Extensions: ative "pg_cron" e "pg_net"
--  2. Troque SEU-APP e SEU_CRON_SECRET abaixo e rode no SQL Editor
--
--  A cada 5 minutos o Supabase chama /api/reminders na Vercel,
--  que envia as notificações push na hora certa de cada hábito.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('habit-reminders')
where exists (select 1 from cron.job where jobname = 'habit-reminders');

select cron.schedule(
  'habit-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-APP.vercel.app/api/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  select public.prune_reminder_log();
  $$
);
