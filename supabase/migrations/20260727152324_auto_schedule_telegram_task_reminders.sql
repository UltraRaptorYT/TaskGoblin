create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.taskgoblin_sync_task_reminder()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  reminder_time timestamptz;
begin
  if tg_op = 'UPDATE' then
    if old.due_at is not distinct from new.due_at
       and old.owner_telegram_user_id is not distinct from new.owner_telegram_user_id
       and (old.status = 'done') = (new.status = 'done') then
      return new;
    end if;
  end if;

  update public.taskgoblin_reminders
  set status = 'cancelled'
  where task_id = new.id
    and status = 'scheduled';

  if new.due_at is null
     or new.owner_telegram_user_id is null
     or new.status = 'done'
     or new.due_at <= now() then
    return new;
  end if;

  reminder_time := greatest(new.due_at - interval '1 hour', now());

  insert into public.taskgoblin_reminders (
    task_id,
    channel,
    tone,
    message,
    scheduled_for,
    status
  )
  values (
    new.id,
    'telegram',
    'friendly',
    '',
    reminder_time,
    'scheduled'
  );

  return new;
end;
$$;

drop trigger if exists taskgoblin_task_reminder_after_change
  on public.taskgoblin_tasks;

create trigger taskgoblin_task_reminder_after_change
after insert or update of due_at, owner_telegram_user_id, status
on public.taskgoblin_tasks
for each row execute function public.taskgoblin_sync_task_reminder();

update public.taskgoblin_reminders as reminder
set status = 'cancelled'
where reminder.status = 'scheduled'
  and (
    reminder.scheduled_for <= now()
    or not exists (
      select 1
      from public.taskgoblin_tasks as task
      where task.id = reminder.task_id
        and task.owner_telegram_user_id is not null
        and task.due_at is not null
        and task.due_at > now()
        and task.status <> 'done'
    )
  );

insert into public.taskgoblin_reminders (
  task_id,
  channel,
  tone,
  message,
  scheduled_for,
  status
)
select
  task.id,
  'telegram',
  'friendly',
  '',
  greatest(task.due_at - interval '1 hour', now()),
  'scheduled'
from public.taskgoblin_tasks as task
where task.owner_telegram_user_id is not null
  and task.due_at is not null
  and task.due_at > now()
  and task.status <> 'done'
  and not exists (
    select 1
    from public.taskgoblin_reminders as reminder
    where reminder.task_id = task.id
      and reminder.status = 'scheduled'
  );

revoke all on function public.taskgoblin_sync_task_reminder() from public;
grant execute on function public.taskgoblin_sync_task_reminder() to service_role;
