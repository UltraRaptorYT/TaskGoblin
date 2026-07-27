alter table public.taskgoblin_projects
  add column timezone text not null default 'UTC';

create table public.taskgoblin_ai_detection_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  source_telegram_message_id uuid not null references public.taskgoblin_telegram_messages(id) on delete cascade,
  provider text not null check (provider in ('openai','mock')),
  model text not null,
  prompt_version text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  structured_output jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.taskgoblin_project_event_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  ai_detection_run_id uuid not null unique references public.taskgoblin_ai_detection_runs(id) on delete cascade,
  source_telegram_message_id uuid not null unique references public.taskgoblin_telegram_messages(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'task_proposal',
      'explicit_task_assignment',
      'task_progress_update',
      'possible_task_completion',
      'deadline_update',
      'blocker',
      'decision'
    )
  ),
  state text not null default 'detected' check (
    state in ('detected','awaiting_confirmation','confirmed','edited','ignored')
  ),
  summary text not null,
  event_payload jsonb not null default '{}'::jsonb,
  matched_task_id text references public.taskgoblin_tasks(id) on delete set null,
  proposed_owner_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  proposed_due_label text,
  proposed_due_at timestamptz,
  duplicate_of_task_id text references public.taskgoblin_tasks(id) on delete set null,
  duplicate_of_candidate_id uuid references public.taskgoblin_project_event_candidates(id) on delete set null,
  confidence numeric not null check (confidence between 0 and 1),
  rationale text not null,
  confirmed_task_id text references public.taskgoblin_tasks(id) on delete set null,
  reviewed_by_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index taskgoblin_ai_detection_runs_project_created_idx
  on public.taskgoblin_ai_detection_runs(project_id, created_at desc);
create index taskgoblin_event_candidates_project_state_idx
  on public.taskgoblin_project_event_candidates(project_id, state, created_at desc);
create index taskgoblin_event_candidates_matched_task_idx
  on public.taskgoblin_project_event_candidates(matched_task_id)
  where matched_task_id is not null;

alter table public.taskgoblin_ai_detection_runs enable row level security;
alter table public.taskgoblin_project_event_candidates enable row level security;

revoke all on public.taskgoblin_ai_detection_runs from anon, authenticated;
revoke all on public.taskgoblin_project_event_candidates from anon, authenticated;

grant select, insert, update on public.taskgoblin_ai_detection_runs to service_role;
grant select, insert, update on public.taskgoblin_project_event_candidates to service_role;

create or replace function public.taskgoblin_guard_project_event_candidate_transition()
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
     and new.state in ('confirmed','edited','ignored') then
    new.updated_at := now();
    return new;
  end if;

  raise exception 'Invalid project event candidate transition: % -> %', old.state, new.state;
end;
$$;

create trigger taskgoblin_project_event_candidate_transition_guard
before update of state on public.taskgoblin_project_event_candidates
for each row execute function public.taskgoblin_guard_project_event_candidate_transition();

