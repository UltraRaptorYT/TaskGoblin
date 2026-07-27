create table public.taskgoblin_telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  username text,
  first_name text not null,
  last_name text,
  language_code text,
  is_bot boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taskgoblin_telegram_chats (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id bigint not null unique,
  project_id uuid unique references public.taskgoblin_projects(id) on delete set null,
  chat_type text not null check (chat_type in ('private','group','supergroup','channel','unknown')),
  title text,
  username text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.taskgoblin_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  telegram_user_id uuid not null references public.taskgoblin_telegram_users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('member','admin')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, telegram_user_id)
);

create table public.taskgoblin_telegram_updates (
  update_id bigint primary key,
  update_type text not null,
  telegram_chat_record_id uuid references public.taskgoblin_telegram_chats(id) on delete set null,
  telegram_user_record_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  status text not null default 'processing' check (status in ('processing','processed','ignored','failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  raw_json jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.taskgoblin_telegram_messages
  alter column import_id drop not null,
  add column project_id uuid references public.taskgoblin_projects(id) on delete cascade,
  add column telegram_chat_record_id uuid references public.taskgoblin_telegram_chats(id) on delete cascade,
  add column telegram_user_record_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  add column telegram_update_id bigint references public.taskgoblin_telegram_updates(update_id) on delete set null,
  add column reply_to_telegram_message_id bigint,
  add column message_thread_id bigint,
  add column edited_at timestamptz;

alter table public.taskgoblin_telegram_messages
  add constraint taskgoblin_live_message_unique
  unique (telegram_chat_record_id, telegram_message_id);

alter table public.taskgoblin_tasks
  add column owner_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  add column source_telegram_message_id uuid references public.taskgoblin_telegram_messages(id) on delete set null;

create table public.taskgoblin_task_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.taskgoblin_projects(id) on delete cascade,
  source_telegram_message_id uuid not null references public.taskgoblin_telegram_messages(id) on delete cascade,
  proposed_title text not null,
  proposed_description text,
  proposed_owner_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  proposed_due_label text,
  proposed_due_at timestamptz,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  detection_source text not null default 'deterministic' check (detection_source in ('deterministic','manual','ai')),
  state text not null default 'detected' check (state in ('detected','awaiting_confirmation','confirmed','edited','ignored')),
  confirmed_task_id text references public.taskgoblin_tasks(id) on delete set null,
  reviewed_by_telegram_user_id uuid references public.taskgoblin_telegram_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_telegram_message_id)
);

create index taskgoblin_telegram_chats_project_idx
  on public.taskgoblin_telegram_chats(project_id);
create index taskgoblin_project_members_project_idx
  on public.taskgoblin_project_members(project_id);
create index taskgoblin_live_messages_project_created_idx
  on public.taskgoblin_telegram_messages(project_id, created_at)
  where telegram_chat_record_id is not null;
create index taskgoblin_task_candidates_project_state_idx
  on public.taskgoblin_task_candidates(project_id, state);
create index taskgoblin_tasks_owner_telegram_idx
  on public.taskgoblin_tasks(project_id, owner_telegram_user_id);

alter table public.taskgoblin_telegram_users enable row level security;
alter table public.taskgoblin_telegram_chats enable row level security;
alter table public.taskgoblin_project_members enable row level security;
alter table public.taskgoblin_telegram_updates enable row level security;
alter table public.taskgoblin_task_candidates enable row level security;

revoke all on public.taskgoblin_telegram_users from anon, authenticated;
revoke all on public.taskgoblin_telegram_chats from anon, authenticated;
revoke all on public.taskgoblin_project_members from anon, authenticated;
revoke all on public.taskgoblin_telegram_updates from anon, authenticated;
revoke all on public.taskgoblin_task_candidates from anon, authenticated;

grant select, insert, update, delete on public.taskgoblin_telegram_users to service_role;
grant select, insert, update, delete on public.taskgoblin_telegram_chats to service_role;
grant select, insert, update, delete on public.taskgoblin_project_members to service_role;
grant select, insert, update, delete on public.taskgoblin_telegram_updates to service_role;
grant select, insert, update, delete on public.taskgoblin_task_candidates to service_role;
grant select, insert, update on public.taskgoblin_telegram_messages to service_role;
grant select, insert, update on public.taskgoblin_tasks to service_role;
grant select, insert on public.taskgoblin_project_events to service_role;
grant select, insert on public.taskgoblin_workspaces to service_role;
grant select, insert on public.taskgoblin_projects to service_role;

create or replace function public.taskgoblin_claim_telegram_update(
  p_update_id bigint,
  p_update_type text,
  p_raw_json jsonb
)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  with claimed as (
    insert into public.taskgoblin_telegram_updates (
      update_id,
      update_type,
      raw_json
    )
    values (
      p_update_id,
      p_update_type,
      coalesce(p_raw_json, '{}'::jsonb)
    )
    on conflict (update_id) do update
      set status = 'processing',
          attempt_count = public.taskgoblin_telegram_updates.attempt_count + 1,
          error_message = null,
          processed_at = null
      where public.taskgoblin_telegram_updates.status = 'failed'
    returning true
  )
  select coalesce((select true from claimed limit 1), false);
$$;

create or replace function public.taskgoblin_guard_candidate_transition()
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

  raise exception 'Invalid task candidate transition: % -> %', old.state, new.state;
end;
$$;

create trigger taskgoblin_task_candidate_transition_guard
before update of state on public.taskgoblin_task_candidates
for each row execute function public.taskgoblin_guard_candidate_transition();

create or replace function public.taskgoblin_transition_task_candidate(
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
  title text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  candidate public.taskgoblin_task_candidates%rowtype;
  source_message public.taskgoblin_telegram_messages%rowtype;
  next_state text;
  created_task_id text;
  owner_name text;
begin
  select *
  into candidate
  from public.taskgoblin_task_candidates as tc
  where tc.id = p_candidate_id and tc.project_id = p_project_id
  for update;

  if not found then
    raise exception 'Task candidate not found';
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
    raise exception 'Invalid task candidate action % from state %', p_action, candidate.state;
  end if;

  if next_state = 'confirmed' then
    select *
    into source_message
    from public.taskgoblin_telegram_messages
    where id = candidate.source_telegram_message_id;

    select trim(concat_ws(' ', first_name, last_name))
    into owner_name
    from public.taskgoblin_telegram_users
    where id = candidate.proposed_owner_telegram_user_id;

    created_task_id := gen_random_uuid()::text;

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
      created_task_id,
      candidate.project_id,
      candidate.proposed_title,
      candidate.proposed_description,
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

    insert into public.taskgoblin_project_events (
      project_id,
      event_type,
      title,
      metadata
    )
    values (
      candidate.project_id,
      'task_candidate_confirmed',
      candidate.proposed_title,
      jsonb_build_object(
        'candidateId', candidate.id,
        'taskId', created_task_id,
        'sourceTelegramMessageId', candidate.source_telegram_message_id
      )
    );
  end if;

  update public.taskgoblin_task_candidates
  set state = next_state,
      confirmed_task_id = created_task_id,
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
    created_task_id,
    candidate.project_id,
    candidate.proposed_title;
end;
$$;

revoke all on function public.taskgoblin_claim_telegram_update(bigint, text, jsonb) from public;
revoke all on function public.taskgoblin_guard_candidate_transition() from public;
revoke all on function public.taskgoblin_transition_task_candidate(uuid, uuid, text, uuid) from public;

grant execute on function public.taskgoblin_claim_telegram_update(bigint, text, jsonb) to service_role;
grant execute on function public.taskgoblin_guard_candidate_transition() to service_role;
grant execute on function public.taskgoblin_transition_task_candidate(uuid, uuid, text, uuid) to service_role;
