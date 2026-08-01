create table public.taskgoblin_task_mutations (
  id uuid primary key default gen_random_uuid(),
  mutation_order bigint generated always as identity unique,
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  task_id text not null,
  transaction_id bigint not null default txid_current(),
  operation text not null check (operation in ('insert', 'update')),
  before_state jsonb,
  after_state jsonb,
  undone_at timestamptz,
  undone_by_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (operation = 'insert' and before_state is null and after_state is not null)
    or (operation = 'update' and before_state is not null and after_state is not null)
  )
);

create index taskgoblin_task_mutations_project_latest_idx
  on public.taskgoblin_task_mutations(project_id, mutation_order desc)
  where undone_at is null;

create table public.taskgoblin_project_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  telegram_chat_record_id uuid not null references public.taskgoblin_telegram_chats(id) on delete cascade,
  report_date date not null,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (project_id, telegram_chat_record_id, report_date)
);

create index taskgoblin_project_report_deliveries_status_idx
  on public.taskgoblin_project_report_deliveries(status, report_date);

alter table public.taskgoblin_task_mutations enable row level security;
alter table public.taskgoblin_project_report_deliveries enable row level security;

revoke all on public.taskgoblin_task_mutations from anon, authenticated;
revoke all on public.taskgoblin_project_report_deliveries from anon, authenticated;
grant select, insert, update on public.taskgoblin_task_mutations to service_role;
grant select, insert, update on public.taskgoblin_project_report_deliveries to service_role;
grant usage, select on sequence public.taskgoblin_task_mutations_mutation_order_seq to service_role;

