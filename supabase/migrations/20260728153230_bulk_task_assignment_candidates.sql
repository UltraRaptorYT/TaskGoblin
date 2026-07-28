create table public.taskgoblin_bulk_assignment_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  source_telegram_message_id uuid not null unique references public.taskgoblin_telegram_messages(id) on delete cascade,
  target_owner_telegram_user_id uuid not null references public.taskgoblin_telegram_users(id) on delete restrict,
  target_owner_display_name text not null,
  task_ids text[] not null check (cardinality(task_ids) > 0),
  state text not null default 'detected' check (
    state in ('detected', 'awaiting_confirmation', 'confirmed', 'ignored')
  ),
  reviewed_by_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index taskgoblin_bulk_assignment_candidates_project_state_idx
  on public.taskgoblin_bulk_assignment_candidates(project_id, state, created_at desc);

alter table public.taskgoblin_bulk_assignment_candidates enable row level security;

revoke all on public.taskgoblin_bulk_assignment_candidates from anon, authenticated;
grant select, insert, update on public.taskgoblin_bulk_assignment_candidates to service_role;

create or replace function public.taskgoblin_guard_bulk_assignment_candidate_transition()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.state = new.state then
    new.updated_at := now();
    return new;
  end if;

  if old.state = 'detected' and new.state = 'awaiting_confirmation' then
    new.updated_at := now();
    return new;
  end if;

  if old.state = 'awaiting_confirmation'
     and new.state in ('confirmed', 'ignored') then
    new.updated_at := now();
    return new;
  end if;

  raise exception 'Invalid bulk assignment candidate transition: % -> %',
    old.state,
    new.state;
end;
$$;

create trigger taskgoblin_bulk_assignment_candidate_transition_guard
before update of state on public.taskgoblin_bulk_assignment_candidates
for each row execute function public.taskgoblin_guard_bulk_assignment_candidate_transition();

create or replace function public.taskgoblin_transition_bulk_assignment_candidate(
  p_candidate_id uuid,
  p_project_id uuid,
  p_action text,
  p_reviewer_telegram_user_id uuid default null
)
returns table (
  candidate_id uuid,
  candidate_state text,
  project_id uuid,
  target_owner_display_name text,
  assigned_task_count integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate public.taskgoblin_bulk_assignment_candidates%rowtype;
  next_state text;
  affected_count integer := 0;
begin
  select *
  into candidate
  from public.taskgoblin_bulk_assignment_candidates as assignment
  where assignment.id = p_candidate_id
    and assignment.project_id = p_project_id
  for update;

  if not found then
    raise exception 'Bulk assignment candidate not found';
  end if;

  if p_action = 'queue' and candidate.state = 'detected' then
    next_state := 'awaiting_confirmation';
  elsif p_action in ('confirm', 'ignore')
        and candidate.state = 'awaiting_confirmation' then
    next_state := case p_action
      when 'confirm' then 'confirmed'
      else 'ignored'
    end;
  else
    raise exception 'Invalid bulk assignment action % from state %',
      p_action,
      candidate.state;
  end if;

  if next_state = 'confirmed' then
    update public.taskgoblin_tasks as task
    set owner_telegram_user_id = candidate.target_owner_telegram_user_id,
        source_participant_name = candidate.target_owner_display_name,
        updated_at = now()
    where task.project_id = candidate.project_id
      and task.id = any(candidate.task_ids)
      and task.status <> 'done';

    get diagnostics affected_count = row_count;

    insert into public.taskgoblin_project_events (
      project_id,
      event_type,
      title,
      metadata
    )
    values (
      candidate.project_id,
      'bulk_task_assignment',
      format(
        'Assigned %s active tasks to %s',
        affected_count,
        candidate.target_owner_display_name
      ),
      jsonb_build_object(
        'candidateId', candidate.id,
        'sourceTelegramMessageRecordId', candidate.source_telegram_message_id,
        'targetOwnerTelegramUserId', candidate.target_owner_telegram_user_id,
        'taskIds', candidate.task_ids,
        'assignedTaskCount', affected_count
      )
    );
  end if;

  update public.taskgoblin_bulk_assignment_candidates
  set state = next_state,
      reviewed_by_telegram_user_id = case
        when next_state = 'awaiting_confirmation' then null
        else p_reviewer_telegram_user_id
      end,
      reviewed_at = case
        when next_state = 'awaiting_confirmation' then null
        else now()
      end
  where id = candidate.id;

  return query
  select
    candidate.id,
    next_state,
    candidate.project_id,
    candidate.target_owner_display_name,
    affected_count;
end;
$$;

revoke all on function public.taskgoblin_guard_bulk_assignment_candidate_transition() from public;
revoke all on function public.taskgoblin_transition_bulk_assignment_candidate(uuid, uuid, text, uuid) from public;

grant execute on function public.taskgoblin_guard_bulk_assignment_candidate_transition() to service_role;
grant execute on function public.taskgoblin_transition_bulk_assignment_candidate(uuid, uuid, text, uuid) to service_role;