create or replace function public.taskgoblin_transition_project_event_candidate(
  p_candidate_id uuid,
  p_project_id uuid,
  p_action text,
  p_reviewer_telegram_user_id uuid default null
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
  source_message public.taskgoblin_telegram_messages%rowtype;
  next_state text;
  affected_task_id text;
  owner_name text;
begin
  select *
  into candidate
  from public.taskgoblin_project_event_candidates as ec
  where ec.id = p_candidate_id and ec.project_id = p_project_id
  for update;

  if not found then
    raise exception 'Project event candidate not found';
  end if;

  if p_action = 'queue' and candidate.state = 'detected' then
    next_state := 'awaiting_confirmation';
  elsif p_action in ('confirm','edit','ignore')
        and candidate.state = 'awaiting_confirmation' then
    next_state := case p_action
      when 'confirm' then 'confirmed'
      when 'edit' then 'edited'
      else 'ignored'
    end;
  else
    raise exception 'Invalid project event candidate action % from state %',
      p_action,
      candidate.state;
  end if;

  if next_state = 'confirmed' then
    select *
    into source_message
    from public.taskgoblin_telegram_messages
    where id = candidate.source_telegram_message_id;

    if candidate.event_type in ('task_proposal','explicit_task_assignment') then
      select trim(concat_ws(' ', first_name, last_name))
      into owner_name
      from public.taskgoblin_telegram_users
      where id = candidate.proposed_owner_telegram_user_id;

      affected_task_id := gen_random_uuid()::text;
      insert into public.taskgoblin_tasks (
        id,
        project_id,
        title,
        description,
        status,
        priority,
        source_participant_name,
        owner_telegram_user_id,
        due_label,
        due_at,
        confidence,
        source_message_ids,
        source_snippet,
        source_telegram_message_id
      )
      values (
        affected_task_id,
        candidate.project_id,
        candidate.summary,
        null,
        'backlog',
        'medium',
        nullif(owner_name, ''),
        candidate.proposed_owner_telegram_user_id,
        candidate.proposed_due_label,
        candidate.proposed_due_at,
        candidate.confidence,
        case
          when source_message.telegram_message_id is null then '{}'::bigint[]
          else array[source_message.telegram_message_id]
        end,
        source_message.plain_text,
        candidate.source_telegram_message_id
      );
    elsif candidate.event_type = 'possible_task_completion' then
      update public.taskgoblin_tasks as task
      set status = 'done',
          updated_at = now()
      where task.id = candidate.matched_task_id
        and task.project_id = candidate.project_id
      returning task.id into affected_task_id;
    elsif candidate.event_type = 'deadline_update' then
      update public.taskgoblin_tasks as task
      set due_label = candidate.proposed_due_label,
          due_at = candidate.proposed_due_at,
          updated_at = now()
      where task.id = candidate.matched_task_id
        and task.project_id = candidate.project_id
      returning task.id into affected_task_id;
    elsif candidate.event_type = 'blocker' and candidate.matched_task_id is not null then
      update public.taskgoblin_tasks as task
      set status = 'blocked',
          blocked_by = candidate.summary,
          updated_at = now()
      where task.id = candidate.matched_task_id
        and task.project_id = candidate.project_id
      returning task.id into affected_task_id;
    elsif candidate.event_type = 'task_progress_update'
          and candidate.matched_task_id is not null then
      update public.taskgoblin_tasks as task
      set status = case
            when task.status in ('backlog','todo') then 'doing'
            else task.status
          end,
          updated_at = now()
      where task.id = candidate.matched_task_id
        and task.project_id = candidate.project_id
      returning task.id into affected_task_id;
    end if;

    insert into public.taskgoblin_project_events (
      project_id,
      event_type,
      title,
      metadata
    )
    values (
      candidate.project_id,
      candidate.event_type,
      candidate.summary,
      candidate.event_payload || jsonb_build_object(
        'candidateId', candidate.id,
        'sourceTelegramMessageRecordId', candidate.source_telegram_message_id,
        'matchedTaskId', candidate.matched_task_id,
        'affectedTaskId', affected_task_id
      )
    );
  end if;

  update public.taskgoblin_project_event_candidates
  set state = next_state,
      confirmed_task_id = case
        when candidate.event_type in ('task_proposal','explicit_task_assignment')
          then affected_task_id
        else null
      end,
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
    affected_task_id,
    candidate.project_id,
    candidate.event_type,
    candidate.summary;
end;
$$;

revoke all on function public.taskgoblin_guard_project_event_candidate_transition() from public;
revoke all on function public.taskgoblin_transition_project_event_candidate(uuid, uuid, text, uuid) from public;

grant execute on function public.taskgoblin_guard_project_event_candidate_transition() to service_role;
grant execute on function public.taskgoblin_transition_project_event_candidate(uuid, uuid, text, uuid) to service_role;
