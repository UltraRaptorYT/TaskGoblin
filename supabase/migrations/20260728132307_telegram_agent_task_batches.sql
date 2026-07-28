alter table public.taskgoblin_task_candidates
  drop constraint if exists taskgoblin_task_candidates_source_telegram_message_id_key,
  add column agent_batch_id uuid,
  add column proposal_index integer,
  add column dedupe_key text;

update public.taskgoblin_task_candidates
set dedupe_key = source_telegram_message_id::text
where dedupe_key is null;

alter table public.taskgoblin_task_candidates
  alter column dedupe_key set not null,
  add constraint taskgoblin_task_candidates_dedupe_key_key unique (dedupe_key),
  add constraint taskgoblin_task_candidates_batch_shape_check check (
    (agent_batch_id is null and proposal_index is null)
    or
    (agent_batch_id is not null and proposal_index between 1 and 8)
  );

create unique index taskgoblin_task_candidates_agent_batch_item_idx
  on public.taskgoblin_task_candidates(agent_batch_id, proposal_index)
  where agent_batch_id is not null;

create index taskgoblin_task_candidates_agent_batch_state_idx
  on public.taskgoblin_task_candidates(agent_batch_id, state)
  where agent_batch_id is not null;

create or replace function public.taskgoblin_transition_task_candidate_batch(
  p_batch_id uuid,
  p_project_id uuid,
  p_action text,
  p_reviewer_telegram_user_id uuid default null
)
returns table (
  candidate_id uuid,
  candidate_state text,
  task_id text,
  project_id uuid,
  title text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate_record record;
  candidate_count integer := 0;
begin
  if p_action not in ('queue', 'confirm', 'ignore') then
    raise exception 'Unsupported task candidate batch action: %', p_action;
  end if;

  for candidate_record in
    select
      tc.id,
      tc.state,
      tc.confirmed_task_id,
      tc.project_id,
      tc.proposed_title
    from public.taskgoblin_task_candidates as tc
    where tc.agent_batch_id = p_batch_id
      and tc.project_id = p_project_id
    order by tc.proposal_index
  loop
    candidate_count := candidate_count + 1;
    if (p_action = 'queue' and candidate_record.state = 'awaiting_confirmation')
       or (p_action = 'confirm' and candidate_record.state = 'confirmed')
       or (p_action = 'ignore' and candidate_record.state = 'ignored') then
      return query
      select
        candidate_record.id::uuid,
        candidate_record.state::text,
        candidate_record.confirmed_task_id::text,
        candidate_record.project_id::uuid,
        candidate_record.proposed_title::text;
    else
      return query
      select *
      from public.taskgoblin_transition_task_candidate(
        candidate_record.id,
        p_project_id,
        p_action,
        p_reviewer_telegram_user_id
      );
    end if;
  end loop;

  if candidate_count = 0 then
    raise exception 'Task candidate batch not found';
  end if;
end;
$$;

create table public.taskgoblin_project_name_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  source_telegram_message_id uuid not null references public.taskgoblin_telegram_messages(id) on delete cascade,
  original_name text not null,
  proposed_name text not null,
  evidence text not null,
  confidence numeric not null check (confidence between 0 and 1),
  state text not null default 'detected' check (
    state in ('detected', 'awaiting_confirmation', 'confirmed', 'ignored')
  ),
  reviewed_by_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_telegram_message_id, proposed_name)
);

create index taskgoblin_project_name_candidates_project_state_idx
  on public.taskgoblin_project_name_candidates(project_id, state);

alter table public.taskgoblin_project_name_candidates enable row level security;

revoke all on public.taskgoblin_project_name_candidates from anon, authenticated;
grant select, insert, update, delete on public.taskgoblin_project_name_candidates to service_role;
grant update on public.taskgoblin_projects to service_role;

create or replace function public.taskgoblin_transition_project_name_candidate(
  p_candidate_id uuid,
  p_project_id uuid,
  p_action text,
  p_reviewer_telegram_user_id uuid default null
)
returns table (
  candidate_id uuid,
  candidate_state text,
  project_id uuid,
  project_name text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate public.taskgoblin_project_name_candidates%rowtype;
  next_state text;
begin
  select *
  into candidate
  from public.taskgoblin_project_name_candidates as pnc
  where pnc.id = p_candidate_id
    and pnc.project_id = p_project_id
  for update;

  if not found then
    raise exception 'Project name candidate not found';
  end if;

  if p_action = 'queue' and candidate.state = 'awaiting_confirmation' then
    return query
    select
      candidate.id,
      candidate.state,
      candidate.project_id,
      candidate.proposed_name;
    return;
  elsif p_action = 'confirm' and candidate.state = 'confirmed' then
    return query
    select
      candidate.id,
      candidate.state,
      candidate.project_id,
      candidate.proposed_name;
    return;
  elsif p_action = 'ignore' and candidate.state = 'ignored' then
    return query
    select
      candidate.id,
      candidate.state,
      candidate.project_id,
      candidate.proposed_name;
    return;
  elsif p_action = 'queue' and candidate.state = 'detected' then
    next_state := 'awaiting_confirmation';
  elsif p_action in ('confirm', 'ignore')
        and candidate.state = 'awaiting_confirmation' then
    next_state := case p_action
      when 'confirm' then 'confirmed'
      else 'ignored'
    end;
  else
    raise exception 'Invalid project name candidate action % from state %',
      p_action,
      candidate.state;
  end if;

  if next_state = 'confirmed' then
    update public.taskgoblin_projects
    set name = candidate.proposed_name,
        updated_at = now()
    where id = candidate.project_id
      and name = candidate.original_name;

    if not found then
      raise exception 'Project name changed while this suggestion was awaiting review';
    end if;

    insert into public.taskgoblin_project_events (
      project_id,
      event_type,
      title,
      metadata
    )
    values (
      candidate.project_id,
      'project_name_confirmed',
      candidate.proposed_name,
      jsonb_build_object(
        'candidateId', candidate.id,
        'previousName', candidate.original_name,
        'sourceTelegramMessageId', candidate.source_telegram_message_id
      )
    );
  end if;

  update public.taskgoblin_project_name_candidates
  set state = next_state,
      reviewed_by_telegram_user_id = case
        when next_state = 'awaiting_confirmation' then null
        else p_reviewer_telegram_user_id
      end,
      reviewed_at = case
        when next_state = 'awaiting_confirmation' then null
        else now()
      end,
      updated_at = now()
  where id = candidate.id;

  return query
  select
    candidate.id,
    next_state,
    candidate.project_id,
    candidate.proposed_name;
end;
$$;

revoke all on function public.taskgoblin_transition_task_candidate_batch(uuid, uuid, text, uuid) from public;
revoke all on function public.taskgoblin_transition_project_name_candidate(uuid, uuid, text, uuid) from public;

grant execute on function public.taskgoblin_transition_task_candidate_batch(uuid, uuid, text, uuid) to service_role;
grant execute on function public.taskgoblin_transition_project_name_candidate(uuid, uuid, text, uuid) to service_role;