create or replace function public.taskgoblin_record_task_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_setting('taskgoblin.skip_task_mutation_log', true) = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.taskgoblin_task_mutations (
      project_id,
      task_id,
      transaction_id,
      operation,
      before_state,
      after_state
    )
    values (
      new.project_id,
      new.id,
      txid_current(),
      'insert',
      null,
      to_jsonb(new)
    );
  elsif tg_op = 'UPDATE' and old is distinct from new then
    insert into public.taskgoblin_task_mutations (
      project_id,
      task_id,
      transaction_id,
      operation,
      before_state,
      after_state
    )
    values (
      new.project_id,
      new.id,
      txid_current(),
      'update',
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;

  return new;
end;
$$;

create trigger taskgoblin_task_mutation_audit
after insert or update on public.taskgoblin_tasks
for each row execute function public.taskgoblin_record_task_mutation();

create or replace function public.taskgoblin_undo_last_task_mutation(
  p_project_id uuid,
  p_reviewer_telegram_user_id uuid
)
returns table (
  transaction_id bigint,
  affected_task_count integer,
  description text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target_transaction_id bigint;
  mutation public.taskgoblin_task_mutations%rowtype;
  restored_task public.taskgoblin_tasks%rowtype;
  mutation_count integer := 0;
  first_title text;
  first_operation text;
  owner_changed boolean := false;
  status_changed boolean := false;
begin
  if p_reviewer_telegram_user_id is null or not exists (
    select 1
    from public.taskgoblin_project_members as member
    where member.project_id = p_project_id
      and member.telegram_user_id = p_reviewer_telegram_user_id
  ) then
    raise exception 'Only a linked project member can undo task changes';
  end if;

  select log.transaction_id
  into target_transaction_id
  from public.taskgoblin_task_mutations as log
  where log.project_id = p_project_id
    and log.undone_at is null
  order by log.mutation_order desc
  limit 1;

  if target_transaction_id is null then
    return;
  end if;

  perform set_config('taskgoblin.skip_task_mutation_log', 'on', true);

  for mutation in
    select *
    from public.taskgoblin_task_mutations as log
    where log.project_id = p_project_id
      and log.transaction_id = target_transaction_id
      and log.undone_at is null
    order by log.mutation_order desc
    for update
  loop
    mutation_count := mutation_count + 1;
    first_title := coalesce(
      first_title,
      mutation.after_state ->> 'title',
      mutation.before_state ->> 'title',
      'task'
    );
    first_operation := coalesce(first_operation, mutation.operation);
    owner_changed := owner_changed or (
      mutation.before_state ->> 'owner_telegram_user_id'
      is distinct from
      mutation.after_state ->> 'owner_telegram_user_id'
    );
    status_changed := status_changed or (
      mutation.before_state ->> 'status'
      is distinct from
      mutation.after_state ->> 'status'
    );

    if mutation.operation = 'insert' then
      delete from public.taskgoblin_tasks as task
      where task.id = mutation.task_id
        and task.project_id = p_project_id;
    else
      restored_task := jsonb_populate_record(
        null::public.taskgoblin_tasks,
        mutation.before_state
      );
      update public.taskgoblin_tasks as task
      set title = restored_task.title,
          description = restored_task.description,
          status = restored_task.status,
          priority = restored_task.priority,
          source_participant_name = restored_task.source_participant_name,
          due_label = restored_task.due_label,
          due_at = restored_task.due_at,
          confidence = restored_task.confidence,
          blocked_by = restored_task.blocked_by,
          source_message_ids = restored_task.source_message_ids,
          source_snippet = restored_task.source_snippet,
          subtasks = restored_task.subtasks,
          owner_telegram_user_id = restored_task.owner_telegram_user_id,
          source_telegram_message_id = restored_task.source_telegram_message_id,
          updated_at = now()
      where task.id = mutation.task_id
        and task.project_id = p_project_id;
    end if;
  end loop;

  update public.taskgoblin_task_mutations as log
  set undone_at = now(),
      undone_by_telegram_user_id = p_reviewer_telegram_user_id
  where log.project_id = p_project_id
    and log.transaction_id = target_transaction_id
    and log.undone_at is null;

  insert into public.taskgoblin_project_events (
    project_id,
    event_type,
    title,
    metadata
  )
  values (
    p_project_id,
    'task_change_undone',
    case
      when mutation_count > 1 then format('Undid %s task changes', mutation_count)
      when first_operation = 'insert' then format('Removed newly created task: %s', first_title)
      when owner_changed and status_changed then format('Restored owner and status for: %s', first_title)
      when owner_changed then format('Restored previous owner for: %s', first_title)
      when status_changed then format('Restored previous status for: %s', first_title)
      else format('Restored previous task details for: %s', first_title)
    end,
    jsonb_build_object(
      'transactionId', target_transaction_id,
      'affectedTaskCount', mutation_count,
      'undoneByTelegramUserId', p_reviewer_telegram_user_id
    )
  );

  return query
  select
    target_transaction_id,
    mutation_count,
    case
      when mutation_count > 1 then format('Undid %s task changes.', mutation_count)
      when first_operation = 'insert' then format('Removed newly created task: %s.', first_title)
      when owner_changed and status_changed then format('Restored the previous owner and status for %s.', first_title)
      when owner_changed then format('Restored the previous owner for %s.', first_title)
      when status_changed then format('Restored the previous status for %s.', first_title)
      else format('Restored the previous details for %s.', first_title)
    end;
end;
$$;

create or replace function public.taskgoblin_confirm_completion_candidate(
  p_candidate_id uuid,
  p_project_id uuid,
  p_reviewer_telegram_user_id uuid
)
returns table (
  candidate_id uuid,
  candidate_state text,
  task_id text,
  project_id uuid,
  event_type text,
  summary text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate public.taskgoblin_project_event_candidates%rowtype;
  transition_result record;
  reviewer_name text;
begin
  select *
  into candidate
  from public.taskgoblin_project_event_candidates as event_candidate
  where event_candidate.id = p_candidate_id
    and event_candidate.project_id = p_project_id
  for update;

  if not found or candidate.event_type <> 'possible_task_completion' then
    raise exception 'Completion candidate not found';
  end if;

  if p_reviewer_telegram_user_id is null or not exists (
    select 1
    from public.taskgoblin_project_members as member
    where member.project_id = p_project_id
      and member.telegram_user_id = p_reviewer_telegram_user_id
  ) then
    raise exception 'Only a linked project member can complete a task';
  end if;

  select *
  into transition_result
  from public.taskgoblin_transition_project_event_candidate(
    p_candidate_id,
    p_project_id,
    'confirm',
    p_reviewer_telegram_user_id
  );

  select coalesce(
    nullif(trim(concat_ws(' ', user_row.first_name, user_row.last_name)), ''),
    nullif(user_row.username, ''),
    'Telegram member'
  )
  into reviewer_name
  from public.taskgoblin_telegram_users as user_row
  where user_row.id = p_reviewer_telegram_user_id;

  update public.taskgoblin_tasks as task
  set owner_telegram_user_id = p_reviewer_telegram_user_id,
      source_participant_name = reviewer_name,
      updated_at = now()
  where task.id = transition_result.task_id
    and task.project_id = p_project_id;

  return query
  select
    transition_result.candidate_id::uuid,
    transition_result.candidate_state::text,
    transition_result.task_id::text,
    transition_result.project_id::uuid,
    transition_result.event_type::text,
    transition_result.summary::text;
end;
$$;

revoke all on function public.taskgoblin_record_task_mutation() from public;
revoke all on function public.taskgoblin_undo_last_task_mutation(uuid, uuid) from public;
revoke all on function public.taskgoblin_confirm_completion_candidate(uuid, uuid, uuid) from public;

grant execute on function public.taskgoblin_record_task_mutation() to service_role;
grant execute on function public.taskgoblin_undo_last_task_mutation(uuid, uuid) to service_role;
grant execute on function public.taskgoblin_confirm_completion_candidate(uuid, uuid, uuid) to service_role;
