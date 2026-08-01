alter table public.taskgoblin_projects
  add column report_enabled boolean not null default true,
  add column report_frequency text not null default 'daily'
    check (report_frequency in ('daily', 'weekly')),
  add column report_local_time time without time zone not null default '20:00',
  add column report_weekday smallint not null default 1
    check (report_weekday between 0 and 6);

alter table public.taskgoblin_project_report_deliveries
  add column attempt_count integer not null default 1
    check (attempt_count between 1 and 3),
  add column last_attempt_at timestamptz not null default now();

create or replace function public.taskgoblin_claim_project_report_delivery(
  p_project_id uuid,
  p_telegram_chat_record_id uuid,
  p_report_date date
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  claimed_id uuid;
begin
  insert into public.taskgoblin_project_report_deliveries (
    project_id,
    telegram_chat_record_id,
    report_date,
    status,
    attempt_count,
    last_attempt_at
  )
  values (
    p_project_id,
    p_telegram_chat_record_id,
    p_report_date,
    'processing',
    1,
    now()
  )
  on conflict (project_id, telegram_chat_record_id, report_date)
  do update
  set status = 'processing',
      error_message = null,
      provider_message_id = null,
      sent_at = null,
      attempt_count = public.taskgoblin_project_report_deliveries.attempt_count + 1,
      last_attempt_at = now()
  where public.taskgoblin_project_report_deliveries.attempt_count < 3
    and (
      public.taskgoblin_project_report_deliveries.status = 'failed'
      or (
        public.taskgoblin_project_report_deliveries.status = 'processing'
        and public.taskgoblin_project_report_deliveries.last_attempt_at
          < now() - interval '10 minutes'
      )
    )
  returning id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.taskgoblin_claim_project_report_delivery(uuid, uuid, date)
  from public;
grant execute on function public.taskgoblin_claim_project_report_delivery(uuid, uuid, date)
  to service_role;
